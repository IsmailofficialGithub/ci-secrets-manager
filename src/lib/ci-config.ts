export function getCiConfigStatus() {
  const masterKey = process.env.MASTER_ENCRYPTION_KEY?.trim();
  let masterKeyOk = false;
  if (masterKey) {
    const hexOk = /^[0-9a-fA-F]{64}$/.test(masterKey);
    const utfOk = Buffer.from(masterKey, "utf8").length === 32;
    masterKeyOk = hexOk || utfOk;
  }

  return {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    masterEncryptionKey: masterKeyOk,
    upstashRedis: Boolean(
      process.env.UPSTASH_REDIS_REST_URL?.trim() &&
        process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
    ),
  };
}

export function isCiFullyConfigured(): boolean {
  const s = getCiConfigStatus();
  return (
    s.supabaseUrl &&
    s.serviceRoleKey &&
    s.masterEncryptionKey &&
    s.upstashRedis
  );
}
