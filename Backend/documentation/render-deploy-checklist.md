# Render deployment checklist — Wesal API (production hardening)

> No `render.yaml` blueprint is committed on purpose: the production service
> already exists on Render, and applying a blueprint could provision a SECOND
> service or replace the existing one. Use this checklist against the existing
> service instead. Never print secret values — verify presence only.

## 1. Service identity (verify, do not recreate)

- Repository: `wessalOrg/Wesal-Platform`
- Branch: `main` (default branch; production deploys track it)
- Root Directory: `Backend`
- Build: `Dockerfile` (multi-stage, .NET 10, runs as non-root `appuser`)
- Runtime: `dotnet Wesal.API.dll`, listens on `$PORT`

## 2. Environment variables (presence only)

Required outside Development (the app refuses to boot without them):

- `ConnectionStrings__DefaultConnection` — REQUIRED, must be the Neon production URL
- `Jwt__SecretKey` — REQUIRED, strong secret (min 32 chars), must match the issuing side
- `Cors__AllowedOrigins` — REQUIRED, must include the Vercel production origin

Optional / feature-gated:

- `Swagger__Enabled` — optional, keep unset/false in production
- `RateLimiting__Enabled`, `RateLimiting__PermitLimit`, `RateLimiting__WindowSeconds` — optional global HTTP limiter, off by default
- `RateLimiting__Assistant__Enabled`, `RateLimiting__Assistant__TokenLimit`, `RateLimiting__Assistant__TokensPerPeriod`, `RateLimiting__Assistant__ReplenishmentPeriodSeconds`, `RateLimiting__Assistant__ConcurrencyLimit` — assistant-only cost protection, enabled by default (6-token burst, 12 turns/minute, 2 concurrent turns)
- `GoogleAI__GeminiModel`, `GoogleAI__ApiKey` — optional (deterministic fallbacks apply)
- `GoogleAuth__ClientId` — Google OAuth Web Client ID. Must match the frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- Password reset via Brevo SMTP (set these on the existing Render API service; never commit SMTP credentials):
  - `Email__Enable=true`
  - `Email__Host=smtp-relay.brevo.com`
  - `Email__Port=587`
  - `Email__UseSsl=true` (MailKit uses required STARTTLS on port 587)
  - `Email__From=Wesal Platform <wesalplatform.gaza@gmail.com>` (add and verify this exact sender in Brevo first)
  - `Email__Username=<SMTP login shown in Brevo SMTP settings>`
  - `Email__Password=<SMTP key from Brevo; this is not the Brevo API key>`
  - `PasswordReset__FrontendBaseUrl=https://wesal-platform-alpha.vercel.app`
  - Brevo sends a bilingual reset email with a 24-hour link. After the new password is saved, the reset screen links back to `/login` on the same Vercel origin.
  - Brevo requires the SMTP sender to be verified and transactional sending to be activated. Free Gmail senders cannot have their domain authenticated and may be rejected; for reliable delivery, use a sender on a domain you control and authenticate that domain in Brevo.
- Hall media (durable Cloudflare R2; REQUIRED in production — container temp storage loses every upload on restart):
  - `HallMedia__Provider=R2`
  - `HallMedia__R2__ServiceUrl=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
  - `HallMedia__R2__AccessKeyId=<SECRET>` (bucket-scoped Object Read & Write token only)
  - `HallMedia__R2__SecretAccessKey=<SECRET>`
  - `HallMedia__R2__BucketName=wesal-hall-media`
  - `HallMedia__R2__PublicBaseUrl=https://media.<YOUR_DOMAIN>` (custom domain; never `r2.dev` for final production; its path must not start with `/uploads/`)
  - Without these, the app boots with `Local` temp storage and logs a prominent ephemeral-storage warning; uploads then 404 after the next restart.
- `DocumentStorage__Directory` — protected documents stay container-local for now (separate private-storage design later); plan durable private storage before relying on it.
- `NEXT_PUBLIC_API_BASE_URL` (Vercel side) — OPTIONAL override; when unset, production builds use the canonical `https://wesal-platform-p0iv.onrender.com/api/v1`. An explicit value must be an absolute https URL (not localhost) or the prebuild gate fails the deploy
- `NEXT_PUBLIC_DEMO_MODE` (Vercel side) — must NEVER be `true` in production (the Vercel prebuild gate fails the deploy if it is)

## 3. Deploy verification (every production deploy)

1. Render build succeeds for the pushed `main` SHA.
2. Startup log shows `Database migrations applied on startup.` (startup `Migrate()` is the single migration step; do not run a second concurrent migrator).
3. No `fail-open`/`fail-closed` auth surprises: valid owner login works, logged-out token is rejected.
4. `GET /health` and `GET /health/live` return 200.
5. `GET /api/v1/owner/sidebar` with a Hall Owner token returns 200 (guards the controller-activation class of outage).
6. No `Unable to resolve service` lines in logs.
7. No `ephemeral` storage warnings unless temp storage is an accepted tradeoff.

## 4. Rollback

Redeploy the previous green commit from the Render dashboard (no data migration rollback is expected: migrations in this repo are additive; verify before rolling back across a destructive one, should one ever be introduced).

## 5. Cloudflare R2 setup (one-time, dashboard + API token)

1. Cloudflare dashboard → R2 Object Storage → **Create bucket** (e.g. `wesal-hall-media`). Block public access stays compatible: the API serves bytes through signed SDK calls; browsers read through the custom domain below.
2. R2 → **Manage R2 API tokens** → create a token scoped to **that bucket only** with **Object Read & Write** (never account-wide admin). Save the Access Key ID and Secret Access Key into Render env vars — they are server-only and must never appear in frontend code.
3. Note the **S3-compatible endpoint**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` → `HallMedia__R2__ServiceUrl`.
4. R2 bucket → **Settings → Public access → Connect Domain** (or Custom Domains): attach `media.<YOUR_DOMAIN>` (DNS handled by Cloudflare) → `HallMedia__R2__PublicBaseUrl=https://media.<YOUR_DOMAIN>`. Use an `r2.dev` public URL only for temporary smoke testing, never as the final production base.
5. Set the six `HallMedia__*` Render env vars, redeploy, and watch startup logs: no R2 configuration error must appear.
6. Proof test (Phase 24): upload a new hall photo → open its `https://media.<YOUR_DOMAIN>/halls/...` URL (HTTP 200) → trigger a Render restart/redeploy → open the SAME URL again (must still be 200).
7. Legacy `/uploads/...` rows are historical evidence of lost files: never bulk-rewrite or delete them. Owners re-upload originals through the normal hall edit flow; new copies land in R2 with durable URLs.
