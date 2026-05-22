import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ProductWithStock, WarehouseStock } from "@/schemas";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventory: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const result: ProductWithStock[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      price: product.price.toString(),
      imageUrl: product.imageUrl,
      warehouses: product.inventory.map(
        (inv): WarehouseStock => ({
          warehouseId: inv.warehouseId,
          warehouseName: inv.warehouse.name,
          warehouseLocation: inv.warehouse.location,
          totalUnits: inv.totalUnits,
          reservedUnits: inv.reservedUnits,
          availableUnits: Math.max(0, inv.totalUnits - inv.reservedUnits),
        })
      ),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
