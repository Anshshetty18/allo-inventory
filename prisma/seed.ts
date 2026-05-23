import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Warehouses ────────────────────────────────────────────────────────────
  const warehouses = await Promise.all([
    prisma.warehouse.upsert({
      where: { id: "00000000-0000-0000-0000-000000000001" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Mumbai Central",
        location: "Mumbai, Maharashtra",
      },
    }),
    prisma.warehouse.upsert({
      where: { id: "00000000-0000-0000-0000-000000000002" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000002",
        name: "Bengaluru Hub",
        location: "Bengaluru, Karnataka",
      },
    }),
    prisma.warehouse.upsert({
      where: { id: "00000000-0000-0000-0000-000000000003" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000003",
        name: "Delhi NCR Depot",
        location: "Gurugram, Haryana",
      },
    }),
  ]);

  console.log(`✅ Created ${warehouses.length} warehouses`);

  // ── Products ──────────────────────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: "SNK-AIR-001" },
      update: { imageUrl: "/products/sneakers.png" },
      create: {
        id: "10000000-0000-0000-0000-000000000001",
        name: "AirMax Pro Sneakers",
        sku: "SNK-AIR-001",
        description:
          "Lightweight performance sneakers with adaptive cushioning and breathable mesh upper. Perfect for daily training.",
        price: 4999.0,
        imageUrl: "/products/sneakers.png",
      },
    }),
    prisma.product.upsert({
      where: { sku: "WATCH-ELITE-002" },
      update: { imageUrl: "/products/smartwatch.png" },
      create: {
        id: "10000000-0000-0000-0000-000000000002",
        name: "EliteTime Smart Watch",
        sku: "WATCH-ELITE-002",
        description:
          "Premium stainless steel smartwatch with health monitoring, GPS, and 7-day battery life. Water-resistant to 50m.",
        price: 12999.0,
        imageUrl: "/products/smartwatch.png",
      },
    }),
    prisma.product.upsert({
      where: { sku: "BAG-TREK-003" },
      update: { imageUrl: "/products/backpack.png" },
      create: {
        id: "10000000-0000-0000-0000-000000000003",
        name: "TrekMate Backpack 45L",
        sku: "BAG-TREK-003",
        description:
          "Durable 45L hiking backpack with ergonomic support, rain cover included, and multiple organisational pockets.",
        price: 3499.0,
        imageUrl: "/products/backpack.png",
      },
    }),
    prisma.product.upsert({
      where: { sku: "HDPH-SOUND-004" },
      update: { imageUrl: "/products/headphones.png" },
      create: {
        id: "10000000-0000-0000-0000-000000000004",
        name: "SoundWave Pro Headphones",
        sku: "HDPH-SOUND-004",
        description:
          "Over-ear noise cancelling headphones with 40hr playtime, Hi-Res Audio certified, and foldable design.",
        price: 8499.0,
        imageUrl: "/products/headphones.png",
      },
    }),
    prisma.product.upsert({
      where: { sku: "CAM-LENS-005" },
      update: { imageUrl: "/products/camera.png" },
      create: {
        id: "10000000-0000-0000-0000-000000000005",
        name: "LensMax DSLR Camera",
        sku: "CAM-LENS-005",
        description:
          "24MP DSLR camera with dual image stabilisation, 4K video, and all-weather sealing. Body only.",
        price: 54999.0,
        imageUrl: "/products/camera.png",
      },
    }),
  ]);

  console.log(`✅ Created ${products.length} products`);

  // ── Inventory (product × warehouse stock levels) ───────────────────────────
  const inventoryData = [
    // AirMax Pro Sneakers
    { productId: products[0].id, warehouseId: warehouses[0].id, totalUnits: 50, reservedUnits: 0 },
    { productId: products[0].id, warehouseId: warehouses[1].id, totalUnits: 30, reservedUnits: 0 },
    { productId: products[0].id, warehouseId: warehouses[2].id, totalUnits: 5,  reservedUnits: 0 }, // Low stock
    // EliteTime Smart Watch
    { productId: products[1].id, warehouseId: warehouses[0].id, totalUnits: 20, reservedUnits: 0 },
    { productId: products[1].id, warehouseId: warehouses[1].id, totalUnits: 2,  reservedUnits: 0 }, // Very low stock
    { productId: products[1].id, warehouseId: warehouses[2].id, totalUnits: 15, reservedUnits: 0 },
    // TrekMate Backpack
    { productId: products[2].id, warehouseId: warehouses[0].id, totalUnits: 80, reservedUnits: 0 },
    { productId: products[2].id, warehouseId: warehouses[2].id, totalUnits: 40, reservedUnits: 0 },
    // SoundWave Pro Headphones
    { productId: products[3].id, warehouseId: warehouses[0].id, totalUnits: 1,  reservedUnits: 0 }, // Last unit!
    { productId: products[3].id, warehouseId: warehouses[1].id, totalUnits: 25, reservedUnits: 0 },
    { productId: products[3].id, warehouseId: warehouses[2].id, totalUnits: 12, reservedUnits: 0 },
    // LensMax DSLR Camera
    { productId: products[4].id, warehouseId: warehouses[0].id, totalUnits: 8,  reservedUnits: 0 },
    { productId: products[4].id, warehouseId: warehouses[1].id, totalUnits: 3,  reservedUnits: 0 },
  ];

  for (const inv of inventoryData) {
    await prisma.inventory.upsert({
      where: {
        productId_warehouseId: {
          productId: inv.productId,
          warehouseId: inv.warehouseId,
        },
      },
      update: { totalUnits: inv.totalUnits, reservedUnits: inv.reservedUnits },
      create: inv,
    });
  }

  console.log(`✅ Created ${inventoryData.length} inventory records`);
  console.log("\n🎉 Seed complete! Database is ready to demo.");
  console.log("\n📝 Interesting scenarios to try:");
  console.log("   • SoundWave Pro at Mumbai (1 unit) — race condition demo");
  console.log("   • EliteTime Watch at Bengaluru (2 units) — low stock");
  console.log("   • AirMax Pro at Delhi NCR (5 units) — limited stock");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
