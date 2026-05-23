/**
 * Concurrency test: fires two simultaneous POST /api/reservations requests
 * for the last unit of SoundWave Pro at Mumbai Central.
 *
 * Expected: exactly one 201, exactly one 409.
 * If both get 201 → oversell bug. If both get 409 → false negative.
 */

const PRODUCT_ID = "10000000-0000-0000-0000-000000000004";
const WAREHOUSE_ID = "00000000-0000-0000-0000-000000000001";
const URL = "http://localhost:3000/api/reservations";

async function tryReserve(label: string): Promise<{ label: string; status: number; body: unknown }> {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `concurrency-test-${label}-${Date.now()}`,
    },
    body: JSON.stringify({
      productId: PRODUCT_ID,
      warehouseId: WAREHOUSE_ID,
      quantity: 1,
    }),
  });
  const body = await res.json();
  return { label, status: res.status, body };
}

async function main() {
  console.log("=".repeat(60));
  console.log("CONCURRENCY TEST: 2 simultaneous requests for 1 last unit");
  console.log("Product: SoundWave Pro Headphones @ Mumbai Central");
  console.log("=".repeat(60));

  // Fire BOTH at the same time using Promise.all
  const [resultA, resultB] = await Promise.all([
    tryReserve("A"),
    tryReserve("B"),
  ]);

  console.log(`\nRequest A: HTTP ${resultA.status}`);
  console.log(JSON.stringify(resultA.body, null, 2));

  console.log(`\nRequest B: HTTP ${resultB.status}`);
  console.log(JSON.stringify(resultB.body, null, 2));

  const statuses = [resultA.status, resultB.status];
  const count201 = statuses.filter((s) => s === 201).length;
  const count409 = statuses.filter((s) => s === 409).length;

  console.log("\n" + "=".repeat(60));
  console.log(`201 (reserved):  ${count201}`);
  console.log(`409 (rejected):  ${count409}`);
  console.log("=".repeat(60));

  if (count201 === 1 && count409 === 1) {
    console.log("RESULT: PASSED ✅  — exactly 1 succeeded, 1 rejected");
    console.log("SELECT FOR UPDATE is correctly serialising concurrent access.");
  } else if (count201 === 2) {
    console.error("RESULT: FAILED ❌  — BOTH requests succeeded (oversell detected!)");
    process.exit(1);
  } else if (count409 === 2) {
    console.warn("RESULT: UNEXPECTED ⚠  — both rejected (is stock actually available?)");
    process.exit(1);
  } else {
    console.error(`RESULT: UNEXPECTED — ${count201} succeeded, ${count409} rejected`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
