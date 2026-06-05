# Agentic Course Builder — Primitive Alpha (v0) Design

**Date:** 2026-06-04
**Status:** Approved design, pending implementation plan
**Author:** Willie Avendano + Claude

## Summary

A teacher in a Qlass class clicks **"Build with AI,"** describes a unit (topic, grade/level,
optional standards, number of items), and an agent drafts a **unit outline + several
assignments + one explainer material**, persists per-course context ("local memory"), and
presents the drafts in a **review-and-publish-all** screen. Nothing reaches students until the
teacher publishes.

The differentiation thesis (from research, high confidence): Qlass does **not** compete on
generation parity with MagicSchool / Khanmigo / Diffit. Its wedge is **self-hostable +
provider-agnostic BYOK + data sovereignty** — the axis Moodle 4.5 chose, and the design of the
GPLv3 `moodle-qbank_genai` plugin (BYOK by default).

## Decisions (locked)

| Question | Decision |
|---|---|
| Architecture | **Thin agent loop, no vectors.** Single server-side 3-step pipeline (Vercel AI SDK + zod structured output). Course memory = plain Postgres rows. No external connectors in v0. |
| Model access | Provider-agnostic. **Local/open models a first-class path** (OpenAI-compatible endpoint), plus cloud BYOK and server env. Resolution: user BYOK → instance settings → server env. |
| Alpha output | Draft a unit: outline + N assignments + 1 explainer material. |
| Student exposure | **Review gate (default).** No auto-publish to students in v0. |
| Key storage | **Dedicated `ENCRYPTION_KEY` env**, AES-256-GCM, encrypted at rest. |
| AI-origin tracking | **Add `Post.aiGenerated Boolean @default(false)` column.** |

## Scope

**In scope (v0):** teacher-triggered unit build; per-course memory persisted; outline +
assignment + material drafting; review/edit/discard/publish; BYOK + local + env provider layer;
licensing-safe OER linking.

**Out of scope (→ roadmap):** vector RAG, multi-agent orchestration, Drive/Canva/GitHub/
NotebookLM connectors, OER auto-ingestion, slide/image generation, any student-facing AI,
auto-publish to students.

## Research constraints baked into the design

- **Local model caveat:** the claim that small (3B–7B) local models match large models for
  educator tasks was **refuted (0–3)**; OmniEduBench found only Gemini-2.5 Pro cleared 60% on
  the knowledge dimension. → local is fully supported, but the *recommended* local tier is a
  larger open model (Llama 3.3 70B / Qwen2.5 72B class); small models flagged as dev/privacy
  only.
- **Review gate justified** because LLMs are weak on rigorous educational content — auto-publish
  to students is the highest-risk choice for an alpha.
- **Licensing (primary-source confirmed):**
  - College Board / AP Classroom — proprietary; scraping and redistribution **prohibited** → link-out only, never ingest.
  - Canva — redistribution/sublicensing prohibited; assets live within Canva designs → (future) create-in-Canva, never extract.
  - NotebookLM — no public consumer API (only NotebookLM Enterprise); copyrighted sharing prohibited → defer.
  - Google Drive — mature official API, Qlass already uses `googleapis` + Google OAuth → first connector worth doing (post-v0); Drive scopes need OAuth verification before prod.
  - Safe to link: OpenStax (CC-BY, commercial OK), PhET, OER Commons CC content, CK-12, Khan Academy public pages, Skew the Script (under its terms).
- **Architecture:** build on the **Vercel AI SDK** (provider-agnostic, unified BYOK, built-in
  agent loop). pgvector-as-production-RAG was partially refuted → v0 uses **no vectors**
  (structured memory rows), sidestepping the risk.

## The agent run (data flow)

A server-side pipeline, **3 typed steps** (not a free-running loop — debuggable, cheap):

```
Step 1  PLAN     topic + constraints       → UnitOutline { lessons[], objectives[], standards? }
Step 2  RESEARCH (v0-lite, optional)       → per lesson, attach 1–3 OER links from a curated
                                             CC allowlist (+ optional web search). Links only.
Step 3  AUTHOR   outline + course memory   → N AssignmentDrafts + 1 MaterialDraft (zod-validated)
                                             each assignment: title, instructions, points, 3–5 questions
        ↓
   persist AgentRun + drafts → review screen → teacher edits/discards → "Publish all"
        ↓
   create normal Post/Assignment rows (aiGenerated = true)
```

- Runs in an API route, streams step progress to the UI.
- Each step = one model call with a zod schema; failure retries once, then surfaces partial results.
- After a successful run, the agent updates `CourseMemory.summary`/`facts` so later runs have context.

## Data model (additive Prisma changes)

```prisma
model CourseMemory {        // one per class: the "local memory instance"
  id         String   @id @default(cuid())
  classId    String   @unique
  subject    String?            // "AP Statistics"
  gradeLevel String?
  standards  String?  @db.Text  // free-text / framework id
  summary    String?  @db.Text  // rolling agent-maintained context
  facts      Json?              // structured notes accrued across runs
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  class      Class    @relation(fields: [classId], references: [id], onDelete: Cascade)
}

model AgentRun {            // one agentic build invocation (audit + resumability)
  id        String   @id @default(cuid())
  classId   String
  userId    String
  kind      String   @default("UNIT_BUILD")
  status    String   @default("PENDING") // PENDING|PLANNING|AUTHORING|REVIEW|PUBLISHED|FAILED|CANCELLED
  input     Json             // topic, counts, options, autoPublish(false in v0)
  outline   Json?            // UnitOutline from step 1
  drafts    Json?            // generated drafts before they become Posts
  model     String?          // provider/model used
  error     String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  class     Class @relation(fields: [classId], references: [id], onDelete: Cascade)
  user      User  @relation(fields: [userId], references: [id])
}

model UserAiSetting {       // per-teacher BYOK override
  id        String  @id @default(cuid())
  userId    String  @unique
  provider  String           // "openai" | "anthropic" | "openai-compatible"
  baseUrl   String?          // for local / OpenAI-compatible endpoints
  model     String?
  apiKeyEnc String?  @db.Text // AES-256-GCM ciphertext
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Changes to existing models:
- `Post` → add `aiGenerated Boolean @default(false)`.
- `SystemSettings` → add `aiProvider String?`, `aiBaseUrl String?`, `aiModel String?`, `aiApiKeyEnc String?` (instance default).
- `Class` → add back-relations `courseMemory CourseMemory?` and `agentRuns AgentRun[]`.
- `User` → add back-relations `aiSetting UserAiSetting?` and `agentRuns AgentRun[]`.

Migration: `npm run db:migrate` + `npm run db:generate` (project convention).

## Provider layer — `src/lib/ai.ts`

One module, provider-agnostic, mirroring `storage.ts`:
- Built on the **Vercel AI SDK** (`ai` + provider packages). Cloud BYOK via `@ai-sdk/openai` /
  `@ai-sdk/anthropic`; **local/open via `@ai-sdk/openai-compatible`** pointed at `baseUrl`
  (Ollama / vLLM / LM Studio) — the "local is KEY" path, fully supported.
- Exposes `generateStructured(schema, prompt, opts)` and `streamText(...)`; callers are
  provider-agnostic.
- `resolveAiConfig(userId)` applies precedence: user BYOK → instance settings → server env.
- Ships a recommended-models doc: cloud default = a frontier model; local recommended = Llama
  3.3 70B / Qwen2.5 72B class; small 3B–7B models flagged dev/privacy only.

## Encryption — `src/lib/crypto.ts`

- AES-256-GCM. Key from a **dedicated `ENCRYPTION_KEY` env** (32-byte, base64); fail fast at
  startup if missing when AI is configured.
- `encrypt(plaintext) -> string` (iv:tag:ciphertext), `decrypt(string) -> plaintext`.
- Keys never logged, never returned to the client, never sent anywhere but the configured
  provider endpoint.
- Add `ENCRYPTION_KEY` to `.env.example` with generation instructions.

## OER research — `src/lib/oer.ts` (v0-lite, licensing-safe)

- Curated **allowlist** of CC/open sources (OpenStax, PhET, OER Commons CC, CK-12, Khan Academy
  public, Skew the Script under terms). Step 2 attaches **links** to lesson topics.
- Hard-coded **denylist** (College Board / AP Classroom domains, Canva): never ingest; link-out
  at most.
- No scraping, no third-party content storage. Optional web search behind a setting, **off by
  default** for offline self-hosts.

## API surface

- `POST /api/classes/[id]/agent/runs` — start a build (gated `requireClassAccess([OWNER, TEACHER])`); validates body with zod; creates `AgentRun`, kicks off pipeline, streams progress.
- `GET /api/classes/[id]/agent/runs/[runId]` — poll run status + drafts.
- `POST /api/classes/[id]/agent/runs/[runId]/publish` — turn kept drafts into `Post`/`Assignment` rows (`aiGenerated = true`), reusing existing assignment-creation logic + notifications.
- `PUT /api/settings/ai` and instance equivalent — save BYOK / instance AI config (encrypts key).

All follow the project convention: `requireSession()`, zod validation, `NextResponse.json`.

## UI surface

- **"Build with AI"** button on the class **Classwork** page (teacher/owner only).
- **Wizard modal:** topic, grade, # assignments, optional standards, model picker (resolved
  providers). No auto-publish toggle in v0 (review gate is the only path).
- **Run/progress view:** streams the 3 steps.
- **Review screen:** editable list of drafted assignments + material, per-item keep/discard,
  then **"Publish all."**
- **AI settings panel:** BYOK key entry in `/settings` (teacher) and admin settings (instance default).

## Guardrails (non-negotiable)

1. Review gate before any student exposure — the only publish path in v0.
2. Link-out, never ingest, for proprietary sources; domain denylist enforced in code.
3. Keys encrypted at rest (`ENCRYPTION_KEY`), never logged, never client-exposed.
4. Every run is an auditable `AgentRun` row (who / what / which model).
5. Visible "AI-generated — review before use" marker on drafted posts (`aiGenerated`).

## Roadmap after v0

- **v1:** pgvector RAG + ingestion of *CC-licensed* OER · Google Drive connector (OAuth already present) · multi-agent (researcher / author / **reviewer**).
- **v2:** Canva create-in-Canva connector · slide/quiz asset generation · NotebookLM Enterprise · per-student differentiation (Diffit-style).

## Risks

- Provider/output variance — mitigated by zod-validated structured output + retry.
- Local small-model quality — mitigated by recommended-models guidance + review gate.
- Cost (cloud BYOK) — teacher's own key; show token/run estimates later.
- Repo is not under git (parent `qlass/`) — spec written but not committed unless `git init`.

## Worked example

Teacher opens AP Statistics class → "Build with AI" → "Sampling Distributions, grade 11, 4
assignments" → agent plans a 5-lesson outline, links OpenStax/PhET resources, drafts 4
assignments (each with 3–5 questions) + 1 explainer → teacher reviews, tweaks one, discards
none → "Publish all" → 5 `Post` rows created (`aiGenerated = true`), students notified.
