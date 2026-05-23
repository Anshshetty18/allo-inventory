/**
 * Live idempotency test for:
 * 1. POST /api/reservations  — same key → same reservation returned, no duplicate hold
 * 2. POST /api/reservations/:id/confirm — same key → same confirmed response, no double-deduct
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";

function section(title: string) {
  console.log("\n" + "─".repeat(62));
  console.log(title);
  console.log("─".repeat(62));
}
function ok(msg: string)   { console.log(`  ✅ ${msg}`); }
function fail(msg: string) { console.error(`  ❌ ${msg}`); process.exitCode = 1; }

// ─────────────────────────────────────────────────────────────────────────────
async function testReserveIdempotency() {
  section("TEST 1: POST /api/reservations  — idempotency");

  const key = `idempotency-reserve-test-${Date.now()}`;
  const payload = JSON.stringify({
    productId:   "10000000-0000-0000-0000-000000000003", // TrekMate Backpack (80 units, plenty)
    warehouseId: "00000000-0000-0000-0000-000000000001", // Mumbai Central
    quantity: 1,
  });

  // First call — should create a real reservation
  console.log(`  [1] First call  (key=${key.slice(-12)}...)`);
  const r1 = await fetch(`${BASE}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: payload,
  });
  const b1 = await r1.json() as { id: string; status: string; reservedUnits?: number };
  console.log(`      HTTP ${r1.status}  id=${b1.id}  status=${b1.status}`);

  if (r1.status !== 201) { fail(`Expected 201, got ${r1.status}`); return; }
  ok("First call → 201 Created ✓");

  // Read reservedUnits right now
  const inv1 = await prisma.inventory.findFirst({
    where: { productId: "10000000-0000-0000-0000-000000000003", warehouseId: "00000000-0000-0000-0000-000000000001" },
  });
  const reserved1 = inv1?.reservedUnits ?? 0;
  console.log(`  [2] reservedUnits in DB after 1st call: ${reserved1}`);

  // Second call — SAME Idempotency-Key — must return identical response, no DB change
  console.log(`  [3] Second call (SAME key, retry)`);
  const r2 = await fetch(`${BASE}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: payload,
  });
  const b2 = await r2.json() as { id: string; status: string };
  console.log(`      HTTP ${r2.status}  id=${b2.id}  status=${b2.status}`);

  if (r2.status !== 201) { fail(`Replay should return 201, got ${r2.status}`); return; }
  ok("Second call → 201 (from cache, not a new DB write) ✓");

  // IDs must be identical
  if (b1.id !== b2.id) { fail(`IDs differ: ${b1.id} vs ${b2.id} — duplicate reservation created!`); return; }
  ok(`Reservation IDs identical (${b1.id.slice(0, 8)}…) ✓`);

  // reservedUnits must NOT have changed
  const inv2 = await prisma.inventory.findFirst({
    where: { productId: "10000000-0000-0000-0000-000000000003", warehouseId: "00000000-0000-0000-0000-000000000001" },
  });
  const reserved2 = inv2?.reservedUnits ?? 0;
  console.log(`  [4] reservedUnits in DB after 2nd call: ${reserved2}`);

  if (reserved2 !== reserved1) {
    fail(`reservedUnits changed from ${reserved1} → ${reserved2} (side effect repeated!)`);
    return;
  }
  ok(`reservedUnits unchanged (${reserved1} → ${reserved2}) — no duplicate hold ✓`);

  // Third call — DIFFERENT key — must create a NEW reservation
  const key2 = `idempotency-reserve-test-different-${Date.now()}`;
  console.log(`  [5] Third call  (DIFFERENT key)`);
  const r3 = await fetch(`${BASE}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key2 },
    body: payload,
  });
  const b3 = await r3.json() as { id: string };
  console.log(`      HTTP ${r3.status}  id=${b3.id}`);

  if (r3.status !== 201) { fail(`Different key should create new reservation, got ${r3.status}`); return; }
  if (b3.id === b1.id)   { fail(`Different key returned same reservation ID!`); return; }
  ok(`Different key → new reservation (${b3.id.slice(0, 8)}…) ✓`);

  return b1.id; // Return reservation ID for confirm test
}

// ─────────────────────────────────────────────────────────────────────────────
async function testConfirmIdempotency(reservationId: string) {
  section("TEST 2: POST /api/reservations/:id/confirm — idempotency");

  const key = `idempotency-confirm-test-${Date.now()}`;

  // Read totalUnits before confirm
  const inv1 = await prisma.inventory.findFirst({
    where: { productId: "10000000-0000-0000-0000-000000000003", warehouseId: "00000000-0000-0000-0000-000000000001" },
  });
  const total1 = inv1?.totalUnits ?? 0;
  console.log(`  [1] totalUnits before confirm: ${total1}`);

  // First confirm
  console.log(`  [2] First confirm (key=${key.slice(-12)}...)`);
  const c1 = await fetch(`${BASE}/api/reservations/${reservationId}/confirm`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
  });
  const cb1 = await c1.json() as { status: string; id: string };
  console.log(`      HTTP ${c1.status}  status=${cb1.status}`);

  if (c1.status !== 200) { fail(`Expected 200, got ${c1.status}`); return; }
  ok("First confirm → 200 OK ✓");

  const inv2 = await prisma.inventory.findFirst({
    where: { productId: "10000000-0000-0000-0000-000000000003", warehouseId: "00000000-0000-0000-0000-000000000001" },
  });
  const total2 = inv2?.totalUnits ?? 0;
  console.log(`  [3] totalUnits after first confirm: ${total2} (decremented by 1)`);

  if (total2 !== total1 - 1) { fail(`totalUnits should be ${total1 - 1}, got ${total2}`); return; }
  ok(`totalUnits decremented correctly (${total1} → ${total2}) ✓`);

  // Second confirm — SAME key → cached, must NOT decrement again
  console.log(`  [4] Second confirm (SAME key — retry)`);
  const c2 = await fetch(`${BASE}/api/reservations/${reservationId}/confirm`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
  });
  const cb2 = await c2.json() as { status: string };
  console.log(`      HTTP ${c2.status}  status=${cb2.status}`);

  if (c2.status !== 200) { fail(`Replay should return 200, got ${c2.status}`); return; }
  ok("Second confirm → 200 (from cache) ✓");

  const inv3 = await prisma.inventory.findFirst({
    where: { productId: "10000000-0000-0000-0000-000000000003", warehouseId: "00000000-0000-0000-0000-000000000001" },
  });
  const total3 = inv3?.totalUnits ?? 0;
  console.log(`  [5] totalUnits after second confirm: ${total3}`);

  if (total3 !== total2) {
    fail(`totalUnits changed again (${total2} → ${total3}) — stock double-deducted!`);
    return;
  }
  ok(`totalUnits unchanged on retry (${total2} → ${total3}) — no double-deduct ✓`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(62));
  console.log(" IDEMPOTENCY LIVE TESTS");
  console.log("=".repeat(62));

  const reservationId = await testReserveIdempotency();
  if (reservationId) await testConfirmIdempotency(reservationId);

  console.log("\n" + "=".repeat(62));
  if (process.exitCode === 1) {
    console.error(" SOME TESTS FAILED ❌");
  } else {
    console.log(" ALL IDEMPOTENCY TESTS PASSED ✅");
  }
  console.log("=".repeat(62));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
