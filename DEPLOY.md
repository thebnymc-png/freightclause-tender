# Deploying FreightClause Tender

Same shape as FreightClause: **Cloudflare Pages (frontend)** + **Fly.io (Express backend + SQLite + Litestream)**.

```
 ┌────────────────────────┐        HTTPS         ┌──────────────────────────┐
 │  Cloudflare Pages      │ ───────────────────► │  Fly.io (syd region)     │
 │  dist/public           │                      │  Express + SQLite        │
 │  VITE_API_BASE = api…  │                      │  /data/data.db (volume)  │
 └────────────────────────┘                      │  Litestream → R2/S3      │
                                                 └──────────────────────────┘
```

---

## 1. Deploy the backend to Fly.io

### One-time setup

```bash
# from /home/user/workspace/freightclause-tender
fly auth login
fly launch --no-deploy --copy-config --name freightclause-tender-api --region syd
# (`fly launch` will detect the Dockerfile + fly.toml already in place.)

# Volume for SQLite — only needed on first deploy
fly volumes create tender_data --region syd --size 1
```

### Secrets

```bash
# CORS — list every origin that should be allowed to call the API
fly secrets set CORS_ORIGIN="https://freightclause-tender.pages.dev,https://tender.freightclause.com"

# Optional: Google Maps server-side key (the Settings UI can also store this in the DB)
fly secrets set GOOGLE_MAPS_API_KEY="your-key-here"

# Litestream → Cloudflare R2 (recommended — egress-free)
fly secrets set \
  LITESTREAM_REPLICA_URL="s3://tender-db-backups.<R2_ACCOUNT_ID>.r2.cloudflarestorage.com/data" \
  LITESTREAM_ACCESS_KEY_ID="<r2-access-key>" \
  LITESTREAM_SECRET_ACCESS_KEY="<r2-secret-key>"
```

> If you'd rather use AWS S3, use `s3://bucket-name/prefix` and the matching IAM credentials.

### Deploy

```bash
fly deploy
fly status
fly logs            # tail to confirm Litestream + Express both started
curl https://freightclause-tender-api.fly.dev/api/dashboard/kpis
```

### Scaling

- `fly.toml` ships with `auto_stop_machines = "stop"` → machine sleeps when idle (cheap, ~1s cold start).
- For zero cold starts: `fly scale count 1 --region syd` and set `min_machines_running = 1` in `fly.toml`.

---

## 2. Deploy the frontend to Cloudflare Pages

You have two paths — pick one.

### Path A — Git-connected (recommended, auto-deploys on push)

1. Push the repo to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repo, then configure the build:
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist/public`
4. **Environment variables (Production):**
   - `VITE_API_BASE=https://freightclause-tender-api.fly.dev`
   - `NODE_VERSION=20`
5. Save and deploy. Subsequent `git push` → automatic build + deploy.

### Path B — Direct upload via Wrangler (one-off / CI)

```bash
# from the project root
VITE_API_BASE="https://freightclause-tender-api.fly.dev" npm run build

# Copy the Pages headers/redirects into the output
cp cloudflare/_headers cloudflare/_redirects dist/public/

npx wrangler pages deploy dist/public --project-name=freightclause-tender
```

### Custom domain

Cloudflare dashboard → Pages project → **Custom domains → Set up a domain**, e.g. `tender.freightclause.com`. Cloudflare issues the cert automatically. Then add that origin to the Fly `CORS_ORIGIN` secret and redeploy the backend.

---

## 3. Verify

```bash
# Backend health
curl https://freightclause-tender-api.fly.dev/api/dashboard/kpis

# Frontend (should serve the React shell)
curl -I https://freightclause-tender.pages.dev

# End-to-end: open the Pages URL in a browser, confirm the dashboard
# loads with the 5 seeded tenders and 4 customers.
```

---

## 4. Local dev (unchanged)

```bash
npm install
npm run dev          # Vite + Express on :5000
```

The frontend will use same-origin (`""`) for `API_BASE` because `VITE_API_BASE` isn't set.

---

## File map (deployment-related)

| File                       | Purpose                                                        |
|----------------------------|----------------------------------------------------------------|
| `Dockerfile`               | Two-stage build → small runtime image with Litestream baked in |
| `.dockerignore`            | Keeps node_modules / qa screenshots out of the build context   |
| `fly.toml`                 | Fly app + volume + health check + scale-to-zero config         |
| `litestream.yml`           | SQLite replication config                                      |
| `fly-entrypoint.sh`        | Restore-on-boot then `litestream replicate -exec node ...`     |
| `wrangler.toml`            | Cloudflare Pages project name + build output dir               |
| `cloudflare/_headers`      | Security headers + asset caching for Pages                     |
| `cloudflare/_redirects`    | SPA fallback for Pages                                         |
| `.env.example`             | All env vars in one place                                      |
