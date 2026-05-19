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
    console.warn(
      "ratelimit_skipped: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set",
    );
    return { success: true, remaining: 999, skipped: true };
  }

  try {
    const result = await getRatelimit().limit(ip);
    return {
      success: result.success,
      remaining: result.remaining,
    };
  } catch (err) {
    console.error(
      "ratelimit_error",
      err instanceof Error ? err.message : err,
    );
    // Do not fail secret fetch when Redis is down — log and continue
    return { success: true, remaining: 999, skipped: true };
  }
}
