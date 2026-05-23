import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";
import type { ReservationDetail } from "@/schemas";
import { Prisma } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const endpoint = `POST /api/reservations/${id}/confirm`;

  const cached = await checkIdempotency(idempotencyKey, endpoint);
  if (cached) return cached;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservations = await tx.$queryRaw<
        Array<{
          id: string;
          productId: string;
          warehouseId: string;
          quantity: number;
          status: string;
          expiresAt: Date;
          createdAt: Date;
        }>
      >(
        Prisma.sql`
          SELECT id::text, "productId"::text, "warehouseId"::text,
                 quantity, status, "expiresAt", "createdAt"
          FROM reservations
          WHERE id::text = ${id}
          FOR UPDATE
        `
      );

      if (reservations.length === 0) {
        return { type: "NOT_FOUND" as const };
      }

      const reservation = reservations[0];

      if (reservation.status === "confirmed") {
        return { type: "ALREADY_CONFIRMED" as const, reservation };
      }

      if (reservation.status === "released") {
        return { type: "ALREADY_RELEASED" as const };
      }

      const now = new Date();
      if (reservation.expiresAt < now) {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE inventory
            SET "reservedUnits" = GREATEST(0, "reservedUnits" - ${reservation.quantity}),
                "updatedAt" = NOW()
            WHERE "productId"::text = ${reservation.productId}
              AND "warehouseId"::text = ${reservation.warehouseId}
          `
        );
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE reservations
            SET status = 'released', "updatedAt" = NOW()
            WHERE id::text = ${id}
          `
        );
        return { type: "EXPIRED" as const };
      }

      await tx.$executeRaw(
        Prisma.sql`
          UPDATE inventory
          SET "totalUnits" = GREATEST(0, "totalUnits" - ${reservation.quantity}),
              "reservedUnits" = GREATEST(0, "reservedUnits" - ${reservation.quantity}),
              "updatedAt" = NOW()
          WHERE "productId"::text = ${reservation.productId}
            AND "warehouseId"::text = ${reservation.warehouseId}
        `
      );

      await tx.$executeRaw(
        Prisma.sql`
          UPDATE reservations
          SET status = 'confirmed', "updatedAt" = NOW()
          WHERE id::text = ${id}
        `
      );

      return { type: "SUCCESS" as const, reservation };
    });

    if (result.type === "NOT_FOUND") {
      const body = { error: "Reservation not found" };
      await storeIdempotency(idempotencyKey, endpoint, 404, body);
      return NextResponse.json(body, { status: 404 });
    }

    if (result.type === "ALREADY_RELEASED") {
      const body = { error: "Reservation has already been released", code: "ALREADY_RELEASED" };
      await storeIdempotency(idempotencyKey, endpoint, 409, body);
      return NextResponse.json(body, { status: 409 });
    }

    if (result.type === "EXPIRED") {
      const body = {
        error: "Reservation has expired. The hold has been released.",
        code: "RESERVATION_EXPIRED",
      };
      await storeIdempotency(idempotencyKey, endpoint, 410, body);
      return NextResponse.json(body, { status: 410 });
    }

    const full = await prisma.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });

    if (!full) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    const responseBody: ReservationDetail = {
      id: full.id,
      productId: full.productId,
      productName: full.product.name,
      productSku: full.product.sku,
      productPrice: full.product.price.toString(),
      productImageUrl: full.product.imageUrl,
      warehouseId: full.warehouseId,
      warehouseName: full.warehouse.name,
      warehouseLocation: full.warehouse.location,
      quantity: full.quantity,
      status: full.status as "confirmed",
      expiresAt: full.expiresAt.toISOString(),
      createdAt: full.createdAt.toISOString(),
    };

    await storeIdempotency(idempotencyKey, endpoint, 200, responseBody);
    return NextResponse.json(responseBody, { status: 200 });
  } catch (err) {
    console.error(`[POST /api/reservations/${id}/confirm]`, err);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}
