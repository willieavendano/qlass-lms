# Alpha Hardening Runbook (Phase 1)

Operator checklist to take Qlass from "live hackathon build" to "trustable for real student data" before the August single-teacher pilot. Most steps here touch production infrastructure (Railway, Supabase, Google Cloud, DNS) or the production database, so they are **run by the operator**, not automated.

Order matters: do **1 (migration baseline)** before any further `git push` that would trigger a Railway deploy, because `railway.json` now runs `prisma migrate deploy`.

---

## 1. Prisma migration baseline (replaces `db push` in prod)

The repo now ships `prisma/migrations/0_init/` and `railway.json` runs `prisma migrate deploy`. The existing databases already contain every table (created by the old `db push`), so they must be **baselined** — told that `0_init` is already applied — *before* the new deploy command runs. If you skip this, `migrate deploy` will try to `CREATE TABLE` over existing tables and fail.

### 1a. Local dev DB (lunalabmini)
```bash
cd ~/Developer/Code/qlass
git checkout feat/migration-baseline
# .env points at localhost:5432/qlass
npx prisma migrate resolve --applied 0_init
npx prisma migrate status   # expect: "Database schema is up to date!"
```

### 1b. Production DB (Railway) — do this BEFORE the next deploy
```bash
# Point Prisma at prod for ONE command only. Get the URL from Railway > Postgres > Connect.
DATABASE_URL="postgresql://<prod-conn-string>" npx prisma migrate resolve --applied 0_init
DATABASE_URL="postgresql://<prod-conn-string>" npx prisma migrate status   # up to date
```
Only after 1b succeeds is it safe to merge/deploy the `feat/migration-baseline` branch.

### Future schema changes
`npx prisma migrate dev --name <change>` locally → commit the new folder under `prisma/migrations/` → deploy. Railway applies it automatically via `migrate deploy`. Stop using `db push` for anything production-facing.

---

## 2. Persistent file storage → Supabase Storage

Today `STORAGE_PROVIDER=local` on Railway has no persistent volume → **student uploads and imported Drive attachments are lost on every redeploy.** The `supabase` provider is already implemented in `src/lib/storage.ts`.

1. Create a Supabase project (free tier). In Storage, create a bucket, e.g. `qlass-uploads`.
2. Set on Railway (service → Variables):
   ```
   STORAGE_PROVIDER=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # secret, server-only
   SUPABASE_STORAGE_BUCKET=qlass-uploads
   ```
3. Redeploy, then verify (see Verification below): a fresh student upload AND a Google-imported attachment both download.

---

## 3. Automated Postgres backups + a tested restore

Pilot success bar = "two weeks, no data loss." Backups are mandatory.

1. Enable Railway's scheduled backups on the Postgres plugin (or add a daily `pg_dump` to R2/Supabase via a cron service).
2. **Prove the restore once:** dump prod, restore into a scratch DB, log in and read a class. An untested backup is not a backup.
   ```bash
   pg_dump "$PROD_DATABASE_URL" -Fc -f /tmp/qlass-$(date +%F).dump
   createdb qlass_restore_test
   pg_restore -d qlass_restore_test /tmp/qlass-*.dump
   ```

---

## 4. Custom domain + auth correctness (`class.avendano.xyz`)

1. Railway service → Settings → add custom domain `class.avendano.xyz`; create the CNAME at your DNS host; wait for HTTPS to provision.
2. Set `NEXTAUTH_URL=https://class.avendano.xyz` on Railway (must match the domain **exactly**, no trailing slash).
3. Google Cloud Console → the OAuth client → Authorized redirect URIs → add:
   `https://class.avendano.xyz/api/auth/callback/google`
   Keep the existing Classroom/Drive scopes (already requested in `src/lib/google.ts`).

---

## 5. Secret hygiene (production)

1. Generate fresh values and set them on Railway:
   ```bash
   openssl rand -base64 32   # NEXTAUTH_SECRET
   openssl rand -base64 32   # ENCRYPTION_KEY (32-byte base64)
   ```
2. Confirm neither is the `.env.example` placeholder.
3. **Rotating `ENCRYPTION_KEY` invalidates any already-stored BYOK AI keys** (they're AES-GCM-encrypted with it). Do this *before* configuring AI providers / having teachers enter keys, then re-enter keys in Settings.

---

## Verification

- **Migrations:** `prisma migrate status` reports up to date on both local and prod; a deploy runs `migrate deploy` with no `CREATE TABLE` errors.
- **Storage:** redeploy, then confirm a previously-uploaded file still downloads and an imported Drive attachment opens.
- **Backups:** a real restore into a scratch DB lets you log in and read data.
- **Domain/auth:** Google + credentials login both work on `https://class.avendano.xyz` with no NextAuth URL-mismatch error.

---

## What's automated vs. operator-run

- **Already in code (this branch):** `prisma/migrations/0_init/`, `migration_lock.toml`, `railway.json` → `migrate deploy`.
- **Operator-run (above):** the `migrate resolve` baselines, Supabase project, Railway backups + env vars, DNS, Google OAuth redirect URI, secret rotation.
