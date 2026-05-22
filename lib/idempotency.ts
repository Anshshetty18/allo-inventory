import { redis } from "./redis";
import { NextResponse } from "next/server";

const IDEMPOTENCY_TTL = 60 * 60 * 24; // 24 hours

interface IdempotencyRecord {
  status: number;
  body: unknown;
}

/**
 * Build the Redis key for an idempotency entry.
 */
function buildKey(idempotencyKey: string, endpoint: string): string {
  return `idempotency:${endpoint}:${idempotencyKey}`;
}

/**
 * Check if a response for this idempotency key already exists.
 * Returns the cached NextResponse or null.
 */
export async function checkIdempotency(
  idempotencyKey: string | null,
  endpoint: string
): Promise<NextResponse | null> {
  if (!idempotencyKey) return null;

  const key = buildKey(idempotencyKey, endpoint);
  const cached = await redis.get<IdempotencyRecord>(key);

  if (!cached) return null;

  return NextResponse.json(cached.body, { status: cached.status });
}

/**
 * Store a response in the idempotency cache.
 */
export async function storeIdempotency(
  idempotencyKey: string | null,
  endpoint: string,
  status: number,
  body: unknown
): Promise<void> {
  if (!idempotencyKey) return;

  const key = buildKey(idempotencyKey, endpoint);
  await redis.set<IdempotencyRecord>(key, { status, body }, { ex: IDEMPOTENCY_TTL });
}
