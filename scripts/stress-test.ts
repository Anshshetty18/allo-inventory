/**
 * Stress test: 5 simultaneous requests race for the LAST unit.
 * Exactly 1 must succeed (201). All others must get 409.
 */

const PRODUCT_ID   = "10000000-0000-0000-0000-000000000004";
const WAREHOUSE_ID = "00000000-0000-0000-0000-000000000001";
const URL = "http://localhost:3000/api/reservations";
const CONCURRENT = 5;

async function tryReserve(label: string) {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `stress-${label}-${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify({ productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 1 }),
  });
  const body = await res.json();
  return { label, status: res.status, body };
}

async function main() {
  console.log("=".repeat(60));
  console.log(`STRESS TEST: ${CONCURRENT} simultaneous requests for 1 last unit`);
  console.log("=".repeat(60) + "\n");

  const requests = Array.from({ length: CONCURRENT }, (_, i) =>
    tryReserve(String.fromCharCode(65 + i))   // A, B, C, D, E
  );

  const results = await Promise.all(requests);

  results.forEach((r) => {
    const icon = r.status === 201 ? "✅ 201" : "❌ 409";
    const detail = r.status === 201
      ? `id=${(r.body as { id: string }).id}`
      : (r.body as { error: string }).error;
    console.log(`  Request ${r.label}: ${icon}  ${detail}`);
  });

  const count201 = results.filter((r) => r.status === 201).length;
  const count409 = results.filter((r) => r.status === 409).length;

  console.log("\n" + "=".repeat(60));
  console.log(`201 (reserved):  ${count201}  (expected: 1)`);
  console.log(`409 (rejected):  ${count409}  (expected: ${CONCURRENT - 1})`);
  console.log("=".repeat(60));

  if (count201 === 1 && count409 === CONCURRENT - 1) {
    console.log(`STRESS TEST: PASSED ✅  — exactly 1/${CONCURRENT} succeeded`);
  } else if (count201 > 1) {
    console.error(`STRESS TEST: FAILED ❌  — ${count201} succeeded (OVERSELL!)`);
    process.exit(1);
  } else {
    console.error(`STRESS TEST: UNEXPECTED — ${count201} succeeded, ${count409} rejected`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
