# Deployment Guide

Qlass is a dynamic Next.js application with PostgreSQL. GitHub Pages can host a landing page or documentation, but it cannot host the full app because Qlass needs API routes, authentication, file uploads, and a database.

## Recommended alpha deployment

Use Railway, Render, Fly.io, or a VPS with:

- Node.js 20+
- PostgreSQL 16+
- HTTPS
- Persistent file storage or S3/Supabase Storage
- Automated database backups

## Required environment

At minimum:

```env
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-domain.example
NEXTAUTH_SECRET=...
ENCRYPTION_KEY=...
STORAGE_PROVIDER=local
```

For Google Classroom import, configure Google OAuth and the Classroom/Drive scopes described in `.env.example`.

## Email notifications and the daily digest

Email is optional: without `SMTP_HOST`, sends are logged no-ops and in-app
notifications still work. To deliver email, set the `SMTP_*` vars from
`.env.example`. Users choose Immediate / Daily digest / Off in Settings.

The daily digest is sent by an external scheduler calling:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.example/api/cron/digest
```

Set `CRON_SECRET` in the app environment and schedule the call once a day
(Railway cron, GitHub Actions schedule, or any cron host). The endpoint is
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

Do not switch a live deployment from `db:push` to `migrate deploy` until the repository has an initial migration baseline.

## GitHub Pages and custom domains

If `willieavendano.github.io` is used, treat it as a public landing/docs entry point that links to the real app host. The app host should resolve over HTTPS and match `NEXTAUTH_URL` exactly.
