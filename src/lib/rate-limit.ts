import { NextResponse } from "next/server";

type RateLimitOptions = {
  name: string;
  limit: number;
  windowMs: number;
  key?: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const entries = new Map<string, RateLimitEntry>();

function getClientAddress(request: Request): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function evictExpiredEntries(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) {
      entries.delete(key);
    }
  }

  if (entries.size > 10_000) {
    const oldestKey = entries.keys().next().value;
    if (oldestKey) {
      entries.delete(oldestKey);
    }
  }
}

export function enforceRateLimit(
  request: Request,
  options: RateLimitOptions
): NextResponse | null {
  const now = Date.now();
  evictExpiredEntries(now);
  const key = `${options.name}:${getClientAddress(request)}:${options.key || ""}`;
  const existing = entries.get(key);

  if (!existing || existing.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  existing.count += 1;
  if (existing.count <= options.limit) {
    return null;
  }

  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
      },
    }
  );
}

export function resetRateLimitsForTests(): void {
  entries.clear();
}
