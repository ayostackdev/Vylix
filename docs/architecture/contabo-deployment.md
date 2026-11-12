# Deploying Vylix on Contabo (VPS)

Self-hosting the API on a Contabo VPS instead of Render. The web app stays on
Vercel, Postgres/Auth stay on Supabase, files stay on Cloudflare R2 — only the
FastAPI process moves.

---

## 1. Topology

| Piece | Where | Notes |
|---|---|---|
| `apps/web` — Next.js 14 PWA | **Vercel** (Hobby, free) | Keep the CDN edge; PWA caching is far better for Nigerian mobile users than a box in Germany. |
| `apps/api` — FastAPI | **Contabo VPS** | `api` + `worker` + `beat` + 2× Redis + Caddy, all in `docker-compose.prod.yml`. |
| Postgres + Auth | Supabase | Do not move. The API holds only a pooler connection string. |
| Object storage | Cloudflare R2 | VPS disk holds images, Redis and logs — not user files. |
| TLS + reverse proxy | Caddy (in compose) | Automatic Let's Encrypt certs for `api.vylix.app`. |

The repo is already wired for this: `docker-compose.prod.yml` (services),
`Caddyfile` (routing + TLS), `deploy.sh` (one-shot deploy), and
`docker-compose.contabo.yml` (optional full-weight API — see §8).

---

## 2. Sizing the box

Core VPS line (Core VPS = SSD; Performance VPS = NVMe + EPYC, ~3× the price).
Prices as of Oct 2026 — verify on contabo.com before ordering.

| Plan | vCPU / RAM / Disk | Promo (24 mo) | Standard after | Use it when |
|---|---|---|---|---|
| Cloud VPS 4 | 4 / 8 GB / 100 GB | €4.40 | €5.50 | Lean API only (§8). |
| Cloud VPS 6 | 6 / 12 GB / 200 GB | €6.00 | €7.50 | Lean API + one-month test profile (§14). BGE-M3 only with the retuned 4g/5g limits. |
| Cloud VPS 8 | 8 / 24 GB / 300 GB | €11.20 | €14.00 | **Recommended** for the full BGE-M3 stack. |
| Cloud VPS 12 | 12 / 48 GB / 400 GB | €20.00 | €25.00 | Full stack + headroom for 2 API workers. |

Baseline footprint:

| Service | RAM | Disk (image) |
|---|---|---|
| API (lean) | ~600 MB | ~2 GB |
| API (full BGE-M3) | ~3.5 GB per worker | ~8–10 GB |
| Celery worker | ~3.5 GB with model loaded | ~8–10 GB |
| 2× Redis | ~100 MB total | ~50 MB |
| Caddy | ~50 MB | ~50 MB |

**RAM note for the full-weight API**: each uvicorn worker loads the fp32
BGE-M3 weights (~2.3 GB) plus torch overhead — budget ~3.5 GB per worker, and
another ~3.5 GB for the Celery worker that embeds chunks. That is why the
overlay in §8 defaults to one API worker and one Celery process. On 12 GB the
full stack fits, but only with the ceilings in §14 (4 GB API + 5 GB worker);
Cloud VPS 8 is the floor where you also have room for a second API worker.

---

## 3. Region choice (Nigeria)

Contabo has **no Nigeria datacenter**. Regions: European Union (5 DCs in
Germany), United Kingdom, United States (3), Singapore, Japan, India,
Australia.

Pick **European Union** for Lagos traffic — ~100–130 ms RTT vs ~180–220 ms to
US East, and the EU line is the cheapest. Non-German locations also carry a
location surcharge on top of the plan price.

Contabo publishes per-datacenter pings (speedtest.net → search "Contabo"). If
your users are on a specific carrier (MTN/Airtel), sanity-check before
committing — location changes mean a reinstall.

---

## 4. Paying from Nigeria

**Accepted by Contabo**

| Currency | Methods |
|---|---|
| EUR (€) | Credit card, PayPal, Skrill, bank transfer, direct debit (qualifying customers) |
| USD ($) | Credit card, PayPal |
| GBP (£) | Credit card, PayPal |

Cards: **Visa, Mastercard, American Express**. **No cryptocurrency.** Adding a
card places a ~€1 pre-authorization hold that releases within a few days.

**Best routes for a Nigerian account**

1. **PayPal** — link your Nigerian Visa/Mastercard or fund it by bank
   transfer / PayNow. Contabo supports PayPal in all three currencies, and it
   sidesteps card declines at checkout. Set it as the automatic-payment method
   (billing agreement) so renewals do not silently fail.
2. **Nigerian-issued Visa/Mastercard debit card** — works, with two caveats:
   - **Enable international/online transactions** in your banking app first
     (GTBank, Zenith, Access, Fidelity, UBA, First Bank, etc. ship this
     disabled by default). Without it the payment is declined outright.
   - You must approve the 3-D Secure OTP on the transaction.
3. **Fintech USD virtual card** — Grey, Chipper Cash, Moniepoint, Kuda, Proton,
   Paga, OPay. These issue international Visa/Mastercard virtual cards and
   handle FX themselves; usually the smoothest first international
   subscription because the issuer owns the currency conversion.
4. **Skrill** — EUR only, Nigerian support is patchy. Last resort.

**Two checkout settings that change the bill**

- **Country (for tax purposes only) → Nigeria.** This is separate from the
  server region and only affects VAT. Nigeria is not an EU-VAT jurisdiction,
  so you avoid the 19% German VAT that would otherwise be added on top.
- **Currency → USD.** Your account is locked to the currency you pick at
  checkout. NGN is pegged to USD, so billing in USD avoids a EUR→NGN
  cross-rate on top of the card issuer's own FX markup.

Also expect: a promo rate for the first 24 months that steps up afterwards
(VPS 4: €4.40 → €5.50), and a one-time setup fee if you choose monthly
billing — annual billing is cheaper.

---

## 5. Provision the VPS

1. **Order** the plan from §2, Ubuntu 22.04 or 24.04 image, add your SSH
   public key at checkout.
2. **Open the firewall.** Contabo ships its own network firewall (Control
   Panel → Firewall) which is separate from `ufw` and blocks by default.
   Allow inbound **22/tcp** (or **2222** if you use the hardening script in
   `DevOps.txt`), **80/tcp**, **443/tcp**.
3. **Point DNS.** Add an `A` record `api.vylix.app` → the VPS IP (TTL 300).
   If you use Cloudflare, set the record to **DNS only** (grey cloud) for the
   first deploy — Caddy needs to answer the Let's Encrypt HTTP-01 challenge on
   port 80 and will obtain and renew the cert by itself. You can proxy
   afterwards.
4. **SSH in** and harden (optional but recommended — `DevOps.txt` has a
   ready-made script):

   ```bash
   ssh root@YOUR_IP
   # optional: useradd deploy, SSH key auth, SSH on port 2222, ufw, fail2ban
   ```

---

## 6. First deploy

```bash
git clone https://github.com/ayostackdev/Vylix.git /opt/vylix
cd /opt/vylix
cp .env.production.example .env.production
nano .env.production          # fill in every blank — see §7
bash deploy.sh
```

`deploy.sh` installs Docker if missing, pulls the repo, runs
`alembic upgrade head` as a one-shot **before** the API starts, then brings the
stack up. Never move the migration into the container CMD — concurrent
replicas would race Alembic on every deploy.

Re-running it later is the update path:

```bash
cd /opt/vylix && git pull && bash deploy.sh
```

To deploy the full-weight API (see §8):

```bash
cd /opt/vylix
COMPOSE_FILES="docker-compose.prod.yml docker-compose.contabo.yml" bash deploy.sh
```

---

## 7. Environment checklist (`.env.production`)

```bash
CORS_ORIGINS="https://vylix.app"             # must not be empty
FRONTEND_URL="https://vylix.app"
STORAGE_PROVIDER=r2
GOOGLE_REDIRECT_URI="https://api.vylix.app/api/google-drive/callback"
MONNIFY_BASE_URL="https://api.monnify.com"    # sandbox while testing
MONNIFY_API_KEY="..."                         # dashboard.monnify.com
MONNIFY_SECRET_KEY="..."
MONNIFY_CONTRACT_CODE="..."
```

Secrets that must come from your own accounts: `DATABASE_URL`, `DIRECT_URL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`,
`GEMINI_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_STORAGE_PUBLIC_BASE_URL`, `R2_AVATARS_PUBLIC_BASE_URL`.

Notes:

- `CORS_ORIGINS` must resolve to at least one origin — `main.py` exits FATAL
  when the list is empty, rather than falling back to wildcard CORS.
- `*.vercel.app` is auto-allowed by regex, but only **one** label deep
  (`https://vylix-web.vercel.app` matches, `https://vylix-git-branch.vercel.app`
  does not). Add preview domains explicitly if you test from Vercel preview
  URLs.
- The Monnify webhook must point at
  `https://api.vylix.app/api/v1/payments/webhook` and the signature is
  computed with `MONNIFY_SECRET_KEY`. If you change the API domain, re-register
  the webhook in the Monnify dashboard.
- `VECTOR_STORE_BACKEND` is forced to `pgvector` by
  `docker-compose.prod.yml` — see §8.

**Vercel side** (Project → Settings → Environment Variables):

```
NEXT_PUBLIC_API_BASE_URL=https://api.vylix.app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Without `NEXT_PUBLIC_API_BASE_URL` the web app silently falls back to
`localhost:4000`.

Set `DOCS_ENABLED=false` in production unless the interactive API
documentation is needed for an authenticated or otherwise restricted
environment. The liveness and readiness endpoints remain available.

---

## 8. Lean API vs full BGE-M3

`docker-compose.prod.yml` builds the API from the **`api-lean`** target, which
installs `requirements-lean.txt` — no torch, no FlagEmbedding, no docling.
With `EMBEDDING_PROVIDER=bge-m3` that image **cannot** load the model, so
`app/services/embeddings.py` logs a warning and degrades to Gemini (or to
hashing when there is no Gemini key). Nothing errors out; search quality just
quietly collapses.

Pick one:

**A. Lean API (default, 8 GB box is fine)** — keep the base compose file and
use the Gemini embedding provider:

```bash
EMBEDDING_PROVIDER=gemini
```

Costs per embedding call, but the box stays small and the image is ~2 GB.
Both providers are pinned to 1024 dims (`EMBEDDING_DIMENSIONS`), so the
vectors remain insert-compatible with the `VECTOR(1024)` column. What you
lose is the sparse lexical signal — the hybrid ranking that makes exact
course-code queries (`MTH101`) resolve to the right sheet. Treat the lean
path as a fallback, not the target.

**B. Full-weight API with self-hosted BGE-M3 (no per-call cost)** — layer the
Contabo overlay, which swaps the API to the `api-run` target (full
`requirements.txt`):

```bash
cd /opt/vylix
COMPOSE_FILES="docker-compose.prod.yml docker-compose.contabo.yml" bash deploy.sh
```

The overlay also:

- mounts a shared `hf_cache` volume at `/root/.cache/huggingface` and sets
  `HF_HOME` for the API **and** the worker, so the ~2.3 GB of BGE-M3 weights
  are downloaded once instead of on every container recreate;
- pins the API to one uvicorn worker by default (each worker loads its own
  copy of the weights);
- sets memory ceilings so the model cannot OOM the whole box.

Tune via the shell environment or a `.env` file next to the compose files
(**not** `.env.production` — that is the container environment file):

```bash
API_WORKERS=2 API_MEM_LIMIT=8g WORKER_MEM_LIMIT=8g \
  COMPOSE_FILES="docker-compose.prod.yml docker-compose.contabo.yml" bash deploy.sh
```

Build time for the full image is long (~20 min, mostly torch + docling).
`deploy.sh` no longer passes `--no-cache`, so later deploys reuse the layer
cache and only the changed layers rebuild.

The `api-run` image now carries `alembic.ini` and `migrations/`, so the
one-shot migration step works against it too.

---

## 9. Database prerequisite

The compose file pins `VECTOR_STORE_BACKEND=pgvector`, which requires the
`vector` extension in the Supabase project. It is created by
`supabase/migrations/001_enable_pgvector.sql` — run it before the first
deploy, or the API will fail to start:

```sql
-- Supabase SQL editor: paste the contents of the file directly. The editor
-- does not understand psql meta-commands like \i.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

Or run it from a machine with `psql`:

```bash
psql "$DIRECT_URL" -f supabase/migrations/001_enable_pgvector.sql
```

The Alembic migrations in `apps/api/migrations/versions/` run automatically
during `deploy.sh`.

---

## 10. Verify

```bash
curl -fsS https://api.vylix.app/health/live   # {"status":"alive"}
curl -fsS https://api.vylix.app/health        # {"status":"ok"} + db/redis checks
open https://api.vylix.app/docs               # Swagger UI
```

Then end-to-end:

1. Load the web app, sign in, upload a PDF → a material row appears and the
   file lands in R2.
2. With the overlay enabled, confirm the model actually loaded:
   `docker compose logs api | grep -i "BGE-M3 model loaded"`.
   A `FlagEmbedding is not installed` warning means you are on the lean image.
3. Trigger a payment in sandbox mode and confirm Monnify's webhook reaches
   `POST /api/v1/payments/webhook` (check `docker compose logs api`).

---

## 11. Routine operations

```bash
cd /opt/vylix
# Lean deploy:
COMPOSE="docker compose -f docker-compose.prod.yml"
# Overlay deploy — use this instead. Running `up` with only the base file
# would recreate the api container from the lean `api-lean` target.
# COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.contabo.yml"

$COMPOSE logs -f api
$COMPOSE restart api
$COMPOSE ps

# scale out (Caddy least_conn-balances across the replicas; no sticky sessions)
$COMPOSE up -d --scale api=2

# disk hygiene — the full image is large, prune old layers
docker system df
docker image prune -a
```

Take a Contabo snapshot before risky deploys (VPS 4 includes 1 snapshot, VPS 6
includes 2, VPS 8 includes 3). Auto Backup is a paid add-on.

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `api.vylix.app` does not resolve | DNS record missing or proxy on | Add the `A` record; set Cloudflare to DNS-only. |
| TLS error / cert not issued | Ports 80/443 blocked in the Contabo firewall | Open both in Control Panel → Firewall. Caddy needs port 80 for the ACME challenge. |
| API container exits at boot | `CORS_ORIGINS` empty, or pgvector missing | Set `CORS_ORIGINS`; run `001_enable_pgvector.sql`. |
| Web app blocked by CORS in the console | Preview URL has 2+ labels before `.vercel.app` | Add the preview origin to `CORS_ORIGINS`. |
| `permission denied` running docker | User not yet in the `docker` group | `sudo usermod -aG docker $USER` then re-login — `deploy.sh` falls back to `sudo` for that run. |
| Materials stay `QUEUED` | Celery broker unreachable | `docker compose logs worker`; confirm `CELERY_BROKER_URL` points at `redis-celery`. |
| Search results are nonsense | Lean image with `bge-m3` selected | Switch to `EMBEDDING_PROVIDER=gemini`, or deploy the §8 overlay. |
| Model re-downloads on every restart | `hf_cache` volume missing | Ensure the overlay is applied; the volume must be listed in `docker volume ls`. |
| Container OOM-killed | Too many API workers for the RAM | Lower `API_WORKERS` to 1, or move to a larger plan. |
| Web app calls `localhost:4000` | `NEXT_PUBLIC_API_BASE_URL` unset in Vercel | Set it and redeploy the web app. |

---

## 13. Cost estimate

| Item | Cost |
|---|---|
| Cloud VPS 4 (lean API) | €4.40/mo (24 mo), then €5.50 |
| **Cloud VPS 6, 1-month term (test)** | **€7.50 prepaid** |
| Cloud VPS 8 (full BGE-M3) | €11.20/mo (24 mo), then €14.00 |
| Vercel Hobby | $0 |
| Supabase / Cloudflare R2 | already in use |
| Domain (`vylix.app`) | ~$10–15/yr at renewal |
| Monnify | per-transaction fee on customer payments |

At roughly ₦1,600/$, Cloud VPS 4 is about ₦8,500/mo and Cloud VPS 8 about
₦21,000/mo before your card issuer's FX markup.

---

## 14. One-month 12 GB test profile

The cheapest way to find out whether the VPS path works is to rent one month and
test it. Contabo offers **1 / 3 / 6 / 12 / 24-month terms**, and the longer
ones are **prepaid upfront** — the 24-month promo (€6.00/mo for Cloud VPS 6)
means paying €144 on day one. A 1-month term bills the list price (€7.50 for
Cloud VPS 6) with no setup fee and no lock-in.

**Order settings**

| Setting | Value |
|---|---|
| Plan | Cloud VPS 6 — 6 vCPU / 12 GB / 200 GB |
| Term | **1 month** (€7.50, prepaid) |
| Checkout country | **Nigeria** — avoids the 19% German VAT |
| Checkout currency | USD |
| Image | Ubuntu 24.04 LTS |
| Add-ons | None — Auto Backup is paid, IPv4 and 2 snapshots are included |

The card is pre-authorised for ~€1 (released within days). New orders have a
14-day money-back window; after that it is non-refundable.

**Deploy the BGE-M3 overlay, not the lean path.** This is the opposite of the
usual "start small" instinct, and it is deliberate:

- The database is already 1024-dim BGE-M3-native. Migration `035` resized
  `material_chunks.embedding` from `VECTOR(768)` to `VECTOR(1024)` and
  `037` matched `semantic_cache.question_embedding` to it.
- The hybrid search fuses a dense score with a **sparse lexical** score
  (`app/services/vector_store.py`), and that sparse signal is what makes an
  exact query like `MTH101` rank the right sheet first. Gemini is dense-only
  — on the lean path, exact course-code matches get worse.
- The cost is a ~20 min image build and a 2.3 GB weights download, once. The
  per-call cost is zero either way, so BGE-M3 is not a money decision — it is
  a latency and quality decision, and on a 12 GB box it fits.

```bash
cd /opt/vylix
COMPOSE_FILES="docker-compose.prod.yml docker-compose.contabo.yml" bash deploy.sh
```

**Set `EMBEDDING_COLBERT_WEIGHT=0` in `.env.production` on this box.** The
ColBERT late-interaction rerank re-encodes the query *and* every candidate
document on CPU — tens of seconds to minutes per search on Contabo's shared
vCPU. Disabling it keeps the hybrid dense+sparse ranking and drops the
latency. Turn it back on when you move to a box with dedicated CPU.

**Fallback:** if the full image build or the weights download fails, drop the
overlay and use the lean path with `EMBEDDING_PROVIDER=gemini` in
`.env.production`. Both providers are pinned to 1024 dims
(`EMBEDDING_DIMENSIONS`, `gemini-embedding-001`), so the vectors stay
insert-compatible with the pgvector column — but the lean path loses the
sparse signal, so treat it as a fallback, not the target.

**Memory ceilings** are already set in the compose files, so the containers
cannot collectively OOM the box:

| Service | Lean profile | BGE-M3 overlay |
|---|---|---|
| api | 2 GB | 4 GB |
| worker | 4 GB | 5 GB |
| beat | 1 GB | 1 GB |
| redis ×2 | 512 MB each | — |
| caddy | 256 MB | — |
| **Ceiling total** | **~8.25 GB** | **~11.25 GB** |

Override per deploy with `API_MEM_LIMIT=… WORKER_MEM_LIMIT=…`, or set
`WEB_CONCURRENCY` / `CELERY_CONCURRENCY` — the Celery concurrency lives in a
compose `command:` override because the image CMD is exec-form and cannot
expand environment variables.

**What "success" means** — the hardware is not the test, these four flows are:

1. `deploy.sh` completes and `alembic upgrade head` succeeds against Supabase.
2. Caddy issues a certificate for `api.vylix.app` and `/health` returns `ok`.
3. **Upload → ingest → search returns relevant hits.** If materials stay
   `QUEUED`, the Celery worker is not picking the job up (check
   `docker compose logs worker`); if hits are nonsense, the provider in
   `.env.production` does not match the deployed image (§8).
4. A Monnify sandbox payment reaches `POST /api/v1/payments/webhook`.

Take a snapshot once the first deploy is green (2 included with VPS 6) and
again before any risky change — the stack is stateless outside the HF cache,
so a bad deploy is a snapshot restore, not data loss.

**Day 25 — cancel or keep.** The 1-month term is prepaid and renews silently
if you do nothing, so put a calendar reminder on the day the server is
provisioned. If the four flows above are green and peak RAM is under 4 GB,
stay on the 12 GB box (rolling monthly); if peak RAM is over 8 GB or you want
BGE-M3 properly, move to Cloud VPS 8 (24 GB) or split the worker onto its own
box.

---

See also: `deployment.md` (web on Vercel + API on Render),
`overview.md` (service boundaries).
