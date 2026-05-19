import { createHash, randomBytes, timingSafeEqual } from "crypto";

const TOKEN_PREFIX = "pst_";

export function generateToken(): string {
  const raw = randomBytes(32).toString("base64url");
  return `${TOKEN_PREFIX}${raw}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifyToken(plainToken: string, storedHashHex: string): boolean {
  const computed = hashToken(plainToken);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(storedHashHex, "hex");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
