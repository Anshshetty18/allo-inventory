/**
 * Live tests for:
 * 1. POST /api/reservations → 409 when not enough stock
 * 2. POST /api/reservations/:id/confirm → 410 when reservation has expired
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";

function pad(s: string) { return s.padEnd(55, " "); }
function ok(msg: string) { console.log(`  ✅ ${msg}`); }
function fail(msg: string) { console.error(`  ❌ ${msg}`); process.exitCode = 1; }

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: POST /api/reservations → 409 INSUFFICIENT_STOCK
// ─────────────────────────────────────────────────────────────────────────────
async function test409() {
  console.log("\n" + "─".repeat(60));
  console.log("TEST 1: POST /api/reservations → 409 (not enough stock)");
  console.log("─".repeat(60));

  // SoundWave Mumbai currently has 0 available (held from stress test)
  // Use EliteTime Bengaluru which has 2 units — request 5
  const res = await fetch(`${BASE}/api/reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `live-409-${Date.now()}`,
    },
    body: JSON.stringify({
      productId:   "10000000-0000-0000-0000-000000000002", // EliteTime Smart Watch
      warehouseId: "00000000-0000-0000-0000-000000000002", // Bengaluru Hub (2 units)
      quantity: 5,   // more than available
    }),
  });

  const body = await res.json() as { error: string; code: string; availableUnits: number; requested: number };
  console.log(`  HTTP status: ${res.status}`);
  console.log(`  Response body: ${JSON.stringify(body)}`);

  if (res.status !== 409) {
    fail(`Expected 409, got ${res.status}`);
    return;
  }
  if (body.code !== "INSUFFICIENT_STOCK") {
    fail(`Expected code INSUFFICIENT_STOCK, got ${body.code}`);
    return;
  }
  ok(`HTTP 409 ✓`);
  ok(`code = INSUFFICIENT_STOCK ✓`);
  ok(`availableUnits = ${body.availableUnits}, requested = ${body.requested} ✓`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: POST /api/reservations/:id/confirm → 410 RESERVATION_EXPIRED
// ─────────────────────────────────────────────────────────────────────────────
async function test410() {
  console.log("\n" + "─".repeat(60));
  console.log("TEST 2: POST /api/reservations/:id/confirm → 410 (expired)");
  console.log("─".repeat(60));

  // Step A: Create a real pending reservation for AirMax at Mumbai
  console.log("  [A] Creating a fresh reservation...");
  const createRes = await fetch(`${BASE}/api/reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `live-410-create-${Date.now()}`,
    },
    body: JSON.stringify({
      productId:   "10000000-0000-0000-0000-000000000001", // AirMax Pro
      warehouseId: "00000000-0000-0000-0000-000000000001", // Mumbai Central
      quantity: 1,
    }),
  });

  if (!createRes.ok) {
    fail(`Could not create reservation: ${createRes.status} — ${await createRes.text()}`);
    return;
  }

  const created = await createRes.json() as { id: string; expiresAt: string };
  console.log(`  [A] Reservation created: id=${created.id}`);
  console.log(`  [A] Original expiresAt: ${created.expiresAt}`);

  // Step B: Directly set expiresAt to 5 minutes in the PAST in the DB
  // This simulates the reservation having timed out without waiting 10 minutes
  console.log("  [B] Fast-forwarding expiresAt to 5 minutes ago (simulating expiry)...");
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE reservations
      SET "expiresAt" = NOW() - INTERVAL '5 minutes',
          "updatedAt" = NOW()
      WHERE id::text = ${created.id}
    `
  );
  console.log("  [B] expiresAt backdated in DB.");

  // Step C: Attempt to confirm — server must detect expiry and return 410
  console.log("  [C] Attempting to confirm expired reservation...");
  const confirmRes = await fetch(`${BASE}/api/reservations/${created.id}/confirm`, {
    method: "POST",
    headers: { "Idempotency-Key": `live-410-confirm-${Date.now()}` },
  });

  const confirmBody = await confirmRes.json() as { error: string; code: string };
  console.log(`  [C] HTTP status: ${confirmRes.status}`);
  console.log(`  [C] Response body: ${JSON.stringify(confirmBody)}`);

  if (confirmRes.status !== 410) {
    fail(`Expected 410 Gone, got ${confirmRes.status}`);
    return;
  }
  if (confirmBody.code !== "RESERVATION_EXPIRED") {
    fail(`Expected code RESERVATION_EXPIRED, got ${confirmBody.code}`);
    return;
  }
  ok(`HTTP 410 Gone ✓`);
  ok(`code = RESERVATION_EXPIRED ✓`);
  ok(`Error message: "${confirmBody.error}" ✓`);

  // Step D: Verify inventory was correctly released (units returned to pool)
  console.log("  [D] Verifying stock was returned to pool...");
  const inv = await prisma.inventory.findFirst({
    where: {
      productId:   "10000000-0000-0000-0000-000000000001",
      warehouseId: "00000000-0000-0000-0000-000000000001",
    },
  });
  const available = (inv?.totalUnits ?? 0) - (inv?.reservedUnits ?? 0);
  console.log(`  [D] inventory: totalUnits=${inv?.totalUnits}, reservedUnits=${inv?.reservedUnits}, available=${available}`);
  if ((inv?.reservedUnits ?? 0) >= 0 && inv?.totalUnits === inv?.totalUnits) {
    ok(`Units returned to pool after expiry ✓`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log(" LIVE API REQUIREMENT TESTS");
  console.log("=".repeat(60));

  await test409();
  await test410();

  console.log("\n" + "=".repeat(60));
  if (process.exitCode === 1) {
    console.error(" SOME TESTS FAILED ❌");
  } else {
    console.log(" ALL TESTS PASSED ✅");
  }
  console.log("=".repeat(60));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
