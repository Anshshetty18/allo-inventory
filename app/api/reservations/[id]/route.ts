import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ReservationDetail } from "@/schemas";
import { Prisma } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    // Lazy expiry check: if pending and expired, release atomically
    const now = new Date();
    if (reservation.status === "pending" && reservation.expiresAt < now) {
      await prisma.$transaction(async (tx) => {
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
            UPDATE reservations SET status = 'released', "updatedAt" = NOW() WHERE id::text = ${id}
          `
        );
      });
      reservation.status = "released";
    }

    const responseBody: ReservationDetail = {
      id: reservation.id,
      productId: reservation.productId,
      productName: reservation.product.name,
      productSku: reservation.product.sku,
      productPrice: reservation.product.price.toString(),
      productImageUrl: reservation.product.imageUrl,
      warehouseId: reservation.warehouseId,
      warehouseName: reservation.warehouse.name,
      warehouseLocation: reservation.warehouse.location,
      quantity: reservation.quantity,
      status: reservation.status as ReservationDetail["status"],
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
    };

    return NextResponse.json(responseBody);
  } catch (err) {
    console.error(`[GET /api/reservations/${id}]`, err);
    return NextResponse.json(
      { error: "Failed to fetch reservation" },
      { status: 500 }
    );
  }
}
