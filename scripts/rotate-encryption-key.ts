import { config } from "dotenv";

config({ path: ".env.local" });

import { rotateEncryptionKey } from "../src/lib/encryption";
import { createAdminSupabaseClient } from "../src/lib/supabase-admin";

async function main() {
  const oldKey = process.env.OLD_MASTER_ENCRYPTION_KEY;
  const newKey = process.env.NEW_MASTER_ENCRYPTION_KEY;

  if (!oldKey || !newKey) {
    console.error(
      "Set OLD_MASTER_ENCRYPTION_KEY and NEW_MASTER_ENCRYPTION_KEY before running.",
    );
    process.exit(1);
  }

  const admin = createAdminSupabaseClient();
  const result = await rotateEncryptionKey(oldKey, newKey, admin);
  console.log(`Rotated ${result.rotated} secret(s) successfully.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "Rotation failed");
  process.exit(1);
});
