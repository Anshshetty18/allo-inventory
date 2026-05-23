import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Vercel Cron Job: runs every 5 minutes.
 * Sweeps expired pending reservations and releases held units back to inventory.
 * vercel.json schedule: every-5-minutes ("star-slash-5 star star star star")
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const expired = await prisma.reservation.findMany({
      where: {
        status: "pending",
        expiresAt: { lt: now },
      },
      select: {
        id: true,
        productId: true,
        warehouseId: true,
        quantity: true,
      },
    });

    if (expired.length === 0) {
      return NextResponse.json({ released: 0, message: "No expired reservations" });
    }

    await prisma.$transaction(async (tx) => {
      for (const res of expired) {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE inventory
            SET "reservedUnits" = GREATEST(0, "reservedUnits" - ${res.quantity}),
                "updatedAt" = NOW()
            WHERE "productId"::text = ${res.productId}
              AND "warehouseId"::text = ${res.warehouseId}
          `
        );
      }

      await tx.reservation.updateMany({
        where: { id: { in: expired.map((r) => r.id) } },
        data: { status: "released" },
      });
    });

    console.log(`[CRON] Released ${expired.length} expired reservations`);

    return NextResponse.json({
      released: expired.length,
      ids: expired.map((r) => r.id),
    });
  } catch (err) {
    console.error("[CRON /expire-reservations]", err);
    return NextResponse.json(
      { error: "Cron job failed", details: String(err) },
      { status: 500 }
    );
  }
}
