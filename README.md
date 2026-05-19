# Pipeline Secrets

Encrypted secrets manager for CI/CD. Store project secrets encrypted at rest, manage them from a web dashboard, and fetch decrypted values in GitHub Actions using deploy tokens — without GitHub Actions Secrets/Variables.

## Stack

- Next.js App Router (TypeScript)
- Supabase (Postgres, Auth, RLS)
- AES-256-GCM encryption (Node `crypto`)
- Upstash Redis rate limiting
- Deploy tokens (SHA-256 hash only in DB)

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Enable **Email** auth provider (Authentication → Providers).
3. Under **Authentication → URL configuration**, set:
   - **Site URL:** `http://localhost:3000` (or your production URL)
   - **Redirect URLs:** `http://localhost:3000/auth/callback` (add production URL when deployed)
4. **Confirm email** is enabled by default — users must click the verification link before sign-in works. Use **Resend verification email** on the login page if needed. For local dev only, you can disable “Confirm email” under Authentication → Providers → Email.
5. Run the migration in the SQL editor:

   ```bash
   # Contents of supabase/migrations/001_initial.sql
   ```

   Or with the Supabase CLI: `supabase db push`

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only — CI route & rotation script) |
| `MASTER_ENCRYPTION_KEY` | 32-byte encryption key (see below) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

### 3. Generate `MASTER_ENCRYPTION_KEY`

Must be **exactly 32 bytes**. Recommended (64 hex characters):

```bash
openssl rand -hex 32
```

Paste the output into `MASTER_ENCRYPTION_KEY`. Alternatively, any 32-character UTF-8 string works.

**Never commit this key or expose it to the browser.**

### 4. Upstash Redis

1. Create a database at [console.upstash.com](https://console.upstash.com).
2. Copy the REST URL and token into `.env.local`.

### 5. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, create a project, add secrets, and generate a deploy token.

### 6. Deploy to Vercel

1. Import the repo in Vercel.
2. Add all environment variables from `.env.local`.
3. Deploy. Use your production URL as `SECRETS_API_URL` in GitHub.

## GitHub Actions

Full guide: **[docs/USE_IN_OTHER_PROJECTS.md](docs/USE_IN_OTHER_PROJECTS.md)**

### Use secrets in another repository (e.g. `SERVER_IP`)

**1. In Pipeline Secrets (dashboard)**

1. Open your project → **Secrets**.
2. Add a secret with key **`SERVER_IP`** (or any `UPPER_SNAKE_CASE` name) and your server IP as the value.
3. Click **Generate API key** → choose **GitHub Actions** → copy the token once.

**2. In the GitHub repo where your pipeline runs**

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name        | Value |
|--------------------|--------|
| `SECRETS_API_URL`  | Public URL of this app, e.g. `https://your-app.vercel.app` (not `localhost`) |
| `PROJECT_ID`       | Project UUID from Pipeline Secrets |
| `DEPLOY_TOKEN`     | The `pst_...` token you copied |

**3. Add a workflow** (copy [`.github/workflows/use-pipeline-secrets.yml.example`](.github/workflows/use-pipeline-secrets.yml.example) into that repo as `use-pipeline-secrets.yml`).

The fetch step loads all project secrets into the job environment. If you saved `SERVER_IP`, later steps use it as `${{ env.SERVER_IP }}`:

```yaml
- name: Fetch secrets from Pipeline Secrets
  env:
    SECRETS_API_URL: ${{ secrets.SECRETS_API_URL }}
    PROJECT_ID: ${{ secrets.PROJECT_ID }}
    DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
  run: |
    set -euo pipefail
    response=$(curl -sS -f -X POST "${SECRETS_API_URL}/api/ci/secrets" \
      -H "Content-Type: application/json" \
      -d "{\"projectId\":\"${PROJECT_ID}\",\"token\":\"${DEPLOY_TOKEN}\"}")
    echo "$response" | jq -r '.env | to_entries[] | "\(.key)=\(.value)"' | while IFS= read -r line; do
      key="${line%%=*}"
      value="${line#*=}"
      echo "::add-mask::${value}"
      echo "${key}=${value}" >> "$GITHUB_ENV"
    done

- name: Use server IP
  run: |
    ssh deploy@${{ env.SERVER_IP }} './deploy.sh'
```

**Important:** GitHub Actions runners cannot call `http://localhost:3000`. Deploy Pipeline Secrets to Vercel (or use a tunnel) and set `SECRETS_API_URL` to that HTTPS URL.

### Meta-secrets for this repo

Add these **GitHub repository secrets** (meta-secrets only — not your app secrets):

- `SECRETS_API_URL` — e.g. `https://your-app.vercel.app`
- `PROJECT_ID` — UUID from the project overview page
- `DEPLOY_TOKEN` — plain token shown once when generated

See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for a full example. The workflow:

1. POSTs to `/api/ci/secrets`
2. Parses the `env` object with `jq`
3. Writes each key to `$GITHUB_ENV`
4. Masks values with `::add-mask::`

## Security model

- Secrets are **encrypted** (AES-256-GCM), not hashed — CI needs plaintext.
- Fresh 12-byte IV on every encrypt; `iv` and `auth_tag` stored as hex.
- Deploy tokens: plain token shown once; only SHA-256 hash stored.
- Token verification uses `timingSafeEqual`.
- CI endpoint: 10 req/min/IP (Upstash), audit log per attempt, no secret values logged.
- RLS: users only access their own projects; CI uses service role server-side only.

## Key rotation

When rotating `MASTER_ENCRYPTION_KEY`:

1. Generate a new key: `openssl rand -hex 32`
2. Set env vars locally or in CI:

   ```bash
   export OLD_MASTER_ENCRYPTION_KEY="<current key>"
   export NEW_MASTER_ENCRYPTION_KEY="<new key>"
   export NEXT_PUBLIC_SUPABASE_URL="..."
   export SUPABASE_SERVICE_ROLE_KEY="..."
   ```

3. Run the rotation script:

   ```bash
   npm run rotate-key
   ```

4. Update `MASTER_ENCRYPTION_KEY` in Vercel to the new key.
5. Remove `OLD_MASTER_ENCRYPTION_KEY` from anywhere it was set.
6. Verify CI fetch still returns correct values.

The script decrypts every row with the old key and re-encrypts with a fresh IV under the new key.

## API reference

### `POST /api/ci/secrets`

For CI/CD only. No session cookie — uses deploy token.

**Body:**

```json
{
  "projectId": "uuid",
  "token": "pst_..."
}
```

**Response (200):**

```json
{
  "env": {
    "DATABASE_URL": "...",
    "API_KEY": "..."
  }
}
```

**Errors:** `400` invalid input, `401` unauthorized token, `429` rate limited, `500` server error.

## Project structure

```
src/
  app/           # Pages and API routes
  lib/           # encryption, tokens, supabase, ratelimit, audit
  components/    # Dashboard UI
supabase/migrations/
scripts/         # Key rotation CLI
.github/workflows/
```

## License

MIT
