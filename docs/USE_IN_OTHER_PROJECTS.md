# How to use Pipeline Secrets in other projects

Use this guide when you want **another GitHub repo** (deploy, API, frontend, etc.) to load environment variables from **ci-secrets-manager** instead of storing them in GitHub Actions Secrets.

---

## What you need first

1. **Pipeline Secrets app** deployed on a public HTTPS URL (e.g. `https://ci-secrets-manager.vercel.app` or `https://secrets.yourdomain.com`).
2. A **project** in the dashboard with your secrets saved (e.g. `SERVER_IP`, `DATABASE_URL`).
3. An **API key** (deploy token) — generate on the project **Secrets** page → **Generate API key** → copy `pst_...` once.
4. Your **Project ID** (UUID on the project overview page).

---

## Step 1 — Store secrets in the dashboard

1. Log in to Pipeline Secrets.
2. Create or open a project.
3. Go to **Secrets** and add each variable:

   | Key (example)   | Value              |
   |-----------------|--------------------|
   | `SERVER_IP`     | `203.0.113.50`     |
   | `DATABASE_URL`  | `postgres://...`   |
   | `API_KEY`       | `sk-...`           |

   Key names must be valid env names: `UPPER_SNAKE_CASE`, start with a letter or `_`.

4. Generate an **API key** (optionally set expiry). Copy the token immediately.

---

## Step 2 — Add three secrets in the *other* GitHub repo

In the repo where your workflow runs:

**Settings → Secrets and variables → Actions → New repository secret**

| Name               | Value                                      |
|--------------------|--------------------------------------------|
| `SECRETS_API_URL`  | `https://your-pipeline-secrets-app.com`    |
| `PROJECT_ID`       | `a1c48b35-a501-4d97-bacc-c4851ee9f43e`     |
| `DEPLOY_TOKEN`     | `pst_xxxxxxxx...` (from dashboard)         |

Do **not** put `SERVER_IP` or app secrets here — only these three meta-values.

---

## Step 3 — Add a workflow in the other repo

Create `.github/workflows/fetch-secrets.yml` (or add a step to an existing workflow):

```yaml
name: Deploy with Pipeline Secrets

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

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

      - name: Use secrets in your pipeline
        run: |
          # Every key from the dashboard is available as env.*
          echo "Deploying to server (IP masked in logs)..."
          ssh deploy@${{ env.SERVER_IP }} './deploy.sh'

          # Other examples:
          # curl -H "Authorization: Bearer ${{ env.API_KEY }}" https://api.example.com
          # npm run build  # if DATABASE_URL etc. are in GITHUB_ENV
```

**Order matters:** the fetch step must run **before** any step that uses `env.SERVER_IP` or other keys.

---

## How it works

1. GitHub Actions calls `POST /api/ci/secrets` with `projectId` + `token`.
2. Pipeline Secrets validates the token, decrypts secrets server-side, returns JSON:

   ```json
   {
     "env": {
       "SERVER_IP": "203.0.113.50",
       "DATABASE_URL": "postgres://..."
     }
   }
   ```

3. The script writes each pair to `$GITHUB_ENV`, so later steps use `${{ env.SERVER_IP }}`.

---

## Rules and limits

- **HTTPS only** — GitHub cannot reach `http://localhost:3000`.
- **Key names** in the dashboard = **env names** in the workflow (`SERVER_IP` → `env.SERVER_IP`).
- **API key** is shown once; if lost, generate a new one and update `DEPLOY_TOKEN` in GitHub.
- **Rate limit:** 10 requests per minute per IP on the CI endpoint.
- **Revoke** old API keys in **Deploy tokens** when no longer needed.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `401 Unauthorized` | Wrong `DEPLOY_TOKEN`, revoked token, or expired token |
| `curl: Failed to connect` | `SECRETS_API_URL` wrong or app not deployed publicly |
| `env.SERVER_IP` empty | Fetch step failed, or key name mismatch in dashboard |
| `invalid_credentials` on dashboard | Confirm email before login (Supabase) |

---

## Copy-paste prompt for AI / teammates

```
We use Pipeline Secrets (ci-secrets-manager) for CI environment variables.

App URL: https://YOUR_APP_URL
Project ID: YOUR_PROJECT_UUID

In our GitHub repo we have three Actions secrets:
- SECRETS_API_URL, PROJECT_ID, DEPLOY_TOKEN

Add a workflow step that POSTs to ${SECRETS_API_URL}/api/ci/secrets with
{"projectId":"...","token":"..."}, parses JSON .env with jq, masks values with
::add-mask::, and appends KEY=value to GITHUB_ENV.

Our secrets in the vault include: SERVER_IP, DATABASE_URL, API_KEY.
After the fetch step, use ${{ env.SERVER_IP }} etc. in deploy/SSH/curl steps.
Never echo secret values. Fetch step must run before steps that use the env vars.
```

---

## Example repos

- Full example workflow in this repo: [`.github/workflows/use-pipeline-secrets.yml.example`](../.github/workflows/use-pipeline-secrets.yml.example)
