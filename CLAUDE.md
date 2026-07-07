# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Qlass is a self-hostable Google Classroom-style LMS. Next.js 14 (App Router) + TypeScript, PostgreSQL via Prisma, NextAuth for auth, Tailwind + Radix UI for the frontend. Pluggable file storage (local / AWS S3 / Supabase).

## Commands

```bash
npm run dev              # Next dev server on :3000
npm run build            # prisma generate + next build
npm run lint             # next lint
npm run typecheck        # TypeScript typecheck without emit
npm run test             # Vitest tests
npm run prisma:validate  # Validate Prisma schema
npm run db:push          # Push schema.prisma to DB for local prototyping
npm run db:migrate       # Create/apply a local Prisma migration
npm run db:migrate:deploy # Apply checked-in migrations in production
npm run db:seed          # tsx prisma/seed.ts -- demo users + the six 2026-27 classes (student joins Physics via PHYSICS)
npm run db:studio        # Prisma Studio
npm run db:generate      # Regenerate Prisma client
```

After editing `prisma/schema.prisma`, run `npm run prisma:validate`, `npm run db:generate`, and either `db:push` for local prototyping or checked-in migrations for production-facing work.

## Environment setup

Two env files are required and must stay in sync: the Prisma CLI reads `.env`, Next.js reads `.env.local`. A symlink is acceptable: `ln -sf .env.local .env`. Required: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. See `.env.example`. Postgres for local dev: `docker compose up postgres -d`.

## Architecture

**Auth & roles are two-tiered.**
- `SystemRole` (ADMIN/TEACHER/STUDENT/GUARDIAN) lives on `User` and is carried in the NextAuth JWT in `src/lib/auth.ts`.
- `ClassRole` (OWNER/TEACHER/STUDENT/GUARDIAN) lives per-class on `ClassMembership`. A user's authority inside a class comes from their membership, not their system role.

**Authorization helpers** in `src/lib/permissions.ts` are the canonical way to gate access: `requireClassAccess(userId, classId, minRole?)`, `requireTeacherInClass(...)`, `isTeacherRole`, `isAdmin`. Use these rather than re-querying memberships inline.

**API route convention** (`src/app/api/**/route.ts`): call `requireSession()` from `src/lib/auth.ts` first. It throws a 401 `Response` if unauthenticated. Validate request bodies with `zod`, catching `z.ZodError` to return 400. Return via `NextResponse.json(...)`.

**Route protection** is centralized in `src/middleware.ts`, which wraps `next-auth/middleware` and lists protected path prefixes. New protected routes must be added to its `matcher`.

**Prisma client** is a singleton in `src/lib/db.ts`. Import `prisma` from `@/lib/db`.

**Storage is provider-abstracted** in `src/lib/storage.ts`, switched by `STORAGE_PROVIDER` (`local` | `s3` | `supabase`). Uploads use a sign-then-upload flow via `/api/uploads/sign`.

**Agentic course builder** (`src/lib/agent/*`, `src/lib/ai.ts`, `src/lib/oer.ts`, `src/lib/crypto.ts`): teachers can build AI-generated unit drafts. Providers are BYOK/local/env, resolved as user setting -> instance setting -> env. Keys are encrypted at rest with `ENCRYPTION_KEY`. Generated posts carry `Post.aiGenerated = true`. Every run is an auditable `AgentRun`. Keep the teacher review gate mandatory.

## Data model

The core graph: `Class` <- `ClassMembership` -> `User`. A `Post` belongs to a class; ASSIGNMENT posts have a 1:1 `Assignment`; QUESTION posts have a 1:1 `Question`. Students create one `Submission` per assignment, which gets a 1:1 `Grade`. `Attachment` attaches to either a Post or Submission. `Notification` is per-user with read flags. Account/Session/VerificationToken are standard NextAuth Prisma adapter tables.

## Open-source and alpha priorities

Prioritize deployment reliability, migrations, privacy/security, Google Classroom import hardening, and teacher-reviewed agentic workflows before expanding student-facing AI features.
