# Alpha pilot features: email delivery, AI reviewer pass, data export/delete

**Date:** 2026-07-07
**Status:** Approved scope (email delivery → AI reviewer → export/delete), building toward the August one-class pilot.

These are the three remaining code gaps from the alpha plan (ROADMAP "Alpha" +
"Agentic LMS differentiation"): notifications are written to the DB but never
delivered, the course builder has no reviewer step, and there is no data
export/delete path (an alpha entry criterion in `docs/alpha-testing.md`).

## 1. Email notification delivery

**Problem.** Four API routes create `Notification` rows (`assignments`,
`grades/[submissionId]`, `classes/[id]/stream`, agent `publish`), but nothing
ever emails users. The schema already anticipates delivery:
`User.emailDigest: EmailDigest (IMMEDIATE | DAILY | OFF, default DAILY)` exists
and is unused.

**Design.**

- `src/lib/email.ts` — transport layer. Nodemailer SMTP transport built from
  env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
  `EMAIL_FROM`). `isEmailConfigured()`; `sendEmail({to, subject, text, html})`
  is a logged no-op when unconfigured, and never throws (delivery failures are
  logged, not surfaced to the request).
- `src/lib/email-templates.ts` — pure, testable render functions:
  `renderNotificationEmail(notification, baseUrl)` and
  `renderDigestEmail(notifications, baseUrl)`. Base URL from `NEXTAUTH_URL`.
- `src/lib/notify.ts` — `notifyUsers(recipients, payload)`: single entry point
  that (a) `createMany`s the Notification rows, (b) looks up recipients with
  `emailDigest = IMMEDIATE` and a non-null email, and (c) sends each an email.
  Email step is awaited but failure-isolated. The four existing call sites are
  refactored to use it.
- **Daily digest:** `GET /api/cron/digest`, guarded by
  `Authorization: Bearer ${CRON_SECRET}` (403 otherwise; 503 if unset). For
  each user with `emailDigest = DAILY`, collects unread notifications created
  since `digestSentAt` (or last 24 h if null); sends one summary email; stamps
  `digestSentAt`. Invoked by any external scheduler (Railway cron / GitHub
  Actions schedule). New schema field: `User.digestSentAt DateTime?`.
  This route is auth-by-secret, so it is *not* added to the NextAuth
  middleware matcher.
- **Settings:** new `notification-settings.tsx` on `/settings` — three-way
  choice (Immediate / Daily digest / Off) persisted via
  `PATCH /api/settings/notifications` (zod-validated enum).

**Non-goals:** no pg-boss/queue (pilot scale doesn't need it; `notifyUsers` is
the seam where a queue would slot in later), no per-notification-type
preferences, no unsubscribe links (in-app setting suffices for a pilot).

## 2. AI reviewer pass (course builder)

**Problem.** The unit-builder pipeline is plan → author → teacher review.
ROADMAP calls for an "AI reviewer step for grade level, clarity, source
safety" before the teacher sees drafts.

**Design.**

- `unitReviewSchema` in `src/lib/agent/schemas.ts`:
  `{ summary, clarityScore (1–5), gradeLevelFit ('below'|'on_level'|'above'),
  sourceSafety ('pass'|'flagged'), findings: [{ target, severity
  ('info'|'warn'|'fix'), issue, suggestion? }] }`.
- `reviewDrafts(cfg, input, outline, drafts)` in
  `src/lib/agent/unit-builder.ts` — prompts the model as a skeptical
  instructional reviewer: clarity of student-facing instructions, grade-level
  fit, and source safety (the `oer.ts` denylist — College Board/AP Classroom,
  Canva — is injected into the prompt so references to proprietary sources are
  flagged).
- Pipeline (`POST /api/classes/[id]/agent/runs`): after authoring, status
  becomes `REVIEWING`; the review is stored on a new `AgentRun.review Json?`
  field; then status `REVIEW` as today. **The reviewer is advisory and
  fail-open:** if the review call errors, the run still reaches `REVIEW` with
  `review: null` — a broken reviewer must not block the teacher.
- Uses the same resolved provider as the rest of the run (hybrid local/cloud
  falls out of `resolveAiConfig` for free).
- **UI:** the review phase of `build-with-ai.tsx` shows an "AI reviewer"
  panel — clarity/grade-fit/source-safety badges, summary, and per-finding
  rows colored by severity. Drafts stay editable exactly as today; the teacher
  review gate is unchanged.

## 3. Data export / delete

**Problem.** Alpha entry criteria require a documented export/delete path
before real student data.

**Design.**

- `src/lib/export.ts` — `buildUserExport(...)`: pure assembly of the export
  document (version, generatedAt, profile without `passwordHash`, memberships
  with class names, authored posts, submissions with grades and attachment
  metadata, comments, notifications).
- `GET /api/me/export` — streams that JSON as an attachment
  (`Content-Disposition: attachment; filename=qlass-export-<date>.json`).
- `DELETE /api/me` — body `{ confirmEmail }` must match the account email.
  Deletion policy (cascades only cover Account/Session/Membership/
  Notification/UserAiSetting; Post.author, Submission.student, Grade.grader,
  Comment.author, Attachment.uploader, AgentRun.user all restrict):
  1. Classes where the user is the sole OWNER **and** other members exist →
     `409` listing them (transfer or remove members first).
  2. `Grade` rows the user authored (`graderId`) outside their solely-owned
     empty classes → `409` (deleting them would destroy students' grades).
  3. Otherwise, in one transaction: delete solely-owned empty classes
     (cascade), re-parent comment replies whose parent the user authored,
     then delete the user's comments, submissions (grades cascade),
     attachment rows, agent runs, authored posts, and finally the user.
  - Storage objects for deleted attachments are best-effort deleted via
    `storage.ts`; failures are logged, not fatal.
- **UI:** "Your data" section on `/settings` — a download link and a
  type-your-email-to-confirm delete flow that signs out on success.
- `/api/me` added to the middleware matcher; `/api/cron` deliberately not.

## Cross-cutting

- **Schema changes** (additive): `User.digestSentAt DateTime?`,
  `AgentRun.review Json?`. Applied locally via `db:push`; noted in the PR
  that draft #10's migration baseline must gain a follow-up migration when it
  lands (do not merge #10 without regenerating).
- **Testing:** vitest unit tests for the pure pieces — email template
  renderers, digest selection logic, `unitReviewSchema`, review prompt
  builder, `buildUserExport`, and the delete-blocker computation.
- **Branch/PR:** one branch `feat/pilot-hardening`, one PR, one logical commit
  per feature.
- **Env additions** to `.env.example`: SMTP vars, `EMAIL_FROM`, `CRON_SECRET`.
