-- Encrypted CI/CD Secrets Manager — initial schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Encrypted secrets (values stored as AES-256-GCM ciphertext + iv + auth_tag)
CREATE TABLE project_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

CREATE INDEX idx_project_secrets_project_id ON project_secrets(project_id);

-- Deploy tokens (plain token never stored — only SHA-256 hash)
CREATE TABLE deploy_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_deploy_tokens_project_id ON deploy_tokens(project_id);
CREATE INDEX idx_deploy_tokens_token_hash ON deploy_tokens(token_hash);

-- Audit logs (CI fetch attempts — no secret values)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  token_id UUID REFERENCES deploy_tokens(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_project_created ON audit_logs(project_id, created_at DESC);

-- Auto-update updated_at on project_secrets
CREATE OR REPLACE FUNCTION set_project_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_secrets_updated_at
  BEFORE UPDATE ON project_secrets
  FOR EACH ROW
  EXECUTE FUNCTION set_project_secrets_updated_at();

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE deploy_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Projects: owner only
CREATE POLICY projects_select ON projects
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY projects_insert ON projects
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY projects_update ON projects
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY projects_delete ON projects
  FOR DELETE USING (user_id = auth.uid());

-- Project secrets: owner via project join
CREATE POLICY secrets_select ON project_secrets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_secrets.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY secrets_insert ON project_secrets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_secrets.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY secrets_update ON project_secrets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_secrets.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY secrets_delete ON project_secrets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_secrets.project_id AND p.user_id = auth.uid()
    )
  );

-- Deploy tokens: owner via project join
CREATE POLICY deploy_tokens_select ON deploy_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = deploy_tokens.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY deploy_tokens_insert ON deploy_tokens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = deploy_tokens.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY deploy_tokens_update ON deploy_tokens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = deploy_tokens.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY deploy_tokens_delete ON deploy_tokens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = deploy_tokens.project_id AND p.user_id = auth.uid()
    )
  );

-- Audit logs: owners can read their project's logs; inserts via service role only
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (
    project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = audit_logs.project_id AND p.user_id = auth.uid()
    )
  );
