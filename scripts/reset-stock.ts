import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Reset SoundWave Mumbai back to 1 available unit
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE inventory
      SET "reservedUnits" = 0, "updatedAt" = NOW()
      WHERE "productId"::text = ${"10000000-0000-0000-0000-000000000004"}
        AND "warehouseId"::text = ${"00000000-0000-0000-0000-000000000001"}
    `
  );
  // Mark any pending reservations for this SKU/warehouse as released
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE reservations
      SET status = 'released', "updatedAt" = NOW()
      WHERE "productId"::text = ${"10000000-0000-0000-0000-000000000004"}
        AND "warehouseId"::text = ${"00000000-0000-0000-0000-000000000001"}
        AND status = 'pending'
    `
  );

  // Verify
  const inv = await prisma.inventory.findFirst({
    where: {
      productId: "10000000-0000-0000-0000-000000000004",
      warehouseId: "00000000-0000-0000-0000-000000000001",
    },
  });
  console.log(
    `SoundWave Mumbai: totalUnits=${inv?.totalUnits} reservedUnits=${inv?.reservedUnits} available=${(inv?.totalUnits ?? 0) - (inv?.reservedUnits ?? 0)}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
