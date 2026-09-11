# Alpha Hardening Runbook (Phase 1)

Operator checklist to take Qlass from "live hackathon build" to "trustable for real student data" for the single-teacher pilot. Most steps here touch production infrastructure (Vercel, Supabase, Google Cloud, DNS) or the production database, so they are **run by the operator**, not automated.

> **Sept 2026:** production moved from Railway to **Vercel + Supabase**. The Railway project is offline and no longer deploys; `railway.json` was removed. The Vercel project auto-deploys `main` and runs `prisma migrate deploy` in its build command (`vercel.json`).

Order matters: a database that was created by `db push` must be **baselined (step 1)** before the first Vercel deploy against it, because the build runs `prisma migrate deploy`. A fresh Supabase database needs no baseline — `migrate deploy` creates everything.

---

## 1. Prisma migration baseline (replaces `db push` in prod)

The repo ships `prisma/migrations/0_init/` (baseline) plus `20260707000000_pilot_features` (`User.digestSentAt`, `AgentRun.review`), and the Vercel build runs `prisma migrate deploy`. Any database that already contains the tables (created by the old `db push`) must be **baselined** — told that `0_init` is already applied — *before* `migrate deploy` runs against it. If you skip this, `migrate deploy` will try to `CREATE TABLE` over existing tables and fail.

### 1a. Local dev DB (lunalabmini)
```bash
cd ~/Developer/Code/qlass
# .env points at localhost:5432/qlass (DATABASE_URL and DIRECT_URL)
npx prisma migrate resolve --applied 0_init
npx prisma migrate status   # expect: "Database schema is up to date!"
```

### 1b. Production DB (Supabase)
A Supabase database provisioned fresh needs nothing: the first Vercel build applies `0_init` and every follow-up. If you ever restore an old `db push`-era dump into it, baseline first:
```bash
# Use the DIRECT (non-pooled) Supabase URL for both vars, ONE command only.
DATABASE_URL="<direct-url>" DIRECT_URL="<direct-url>" npx prisma migrate resolve --applied 0_init
DATABASE_URL="<direct-url>" DIRECT_URL="<direct-url>" npx prisma migrate status   # up to date
```

### Future schema changes
`npx prisma migrate dev --name <change>` locally → commit the new folder under `prisma/migrations/` → merge to `main`. Vercel applies it automatically via `migrate deploy` during the build. Stop using `db push` for anything production-facing.

---

## 2. Persistent file storage → Supabase Storage

Vercel functions have no persistent filesystem, so `STORAGE_PROVIDER=local` is not an option there → uploads must go to Supabase Storage (the `supabase` provider in `src/lib/storage.ts`). The Marketplace integration already injects `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

1. In the Supabase project created by `vercel integration add supabase`, open Storage and create a **private** bucket `qlass-uploads`.
2. Confirm on Vercel (`vercel env ls`):
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

1. Supabase takes daily backups on paid plans; on the free plan add a daily `pg_dump` (GitHub Actions schedule against the direct URL, pushed to private object storage).
2. **Prove the restore once:** dump prod, restore into a scratch DB, log in and read a class. An untested backup is not a backup.
   ```bash
   pg_dump "$PROD_DATABASE_URL" -Fc -f /tmp/qlass-$(date +%F).dump
   createdb qlass_restore_test
   pg_restore -d qlass_restore_test /tmp/qlass-*.dump
   ```

---

## 4. Custom domain + auth correctness

1. Vercel project → Settings → Domains → add the app domain (note: `class.avendano.xyz` is the public class site, so the app needs its own, e.g. `app.avendano.xyz`); create the CNAME at your DNS host; Vercel provisions HTTPS.
2. Set `NEXTAUTH_URL=https://<app-domain>` on Vercel (must match the domain **exactly**, no trailing slash) and redeploy.
3. Google Cloud Console → the OAuth client → Authorized redirect URIs → add:
   `https://<app-domain>/api/auth/callback/google`
   Keep the existing Classroom/Drive scopes (already requested in `src/lib/google.ts`).

---

## 5. Secret hygiene (production)

1. Generate fresh values and set them on Vercel (`vercel env add <NAME> production`):
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
- **Domain/auth:** Google + credentials login both work on the app domain with no NextAuth URL-mismatch error.

---

## What's automated vs. operator-run

- **Already in code:** `prisma/migrations/`, `migration_lock.toml`, `vercel.json` (build runs `migrate deploy`, daily digest cron).
- **Operator-run (above):** Supabase bucket, backups, DNS + `NEXTAUTH_URL`, Google OAuth redirect URI, secret rotation.
