import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null = null;

function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function getRatelimit(): Ratelimit {
  if (ratelimit) {
    return ratelimit;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "ci-secrets",
  });

  return ratelimit;
}

export async function checkRateLimit(
  ip: string,
): Promise<{ success: boolean; remaining: number; skipped?: boolean }> {
  if (!isUpstashConfigured()) {
    if (process.env.NODE_ENV === "development") {
      return { success: true, remaining: 999, skipped: true };
    }
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production",
    );
  }

  try {
    const result = await getRatelimit().limit(ip);
    return {
      success: result.success,
      remaining: result.remaining,
    };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("ratelimit_unavailable", err instanceof Error ? err.message : err);
      return { success: true, remaining: 999, skipped: true };
    }
    throw err;
  }
}
