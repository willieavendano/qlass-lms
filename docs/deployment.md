# Deployment Guide

Qlass is a dynamic Next.js application with PostgreSQL. GitHub Pages can host a landing page or documentation, but it cannot host the full app because Qlass needs API routes, authentication, file uploads, and a database.

## Hosted deployment: Vercel + Supabase (the pilot setup)

The reference hosted deployment runs the Next.js app on Vercel and uses one
Supabase project for both Postgres and file storage. Everything is provisioned
through the Vercel Marketplace so env vars land in the project automatically.

1. **Link the project and provision Supabase**
   ```bash
   vercel link --project qlass
   vercel integration add supabase --name qlass   # accept the Marketplace terms in the browser when prompted
   ```
   The integration injects `POSTGRES_PRISMA_URL` (pooled), `POSTGRES_URL_NON_POOLING`
   (direct), `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and friends.
2. **Map the Prisma URLs.** Prisma reads `DATABASE_URL` (runtime, pooled) and
   `DIRECT_URL` (migrations, direct). Set both on Vercel:
   ```bash
   vercel env add DATABASE_URL production   # value of POSTGRES_PRISMA_URL
   vercel env add DIRECT_URL production     # value of POSTGRES_URL_NON_POOLING
   ```
3. **Set the app secrets** for `production` and `preview`: `NEXTAUTH_SECRET`,
   `ENCRYPTION_KEY`, `CRON_SECRET`, `STORAGE_PROVIDER=supabase`,
   `SUPABASE_STORAGE_BUCKET=qlass-uploads`, and `NEXTAUTH_URL` (the exact
   public URL, e.g. `https://qlass-<team>.vercel.app`).
4. **Create the storage bucket** `qlass-uploads` (private) in Supabase Storage.
   The app only ever hands out short-lived signed URLs, so keep it private.
5. **Deploy.** `vercel.json` sets the build command to
   `npx prisma migrate deploy && npm run build`, so every deploy applies the
   checked-in migrations before building. Pushing to `main` deploys production.
6. **Seed** (first deploy only): `DATABASE_URL=<direct url> DIRECT_URL=<direct url> npm run db:seed`.

The daily digest cron in `vercel.json` calls `/api/cron/digest` at 11:00 UTC.
Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when
`CRON_SECRET` is set on the project.

Function limits: the AI course-builder run route and the digest route declare
`maxDuration = 300` seconds, which is the Fluid Compute default. Uploads never
touch the function filesystem (they go straight to Supabase via signed URLs).
The in-memory rate limiter is best-effort on Vercel; see `src/lib/ratelimit.ts`.

## Other hosts (Docker)

The `Dockerfile` (standalone Next.js output) and `docker compose --profile full`
still work for Render, Fly.io, a VPS, or a school server. You need:

- Node.js 20+ and PostgreSQL 16+
- HTTPS in front of the app
- Persistent file storage or S3/Supabase Storage (never `local` without a volume)
- Automated database backups
- A pre-start step that runs `npm run db:migrate:deploy`

## Email notifications and the daily digest

Email is optional: without `SMTP_HOST`, sends are logged no-ops and in-app
notifications still work. To deliver email, set the `SMTP_*` vars from
`.env.example`. Users choose Immediate / Daily digest / Off in Settings.

On Vercel the digest is scheduled by `vercel.json`. Elsewhere, any scheduler can call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.example/api/cron/digest
```

Set `CRON_SECRET` in the app environment and schedule the call once a day
(GitHub Actions schedule, system cron, or any cron host). The endpoint is
idempotent per day: it only emails unread notifications created since each
user's last digest.

## Production database policy

Local prototyping can use:

```bash
npm run db:push
```

Production deployments should use checked-in migrations:

```bash
npm run db:migrate:deploy
```

The repository ships a migration baseline (`prisma/migrations/0_init`) plus
follow-ups. A database created by the old `db push` flow must be baselined once
before `migrate deploy` will run against it:

```bash
DATABASE_URL=<url> DIRECT_URL=<url> npx prisma migrate resolve --applied 0_init
```

## Public site and custom domains

The class site at `class.avendano.xyz` is the public entry point and links to
the app host. The app host must resolve over HTTPS and match `NEXTAUTH_URL`
exactly; when a custom domain is attached in Vercel, update `NEXTAUTH_URL` (and
any Google OAuth redirect URIs) in the same change.
