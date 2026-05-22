import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";
import { CreateReservationSchema } from "@/schemas";
import type { ReservationDetail } from "@/schemas";
import { Prisma } from "@prisma/client";

const RESERVATION_WINDOW_MINUTES = 10;

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const endpoint = "POST /api/reservations";

  // ── 1. Check idempotency cache ──────────────────────────────────────────────
  const cached = await checkIdempotency(idempotencyKey, endpoint);
  if (cached) return cached;

  // ── 2. Parse + validate request body ────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;

  // ── 3. Reserve units atomically using SELECT FOR UPDATE ──────────────────────
  // The FOR UPDATE lock prevents two concurrent transactions from both reading
  // availableUnits = 1, both deciding to proceed, and both creating a reservation
  // (overselling). Only one transaction holds the lock at a time; the second
  // blocks until the first commits, then re-reads the updated reservedUnits.
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the inventory row for this product/warehouse.
      // We cast the UUID columns to text for comparison with the string parameter.
      const inventoryRows = await tx.$queryRaw<
        Array<{
          id: string;
          totalUnits: number;
          reservedUnits: number;
        }>
      >(
        Prisma.sql`
          SELECT id::text, "totalUnits", "reservedUnits"
          FROM inventory
          WHERE "productId"::text = ${productId}
            AND "warehouseId"::text = ${warehouseId}
          FOR UPDATE
        `
      );

      if (inventoryRows.length === 0) {
        return { type: "NOT_FOUND" as const };
      }

      const inv = inventoryRows[0];
      const availableUnits = inv.totalUnits - inv.reservedUnits;

      if (availableUnits < quantity) {
        return {
          type: "INSUFFICIENT_STOCK" as const,
          availableUnits,
        };
      }

      // Increment reserved units atomically
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE inventory
          SET "reservedUnits" = "reservedUnits" + ${quantity},
              "updatedAt" = NOW()
          WHERE id::text = ${inv.id}
        `
      );

      // Create the reservation record
      const expiresAt = new Date(
        Date.now() + RESERVATION_WINDOW_MINUTES * 60 * 1000
      );
      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          expiresAt,
          idempotencyKey,
          status: "pending",
        },
        include: {
          product: true,
          warehouse: true,
        },
      });

      return { type: "SUCCESS" as const, reservation };
    });

    // ── 4. Handle transaction result ───────────────────────────────────────────
    if (result.type === "NOT_FOUND") {
      const respBody = {
        error: "No inventory found for this product/warehouse combination",
      };
      await storeIdempotency(idempotencyKey, endpoint, 404, respBody);
      return NextResponse.json(respBody, { status: 404 });
    }

    if (result.type === "INSUFFICIENT_STOCK") {
      const respBody = {
        error: "Not enough stock available",
        availableUnits: result.availableUnits,
        requested: quantity,
        code: "INSUFFICIENT_STOCK",
      };
      await storeIdempotency(idempotencyKey, endpoint, 409, respBody);
      return NextResponse.json(respBody, { status: 409 });
    }

    const { reservation } = result;
    const responseBody: ReservationDetail = {
      id: reservation.id,
      productId: reservation.productId,
      productName: reservation.product.name,
      productSku: reservation.product.sku,
      productPrice: reservation.product.price.toString(),
      warehouseId: reservation.warehouseId,
      warehouseName: reservation.warehouse.name,
      warehouseLocation: reservation.warehouse.location,
      quantity: reservation.quantity,
      status: reservation.status as "pending",
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
    };

    await storeIdempotency(idempotencyKey, endpoint, 201, responseBody);
    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    console.error("[POST /api/reservations]", err);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}
