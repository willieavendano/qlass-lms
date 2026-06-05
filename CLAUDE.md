# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Qlass is a self-hostable Google Classroom–style LMS. Next.js 14 (App Router) + TypeScript, PostgreSQL via Prisma, NextAuth for auth, Tailwind + Radix UI for the frontend. Pluggable file storage (local / AWS S3 / Supabase).

Note: the `openroom/` subdirectory is a separate nested git repo (the parent `qlass/` is not under git). Ignore it unless explicitly asked to work on it.

## Commands

```bash
npm run dev          # Next dev server on :3000
npm run build        # prisma generate + next build
npm run lint         # next lint (eslint)
npm run db:push      # push schema.prisma to DB (no migration files)
npm run db:migrate   # prisma migrate dev (create + apply migration)
npm run db:seed      # tsx prisma/seed.ts — demo users + DEMOCLS class
npm run db:studio    # Prisma Studio
npm run db:generate  # regenerate Prisma client
```

There is no test framework configured. After editing `prisma/schema.prisma`, run `db:push` (or `db:migrate`) and `db:generate`.

## Environment setup

Two env files are required and must stay in sync: the Prisma CLI reads `.env`, Next.js reads `.env.local` (the repo symlinks `.env -> .env.local`). Required: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. See `.env.example`. Postgres for local dev: `docker compose up postgres -d`.

## Architecture

**Auth & roles are two-tiered.**
- `SystemRole` (ADMIN/TEACHER/STUDENT/GUARDIAN) lives on `User` and is carried in the NextAuth JWT — see `src/lib/auth.ts`, where the session/jwt callbacks inject `id` and `systemRole` onto the session. The module also augments the `next-auth` types.
- `ClassRole` (OWNER/TEACHER/STUDENT/GUARDIAN) lives per-class on `ClassMembership`. A user's authority inside a class comes from their membership, not their system role.

**Authorization helpers** in `src/lib/permissions.ts` are the canonical way to gate access: `requireClassAccess(userId, classId, minRole?)`, `requireTeacherInClass(...)`, `isTeacherRole`, `isAdmin`. Use these rather than re-querying memberships inline.

**API route convention** (`src/app/api/**/route.ts`): call `requireSession()` from `src/lib/auth.ts` first — it throws a 401 `Response` if unauthenticated. Validate request bodies with `zod`, catching `z.ZodError` to return 400. Return via `NextResponse.json(...)`. See `src/app/api/classes/route.ts` as the reference pattern.

**Route protection** is centralized in `src/middleware.ts`, which wraps `next-auth/middleware` and lists every protected path prefix (both pages like `/class/*` and APIs like `/api/classes/*`). New protected routes must be added to its `matcher`.

**Prisma client** is a singleton in `src/lib/db.ts` (cached on `globalThis` outside production to survive HMR). Import `prisma` from `@/lib/db`.

**Storage is provider-abstracted** in `src/lib/storage.ts`, switched by `STORAGE_PROVIDER` (`local` | `s3` | `supabase`). `createUploadUrl`/`getDownloadUrl` return presigned URLs for S3/Supabase; for `local` they point at `/api/uploads/local`, which reads/writes `UPLOAD_DIR` (default `./uploads`). Uploads use a sign-then-upload flow via `/api/uploads/sign`.

**Agentic course builder** (`src/lib/agent/*`, `src/lib/ai.ts`, `src/lib/oer.ts`, `src/lib/crypto.ts`): a teacher can "Build with AI" on the classwork page. A server-side pipeline (Vercel AI SDK, zod structured output) plans a unit outline and drafts assignments + an explainer material; the teacher reviews and publishes (review gate — content is **never** auto-published to students). Providers are BYOK/local/env, resolved by `resolveAiConfig` (user `UserAiSetting` → instance `SystemSettings` → env `AI_PROVIDER`/etc.); keys are encrypted at rest via `ENCRYPTION_KEY` (AES-256-GCM in `crypto.ts`). Generated posts carry `Post.aiGenerated = true`. Each run is an auditable `AgentRun` row; per-course context lives in `CourseMemory`. OER usage is link-only with a proprietary-source denylist (College Board/Canva) in `src/lib/oer.ts`. See `docs/ai-models.md` for model guidance.

**Path alias:** `@/*` → `src/*`.

## Data model (prisma/schema.prisma)

The core graph: `Class` ← `ClassMembership` → `User`. A `Post` (type ANNOUNCEMENT/MATERIAL/ASSIGNMENT/QUESTION, status DRAFT/PUBLISHED/ARCHIVED) belongs to a class; ASSIGNMENT posts have a 1:1 `Assignment`, QUESTION posts a 1:1 `Question`. Students create one `Submission` per assignment (unique on `[assignmentId, studentId]`), which gets a 1:1 `Grade`. `Attachment` polymorphically attaches to either a Post or a Submission. `Notification` is per-user with read flags. Account/Session/VerificationToken are the standard NextAuth Prisma adapter tables.

Classes auto-create three `AssignmentCategory` rows (Homework/Quizzes/Projects) on creation and a unique `joinCode` (retried on collision via `generateJoinCode()` in `src/lib/utils.ts`).
