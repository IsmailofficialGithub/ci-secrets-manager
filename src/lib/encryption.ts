import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export type EncryptedPayload = {
  encrypted_value: string;
  iv: string;
  auth_tag: string;
};

export function parseMasterKey(keyMaterial: string): Buffer {
  const trimmed = keyMaterial.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  const buf = Buffer.from(trimmed, "utf8");
  if (buf.length !== 32) {
    throw new Error(
      "MASTER_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars or 32 UTF-8 characters)",
    );
  }
  return buf;
}

export function getMasterKey(): Buffer {
  const raw = process.env.MASTER_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("MASTER_ENCRYPTION_KEY is not set");
  }
  return parseMasterKey(raw);
}

function encryptWithKey(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted_value: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    auth_tag: authTag.toString("hex"),
  };
}

function decryptWithKey(
  encrypted_value: string,
  iv: string,
  auth_tag: string,
  key: Buffer,
): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(auth_tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted_value, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function encrypt(plaintext: string): EncryptedPayload {
  return encryptWithKey(plaintext, getMasterKey());
}

export function decrypt(
  encrypted_value: string,
  iv: string,
  auth_tag: string,
): string {
  return decryptWithKey(encrypted_value, iv, auth_tag, getMasterKey());
}

type SecretRow = {
  id: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
};

export async function rotateEncryptionKey(
  oldKeyMaterial: string,
  newKeyMaterial: string,
  supabaseAdmin: SupabaseClient,
): Promise<{ rotated: number }> {
  const oldKey = parseMasterKey(oldKeyMaterial);
  const newKey = parseMasterKey(newKeyMaterial);

  const { data: rows, error } = await supabaseAdmin
    .from("project_secrets")
    .select("id, encrypted_value, iv, auth_tag");

  if (error) {
    throw new Error(`Failed to fetch secrets: ${error.message}`);
  }

  const secrets = (rows ?? []) as SecretRow[];
  const updatedIds: string[] = [];

  try {
    for (const row of secrets) {
      const plaintext = decryptWithKey(
        row.encrypted_value,
        row.iv,
        row.auth_tag,
        oldKey,
      );
      const reencrypted = encryptWithKey(plaintext, newKey);

      const { error: updateError } = await supabaseAdmin
        .from("project_secrets")
        .update({
          encrypted_value: reencrypted.encrypted_value,
          iv: reencrypted.iv,
          auth_tag: reencrypted.auth_tag,
        })
        .eq("id", row.id);

      if (updateError) {
        throw new Error(
          `Failed to update secret ${row.id}: ${updateError.message}`,
        );
      }
      updatedIds.push(row.id);
    }
  } catch (err) {
    throw new Error(
      `Rotation aborted after ${updatedIds.length}/${secrets.length} secrets. Re-run after fixing the issue. ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { rotated: secrets.length };
}
