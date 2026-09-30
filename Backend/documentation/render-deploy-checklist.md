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
- `RateLimiting__Enabled`, `RateLimiting__PermitLimit`, `RateLimiting__WindowSeconds` — optional, off by default
- `GoogleAI__GeminiModel`, `GoogleAI__ApiKey` — optional (deterministic fallbacks apply)
- `Email__Enable`, `Email__Host`, `Email__From`, `Email__Port`, `Email__Username`, `Email__Password` — REQUIRED only if password-reset e-mail must deliver; otherwise the API answers forgot-password generically and logs that SMTP is unconfigured
- `PasswordReset__FrontendBaseUrl` — must be the deployed Vercel origin when SMTP is on
- `HallMedia__Directory`, `DocumentStorage__Directory` — REQUIRED for durable uploads; when unset the app warns at startup that container-local temp storage will not survive redeploys
- `NEXT_PUBLIC_API_BASE_URL` (Vercel side) — must be `https://<render-service>/api/v1`
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
