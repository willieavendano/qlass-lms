# Contributing to Qlass

Qlass is a self-hostable LMS for teachers and small schools. Contributions should protect classroom data, keep the app easy to self-host, and preserve teacher control over AI-generated content.

## Local development

1. Copy environment files:

```bash
cp .env.example .env.local
ln -sf .env.local .env
```

2. Start Postgres:

```bash
docker compose up postgres -d
```

3. Install, prepare the database, and run:

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Demo accounts are listed in the README.

## Before opening a PR

Run the same checks as CI:

```bash
npm run prisma:validate
npm run typecheck
npm test
npm run build
```

For schema changes, prefer checked-in Prisma migrations for production-facing work. Use `db:push` only for local prototyping.

## Contribution priorities

High-impact contributions include self-hosting reliability, Google Classroom import hardening, privacy/security improvements, accessibility, tests, and teacher-reviewed agentic workflows.

## AI and student safety

AI-generated content must stay behind a teacher review gate. Do not add autonomous student-facing AI behavior without an explicit design review and privacy review.
