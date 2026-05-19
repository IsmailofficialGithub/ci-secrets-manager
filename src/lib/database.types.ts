export type DeployTokenRow = {
  id: string;
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type SecretRow = {
  key: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
};
