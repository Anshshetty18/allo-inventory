import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ReservationDetail } from "@/schemas";
import { Prisma } from "@prisma/client";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

      if (reservation.status === "released") {
        return { type: "ALREADY_RELEASED" as const };
      }

      if (reservation.status === "confirmed") {
        return { type: "ALREADY_CONFIRMED" as const };
      }

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

      return { type: "SUCCESS" as const, reservation };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (result.type === "ALREADY_RELEASED") {
      return NextResponse.json({ error: "Reservation already released" }, { status: 409 });
    }

    if (result.type === "ALREADY_CONFIRMED") {
      return NextResponse.json(
        { error: "Cannot release a confirmed reservation" },
        { status: 409 }
      );
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
      status: full.status as "released",
      expiresAt: full.expiresAt.toISOString(),
      createdAt: full.createdAt.toISOString(),
    };

    return NextResponse.json(responseBody, { status: 200 });
  } catch (err) {
    console.error(`[POST /api/reservations/${id}/release]`, err);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
