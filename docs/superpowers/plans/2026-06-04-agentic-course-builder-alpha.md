# Agentic Course Builder (Alpha v0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher click "Build with AI" in a class, describe a unit, and have an agent draft a unit outline + assignments + an explainer, which the teacher reviews and publishes.

**Architecture:** A server-side 3-step pipeline (Plan → Research-lite → Author) built on the Vercel AI SDK with zod structured output. Provider-agnostic (local/open + cloud BYOK + env), keys encrypted with a dedicated `ENCRYPTION_KEY`. Per-course "memory" and each run are persisted as Postgres rows. Generated drafts become normal `Post`/`Assignment` rows only when the teacher publishes (review gate). No vectors, no external connectors in v0.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma/PostgreSQL, NextAuth, Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`), zod, Vitest (new, for unit tests).

**Spec:** `docs/superpowers/specs/2026-06-04-agentic-course-builder-alpha-design.md`

**Testing note:** Pure logic (crypto, config resolution, OER rules) is TDD'd with Vitest. API routes and UI are verified with `npx tsc --noEmit`, `npm run build`, `npm run lint`, and a documented manual run. Commit after each task. The parent repo is not git-initialized; Task 0 initializes it.

---

### Task 0: Project setup — git, dependencies, env, Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `.env.example`
- Modify: `.gitignore` (create if missing)

- [ ] **Step 1: Initialize git (parent repo is not under version control)**

Run:
```bash
cd /Users/willieavendano/Developer/Code/qlass
git init
printf "node_modules\n.next\n.env\n.env.local\nuploads\n" >> .gitignore
git add -A && git commit -m "chore: initialize repo for agentic course builder work"
```
Expected: a first commit created. (If `.gitignore` already ignores these, the printf just appends duplicates — harmless; dedupe by hand if desired.)

- [ ] **Step 2: Install runtime + dev dependencies**

Run:
```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/openai-compatible
npm install -D vitest
```
Expected: packages added to `package.json`.

- [ ] **Step 3: Add test script to package.json**

In `package.json` `"scripts"`, add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 5: Add env vars to `.env.example`**

Append to `.env.example`:
```bash
# --- Agentic Course Builder ---
# 32-byte key (base64) used to encrypt stored BYOK provider API keys (AES-256-GCM).
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=

# Optional instance-default AI provider (used when a teacher has no BYOK key).
# provider: openai | anthropic | openai-compatible
AI_PROVIDER=
AI_MODEL=
AI_BASE_URL=        # for openai-compatible (Ollama/vLLM/LM Studio), e.g. http://localhost:11434/v1
AI_API_KEY=         # plaintext server key; only for self-hosted single-tenant use
# Allow the agent to use web search in the research step (off by default).
AI_WEB_SEARCH=false
```

- [ ] **Step 6: Set a real ENCRYPTION_KEY in local env**

Run:
```bash
node -e "console.log('ENCRYPTION_KEY='+require('crypto').randomBytes(32).toString('base64'))" >> .env.local
```
Expected: a line appended to `.env.local`. (`.env` is symlinked to `.env.local` per CLAUDE.md, so Prisma/Next both see it.)

- [ ] **Step 7: Verify the project still builds**

Run: `npx tsc --noEmit`
Expected: PASS (no new code yet).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .env.example
git commit -m "chore: add AI SDK, vitest, and ENCRYPTION_KEY env scaffolding"
```

---

### Task 1: Database schema — new models, columns, relations

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the `Post.aiGenerated` column**

In `model Post`, after the `youtubeUrl`/`linkUrl` fields (near line 185), add:
```prisma
  aiGenerated Boolean @default(false)
```

- [ ] **Step 2: Add AI fields to `SystemSettings`**

In `model SystemSettings`, before `updatedAt`, add:
```prisma
  aiProvider      String?
  aiBaseUrl       String?
  aiModel         String?
  aiApiKeyEnc     String?  @db.Text
  aiWebSearch     Boolean  @default(false)
```

- [ ] **Step 3: Add back-relations to `Class` and `User`**

In `model Class` relations block add:
```prisma
  courseMemory CourseMemory?
  agentRuns    AgentRun[]
```
In `model User` relations block add:
```prisma
  aiSetting   UserAiSetting?
  agentRuns   AgentRun[]
```

- [ ] **Step 4: Add the three new models at the end of the schema**

```prisma
model CourseMemory {
  id         String   @id @default(cuid())
  classId    String   @unique
  subject    String?
  gradeLevel String?
  standards  String?  @db.Text
  summary    String?  @db.Text
  facts      Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  class Class @relation(fields: [classId], references: [id], onDelete: Cascade)
}

model AgentRun {
  id        String   @id @default(cuid())
  classId   String
  userId    String
  kind      String   @default("UNIT_BUILD")
  status    String   @default("PENDING")
  input     Json
  outline   Json?
  drafts    Json?
  model     String?
  error     String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  class Class @relation(fields: [classId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id])

  @@index([classId])
}

model UserAiSetting {
  id        String   @id @default(cuid())
  userId    String   @unique
  provider  String
  baseUrl   String?
  model     String?
  apiKeyEnc String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 5: Create and apply the migration + regenerate client**

Run: `npm run db:migrate -- --name agentic_course_builder`
Then: `npm run db:generate`
Expected: migration created under `prisma/migrations/`, Prisma client regenerated, no errors. (Requires Postgres up: `docker compose up postgres -d`.)

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add CourseMemory, AgentRun, UserAiSetting models and AI fields"
```

---

### Task 2: Encryption helper (`src/lib/crypto.ts`) — TDD

**Files:**
- Create: `src/lib/crypto.ts`
- Test: `src/lib/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/crypto.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "./crypto";

beforeAll(() => {
  // 32 bytes, base64
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("crypto", () => {
  it("round-trips a secret", () => {
    const plain = "sk-test-1234567890";
    const enc = encryptSecret(plain);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("produces different ciphertext each call (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("throws on tampered ciphertext", () => {
    const enc = encryptSecret("hello");
    const tampered = enc.slice(0, -2) + (enc.endsWith("a") ? "b" : "a");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/crypto.test.ts`
Expected: FAIL (module/exports not found).

- [ ] **Step 3: Write the implementation**

Create `src/lib/crypto.ts`:
```ts
import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) {
    throw new Error("ENCRYPTION_KEY is not set — required to store AI provider keys.");
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (base64-encoded).");
  }
  return key;
}

/** Encrypts a secret. Returns "iv:tag:ciphertext", all base64. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/** Decrypts a value produced by encryptSecret. Throws if tampered or malformed. */
export function decryptSecret(value: string): string {
  const [ivB64, tagB64, dataB64] = value.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed ciphertext.");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/crypto.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts src/lib/crypto.test.ts
git commit -m "feat(crypto): AES-256-GCM encrypt/decrypt for stored provider keys"
```

---

### Task 3: AI provider layer (`src/lib/ai.ts`) — config resolution TDD + model factory

**Files:**
- Create: `src/lib/ai.ts`
- Test: `src/lib/ai.test.ts`

- [ ] **Step 1: Write the failing test for config resolution**

Create `src/lib/ai.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveAiConfig, type AiConfigInputs } from "./ai";

const base: AiConfigInputs = { userSetting: null, systemSettings: null, env: {} };

describe("resolveAiConfig", () => {
  it("prefers the user BYOK setting", () => {
    const cfg = resolveAiConfig({
      ...base,
      userSetting: { provider: "openai", model: "gpt-x", baseUrl: null, apiKey: "u-key" },
      systemSettings: { provider: "anthropic", model: "claude-x", baseUrl: null, apiKey: "s-key" },
      env: { AI_PROVIDER: "openai-compatible", AI_API_KEY: "e-key" },
    });
    expect(cfg).toMatchObject({ provider: "openai", model: "gpt-x", apiKey: "u-key" });
  });

  it("falls back to system settings when no user setting", () => {
    const cfg = resolveAiConfig({
      ...base,
      systemSettings: { provider: "anthropic", model: "claude-x", baseUrl: null, apiKey: "s-key" },
      env: { AI_PROVIDER: "openai", AI_API_KEY: "e-key" },
    });
    expect(cfg).toMatchObject({ provider: "anthropic", model: "claude-x", apiKey: "s-key" });
  });

  it("falls back to env when nothing else is set", () => {
    const cfg = resolveAiConfig({
      ...base,
      env: { AI_PROVIDER: "openai", AI_MODEL: "gpt-env", AI_API_KEY: "e-key" },
    });
    expect(cfg).toMatchObject({ provider: "openai", model: "gpt-env", apiKey: "e-key" });
  });

  it("returns null when nothing is configured", () => {
    expect(resolveAiConfig(base)).toBeNull();
  });

  it("requires baseUrl for openai-compatible", () => {
    expect(() =>
      resolveAiConfig({ ...base, env: { AI_PROVIDER: "openai-compatible", AI_MODEL: "llama" } })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/ai.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/ai.ts`**

Create `src/lib/ai.ts`:
```ts
import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

export type AiProvider = "openai" | "anthropic" | "openai-compatible";

export type ResolvedAiConfig = {
  provider: AiProvider;
  model: string;
  baseUrl: string | null;
  apiKey: string | null;
};

type SettingShape = {
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  apiKey: string | null;
} | null;

export type AiConfigInputs = {
  userSetting: SettingShape;
  systemSettings: SettingShape;
  env: {
    AI_PROVIDER?: string;
    AI_MODEL?: string;
    AI_BASE_URL?: string;
    AI_API_KEY?: string;
  };
};

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-latest",
  "openai-compatible": "llama3.3:70b",
};

function normalizeProvider(p: string | null | undefined): AiProvider | null {
  if (p === "openai" || p === "anthropic" || p === "openai-compatible") return p;
  return null;
}

/** Pure precedence: user BYOK → system settings → env. Returns null if unconfigured. */
export function resolveAiConfig(inputs: AiConfigInputs): ResolvedAiConfig | null {
  const candidates: SettingShape[] = [
    inputs.userSetting,
    inputs.systemSettings,
    inputs.env.AI_PROVIDER
      ? {
          provider: inputs.env.AI_PROVIDER,
          model: inputs.env.AI_MODEL ?? null,
          baseUrl: inputs.env.AI_BASE_URL ?? null,
          apiKey: inputs.env.AI_API_KEY ?? null,
        }
      : null,
  ];
  for (const c of candidates) {
    const provider = normalizeProvider(c?.provider);
    if (!c || !provider) continue;
    if (provider === "openai-compatible" && !c.baseUrl) {
      throw new Error("openai-compatible provider requires a base URL.");
    }
    return {
      provider,
      model: c.model || DEFAULT_MODELS[provider],
      baseUrl: c.baseUrl ?? null,
      apiKey: c.apiKey ?? null,
    };
  }
  return null;
}

/** Loads, decrypts, and resolves the effective AI config for a user. */
export async function loadAiConfig(userId: string): Promise<ResolvedAiConfig | null> {
  const [userRow, sys] = await Promise.all([
    prisma.userAiSetting.findUnique({ where: { userId } }),
    prisma.systemSettings.findUnique({ where: { id: "default" } }),
  ]);
  return resolveAiConfig({
    userSetting: userRow
      ? {
          provider: userRow.provider,
          model: userRow.model,
          baseUrl: userRow.baseUrl,
          apiKey: userRow.apiKeyEnc ? decryptSecret(userRow.apiKeyEnc) : null,
        }
      : null,
    systemSettings: sys
      ? {
          provider: sys.aiProvider,
          model: sys.aiModel,
          baseUrl: sys.aiBaseUrl,
          apiKey: sys.aiApiKeyEnc ? decryptSecret(sys.aiApiKeyEnc) : null,
        }
      : null,
    env: {
      AI_PROVIDER: process.env.AI_PROVIDER,
      AI_MODEL: process.env.AI_MODEL,
      AI_BASE_URL: process.env.AI_BASE_URL,
      AI_API_KEY: process.env.AI_API_KEY,
    },
  });
}

function buildModel(cfg: ResolvedAiConfig) {
  switch (cfg.provider) {
    case "openai":
      return createOpenAI({ apiKey: cfg.apiKey ?? undefined })(cfg.model);
    case "anthropic":
      return createAnthropic({ apiKey: cfg.apiKey ?? undefined })(cfg.model);
    case "openai-compatible":
      return createOpenAICompatible({
        name: "local",
        baseURL: cfg.baseUrl!,
        apiKey: cfg.apiKey ?? undefined,
      })(cfg.model);
  }
}

/** Provider-agnostic structured generation. Throws if AI is not configured. */
export async function generateStructured<T>(
  cfg: ResolvedAiConfig | null,
  schema: z.ZodType<T>,
  prompt: string
): Promise<T> {
  if (!cfg) throw new Error("AI is not configured for this user or instance.");
  const { object } = await generateObject({ model: buildModel(cfg), schema, prompt });
  return object;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/ai.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai.ts src/lib/ai.test.ts
git commit -m "feat(ai): provider-agnostic config resolution and structured generation"
```

---

### Task 4: OER source rules (`src/lib/oer.ts`) — TDD

**Files:**
- Create: `src/lib/oer.ts`
- Test: `src/lib/oer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/oer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isAllowedSource, isDeniedSource, OER_SOURCES } from "./oer";

describe("oer rules", () => {
  it("denies College Board / AP Classroom", () => {
    expect(isDeniedSource("https://apclassroom.collegeboard.org/x")).toBe(true);
    expect(isDeniedSource("https://www.collegeboard.org/y")).toBe(true);
  });

  it("denies Canva", () => {
    expect(isDeniedSource("https://www.canva.com/design/abc")).toBe(true);
  });

  it("allows OpenStax and PhET", () => {
    expect(isAllowedSource("https://openstax.org/books/statistics")).toBe(true);
    expect(isAllowedSource("https://phet.colorado.edu/sims/x")).toBe(true);
  });

  it("treats denied sources as not allowed even if otherwise unknown", () => {
    expect(isAllowedSource("https://www.collegeboard.org/y")).toBe(false);
  });

  it("exposes a non-empty curated source list", () => {
    expect(OER_SOURCES.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/oer.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/oer.ts`**

Create `src/lib/oer.ts`:
```ts
/** Curated, openly-licensed sources the agent may LINK to (never scrape/ingest). */
export const OER_SOURCES = [
  { name: "OpenStax", domain: "openstax.org", license: "CC BY" },
  { name: "PhET Interactive Simulations", domain: "phet.colorado.edu", license: "CC BY" },
  { name: "OER Commons", domain: "oercommons.org", license: "varies (CC)" },
  { name: "CK-12", domain: "ck12.org", license: "CC BY-NC" },
  { name: "Khan Academy", domain: "khanacademy.org", license: "public pages" },
  { name: "Skew the Script", domain: "skewthescript.org", license: "per site terms" },
] as const;

/** Proprietary domains the agent must NEVER ingest from (link-out at most, per ToS). */
export const DENIED_DOMAINS = [
  "collegeboard.org",
  "apclassroom.collegeboard.org",
  "canva.com",
] as const;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isDeniedSource(url: string): boolean {
  const host = hostOf(url);
  return DENIED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export function isAllowedSource(url: string): boolean {
  if (isDeniedSource(url)) return false;
  const host = hostOf(url);
  return OER_SOURCES.some((s) => host === s.domain || host.endsWith(`.${s.domain}`));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/oer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/oer.ts src/lib/oer.test.ts
git commit -m "feat(oer): curated OER allowlist and proprietary-source denylist"
```

---

### Task 5: Agent pipeline (`src/lib/agent/unit-builder.ts`)

**Files:**
- Create: `src/lib/agent/schemas.ts`
- Create: `src/lib/agent/unit-builder.ts`
- Test: `src/lib/agent/schemas.test.ts`

- [ ] **Step 1: Write a failing test for the draft schemas**

Create `src/lib/agent/schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { unitOutlineSchema, unitDraftsSchema } from "./schemas";

describe("agent schemas", () => {
  it("accepts a valid outline", () => {
    const ok = unitOutlineSchema.safeParse({
      title: "Sampling Distributions",
      objectives: ["Understand sampling variability"],
      lessons: [{ title: "Intro", summary: "What is a sampling distribution" }],
    });
    expect(ok.success).toBe(true);
  });

  it("rejects drafts with no assignments", () => {
    const bad = unitDraftsSchema.safeParse({ assignments: [], material: { title: "x", body: "y" } });
    expect(bad.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/agent/schemas.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/agent/schemas.ts`**

Create `src/lib/agent/schemas.ts`:
```ts
import { z } from "zod";

export const unitOutlineSchema = z.object({
  title: z.string().min(1),
  objectives: z.array(z.string()).min(1),
  lessons: z
    .array(z.object({ title: z.string().min(1), summary: z.string().min(1) }))
    .min(1),
});
export type UnitOutline = z.infer<typeof unitOutlineSchema>;

export const assignmentDraftSchema = z.object({
  title: z.string().min(1),
  instructions: z.string().min(1),
  points: z.number().int().min(0).max(1000),
  questions: z.array(z.string().min(1)).min(1).max(8),
});
export type AssignmentDraft = z.infer<typeof assignmentDraftSchema>;

export const materialDraftSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});
export type MaterialDraft = z.infer<typeof materialDraftSchema>;

export const unitDraftsSchema = z.object({
  assignments: z.array(assignmentDraftSchema).min(1),
  material: materialDraftSchema,
});
export type UnitDrafts = z.infer<typeof unitDraftsSchema>;

/** Request body for starting a unit build. */
export const buildInputSchema = z.object({
  topic: z.string().min(1),
  gradeLevel: z.string().optional(),
  standards: z.string().optional(),
  assignmentCount: z.number().int().min(1).max(8).default(3),
});
export type BuildInput = z.infer<typeof buildInputSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/agent/schemas.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement the pipeline `src/lib/agent/unit-builder.ts`**

Create `src/lib/agent/unit-builder.ts`:
```ts
import { generateStructured, type ResolvedAiConfig } from "@/lib/ai";
import { OER_SOURCES } from "@/lib/oer";
import {
  unitOutlineSchema,
  unitDraftsSchema,
  type BuildInput,
  type UnitOutline,
  type UnitDrafts,
} from "./schemas";

const SOURCE_HINT = OER_SOURCES.map((s) => `${s.name} (${s.domain})`).join(", ");

/** Step 1: PLAN — produce a unit outline. */
export async function planUnit(
  cfg: ResolvedAiConfig | null,
  input: BuildInput
): Promise<UnitOutline> {
  const prompt = `You are a curriculum designer. Create a concise unit outline for:
Topic: ${input.topic}
${input.gradeLevel ? `Grade level: ${input.gradeLevel}` : ""}
${input.standards ? `Standards/framework: ${input.standards}` : ""}
Produce 3-6 lessons, each with a one-sentence summary, and 2-5 measurable objectives.`;
  return generateStructured(cfg, unitOutlineSchema, prompt);
}

/** Step 3: AUTHOR — draft assignments + one explainer material from the outline.
 *  (Step 2 RESEARCH is folded in as a source hint; v0 links only, never ingests.) */
export async function authorDrafts(
  cfg: ResolvedAiConfig | null,
  input: BuildInput,
  outline: UnitOutline,
  priorSummary?: string | null
): Promise<UnitDrafts> {
  const prompt = `You are an expert teacher building classwork for the unit "${outline.title}".
${priorSummary ? `Prior course context: ${priorSummary}` : ""}
Objectives: ${outline.objectives.join("; ")}
Lessons: ${outline.lessons.map((l) => `${l.title} — ${l.summary}`).join("; ")}

Create exactly ${input.assignmentCount} assignments and 1 explainer material.
Each assignment: a clear title, student-facing instructions, a point value, and 1-8 questions.
The material: a title and a clear written explainer (plain text/markdown) students can read.
When you reference outside resources, only suggest openly-licensed ones such as: ${SOURCE_HINT}.
Do NOT reproduce copyrighted material (e.g. College Board / AP Classroom).`;
  return generateStructured(cfg, unitDraftsSchema, prompt);
}
```

- [ ] **Step 6: Verify everything compiles + tests pass**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/agent
git commit -m "feat(agent): unit-build pipeline schemas and plan/author steps"
```

---

### Task 6: AI settings API + middleware

**Files:**
- Create: `src/app/api/settings/ai/route.ts`
- Modify: `src/middleware.ts:4-18` (add `/api/settings/:path*` to matcher)

- [ ] **Step 1: Add the settings route to middleware**

In `src/middleware.ts` `matcher`, add this line after `"/api/admin/:path*",`:
```ts
    "/api/settings/:path*",
```

- [ ] **Step 2: Implement the AI settings route**

Create `src/app/api/settings/ai/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";

const schema = z.object({
  provider: z.enum(["openai", "anthropic", "openai-compatible"]),
  model: z.string().optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(), // omitted => keep existing
});

export async function GET() {
  const session = await requireSession();
  const row = await prisma.userAiSetting.findUnique({
    where: { userId: session.user.id },
  });
  // Never return the key; just whether one is stored.
  return NextResponse.json({
    setting: row
      ? {
          provider: row.provider,
          model: row.model,
          baseUrl: row.baseUrl,
          hasKey: Boolean(row.apiKeyEnc),
        }
      : null,
  });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  try {
    const data = schema.parse(await req.json());
    if (data.provider === "openai-compatible" && !data.baseUrl) {
      return NextResponse.json(
        { error: "baseUrl is required for openai-compatible" },
        { status: 400 }
      );
    }
    const apiKeyEnc = data.apiKey ? encryptSecret(data.apiKey) : undefined;
    const setting = await prisma.userAiSetting.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        provider: data.provider,
        model: data.model,
        baseUrl: data.baseUrl,
        apiKeyEnc,
      },
      update: {
        provider: data.provider,
        model: data.model,
        baseUrl: data.baseUrl,
        ...(apiKeyEnc ? { apiKeyEnc } : {}),
      },
    });
    return NextResponse.json({
      setting: {
        provider: setting.provider,
        model: setting.model,
        baseUrl: setting.baseUrl,
        hasKey: Boolean(setting.apiKeyEnc),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save AI settings" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/settings/ai/route.ts src/middleware.ts
git commit -m "feat(api): BYOK AI settings route (encrypts key, never returns it)"
```

---

### Task 7: Agent run API routes (start, get, publish)

**Files:**
- Create: `src/app/api/classes/[id]/agent/runs/route.ts`
- Create: `src/app/api/classes/[id]/agent/runs/[runId]/route.ts`
- Create: `src/app/api/classes/[id]/agent/runs/[runId]/publish/route.ts`

(Routes under `/api/classes/*` are already covered by middleware.)

- [ ] **Step 1: Implement the start route (POST) + list (GET)**

Create `src/app/api/classes/[id]/agent/runs/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { ClassRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";
import { loadAiConfig } from "@/lib/ai";
import { buildInputSchema } from "@/lib/agent/schemas";
import { planUnit, authorDrafts } from "@/lib/agent/unit-builder";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  const membership = await requireClassAccess(session.user.id, params.id, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const input = buildInputSchema.parse(await req.json());
    const cfg = await loadAiConfig(session.user.id);
    if (!cfg) {
      return NextResponse.json(
        { error: "AI is not configured. Add a provider key in Settings." },
        { status: 400 }
      );
    }

    const run = await prisma.agentRun.create({
      data: {
        classId: params.id,
        userId: session.user.id,
        status: "PLANNING",
        input,
        model: `${cfg.provider}:${cfg.model}`,
      },
    });

    // Run the pipeline synchronously; persist progress on the run row.
    try {
      const memory = await prisma.courseMemory.findUnique({
        where: { classId: params.id },
      });
      const outline = await planUnit(cfg, input);
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { status: "AUTHORING", outline },
      });
      const drafts = await authorDrafts(cfg, input, outline, memory?.summary);
      const updated = await prisma.agentRun.update({
        where: { id: run.id },
        data: { status: "REVIEW", drafts },
      });

      // Update per-course memory so later runs have context.
      await prisma.courseMemory.upsert({
        where: { classId: params.id },
        create: {
          classId: params.id,
          gradeLevel: input.gradeLevel,
          standards: input.standards,
          subject: input.topic,
          summary: `Unit drafted: ${outline.title}. Objectives: ${outline.objectives.join("; ")}`,
        },
        update: {
          summary: `Latest unit: ${outline.title}. Objectives: ${outline.objectives.join("; ")}`,
        },
      });

      return NextResponse.json({ run: updated }, { status: 201 });
    } catch (pipelineError) {
      const failed = await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          error: pipelineError instanceof Error ? pipelineError.message : "Pipeline failed",
        },
      });
      return NextResponse.json({ run: failed }, { status: 502 });
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to start build" }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  const membership = await requireClassAccess(session.user.id, params.id, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const runs = await prisma.agentRun.findMany({
    where: { classId: params.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ runs });
}
```

- [ ] **Step 2: Implement the get-run route**

Create `src/app/api/classes/[id]/agent/runs/[runId]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { ClassRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: { id: string; runId: string } }
) {
  const session = await requireSession();
  const membership = await requireClassAccess(session.user.id, params.id, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const run = await prisma.agentRun.findFirst({
    where: { id: params.runId, classId: params.id },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ run });
}
```

- [ ] **Step 3: Implement the publish route**

Create `src/app/api/classes/[id]/agent/runs/[runId]/publish/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { ClassRole, NotificationType, PostStatus, PostType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";
import { unitDraftsSchema } from "@/lib/agent/schemas";

// The teacher may edit/trim drafts client-side, so accept the final drafts in the body.
const schema = z.object({ drafts: unitDraftsSchema });

export async function POST(
  req: Request,
  { params }: { params: { id: string; runId: string } }
) {
  const session = await requireSession();
  const membership = await requireClassAccess(session.user.id, params.id, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { drafts } = schema.parse(await req.json());
    const run = await prisma.agentRun.findFirst({
      where: { id: params.runId, classId: params.id },
    });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const created = [];
    for (const a of drafts.assignments) {
      const instructions = `${a.instructions}\n\nQuestions:\n${a.questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n")}`;
      const post = await prisma.post.create({
        data: {
          classId: params.id,
          authorId: session.user.id,
          type: PostType.ASSIGNMENT,
          status: PostStatus.PUBLISHED,
          title: a.title,
          points: a.points,
          aiGenerated: true,
          publishedAt: new Date(),
          assignment: { create: { instructions } },
        },
      });
      created.push(post.id);
    }

    // The explainer material as a MATERIAL post.
    await prisma.post.create({
      data: {
        classId: params.id,
        authorId: session.user.id,
        type: PostType.MATERIAL,
        status: PostStatus.PUBLISHED,
        title: drafts.material.title,
        content: drafts.material.body,
        aiGenerated: true,
        publishedAt: new Date(),
      },
    });

    // Notify students of the new assignments.
    const students = await prisma.classMembership.findMany({
      where: { classId: params.id, role: ClassRole.STUDENT },
      select: { userId: true },
    });
    if (students.length && created.length) {
      await prisma.notification.createMany({
        data: students.map((s) => ({
          userId: s.userId,
          type: NotificationType.ASSIGNMENT_DUE,
          title: `New classwork in your class`,
          body: `${created.length} new assignment(s) published`,
          link: `/class/${params.id}/classwork`,
        })),
      });
    }

    const updated = await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "PUBLISHED" },
    });
    return NextResponse.json({ run: updated, createdPostIds: created });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/classes/\[id\]/agent
git commit -m "feat(api): agent run start, get, and publish routes"
```

---

### Task 8: AI settings UI panel

**Files:**
- Create: `src/components/settings/ai-settings.tsx`
- Modify: `src/app/settings/page.tsx` (mount the panel)

- [ ] **Step 1: Build the AI settings client component**

Create `src/components/settings/ai-settings.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Setting = {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  hasKey: boolean;
} | null;

export function AiSettings() {
  const [setting, setSetting] = useState<Setting>(null);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((d) => {
        if (d.setting) {
          setSetting(d.setting);
          setProvider(d.setting.provider);
          setModel(d.setting.model ?? "");
          setBaseUrl(d.setting.baseUrl ?? "");
        }
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const body: Record<string, unknown> = { provider };
    if (model) body.model = model;
    if (baseUrl) body.baseUrl = baseUrl;
    if (apiKey) body.apiKey = apiKey;
    const res = await fetch("/api/settings/ai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const d = await res.json();
      setSetting(d.setting);
      setApiKey("");
      setSaved(true);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">AI provider (BYOK)</h2>
          <p className="text-sm text-slate-500">
            Bring your own key. For local/open models, choose “OpenAI-compatible” and point the
            base URL at Ollama / vLLM / LM Studio (e.g. http://localhost:11434/v1). Recommended
            local models: Llama 3.3 70B or Qwen2.5 72B — small 3B–7B models are dev/privacy only.
          </p>
        </div>
        <form onSubmit={save} className="space-y-3">
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai-compatible">OpenAI-compatible (local/open)</option>
          </select>
          <Input placeholder="Model (optional)" value={model} onChange={(e) => setModel(e.target.value)} />
          {provider === "openai-compatible" && (
            <Input
              placeholder="Base URL (e.g. http://localhost:11434/v1)"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          )}
          <Input
            type="password"
            placeholder={setting?.hasKey ? "API key (stored — leave blank to keep)" : "API key"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button type="submit">Save</Button>
            {saved && <span className="text-sm text-teal-600">Saved</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Mount the panel on the settings page**

In `src/app/settings/page.tsx`, import and render `<AiSettings />`:
```tsx
import { AiSettings } from "@/components/settings/ai-settings";
```
Add `<AiSettings />` into the page's content (in the main settings stack). If the page is a server component, this works because `AiSettings` is a client component. Place it after the existing settings sections.

- [ ] **Step 3: Verify compile + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/ai-settings.tsx src/app/settings/page.tsx
git commit -m "feat(ui): BYOK AI provider settings panel"
```

---

### Task 9: "Build with AI" wizard + progress + review UI

**Files:**
- Create: `src/components/class/build-with-ai.tsx`
- Modify: `src/app/class/[id]/classwork/page.tsx` (add the button + mount the modal)

- [ ] **Step 1: Build the Build-with-AI client component**

Create `src/components/class/build-with-ai.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type AssignmentDraft = { title: string; instructions: string; points: number; questions: string[] };
type Drafts = { assignments: AssignmentDraft[]; material: { title: string; body: string } };

export function BuildWithAi({ classId, onPublished }: { classId: string; onPublished: () => void }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"form" | "running" | "review" | "error">("form");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ topic: "", gradeLevel: "", standards: "", assignmentCount: 3 });
  const [runId, setRunId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafts | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setPhase("running");
    setError("");
    const res = await fetch(`/api/classes/${classId}/agent/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error?.toString?.() ?? "Build failed");
      setPhase("error");
      return;
    }
    setRunId(d.run.id);
    setDrafts(d.run.drafts);
    setPhase("review");
  }

  function removeAssignment(i: number) {
    if (!drafts) return;
    setDrafts({ ...drafts, assignments: drafts.assignments.filter((_, idx) => idx !== i) });
  }

  async function publish() {
    if (!drafts || !runId) return;
    setPhase("running");
    const res = await fetch(`/api/classes/${classId}/agent/runs/${runId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drafts }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error?.toString?.() ?? "Publish failed");
      setPhase("error");
      return;
    }
    setOpen(false);
    setPhase("form");
    setDrafts(null);
    setRunId(null);
    onPublished();
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" aria-hidden />
        Build with AI
      </Button>
    );
  }

  return (
    <Card className="animate-slide-up">
      <CardContent className="space-y-4 pt-6">
        {phase === "form" && (
          <form onSubmit={start} className="space-y-3">
            <p className="eyebrow">Build a unit with AI</p>
            <Input
              placeholder="Topic (e.g. AP Statistics: Sampling Distributions)"
              required
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
            <Input
              placeholder="Grade level (optional)"
              value={form.gradeLevel}
              onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
            />
            <Input
              placeholder="Standards / framework (optional)"
              value={form.standards}
              onChange={(e) => setForm({ ...form, standards: e.target.value })}
            />
            <Input
              type="number"
              className="w-40"
              min={1}
              max={8}
              value={form.assignmentCount}
              onChange={(e) => setForm({ ...form, assignmentCount: +e.target.value })}
            />
            <div className="flex items-center gap-3">
              <Button type="submit">Generate drafts</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {phase === "running" && (
          <p className="text-sm text-slate-500">Agent is working… planning and drafting classwork.</p>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="ghost" onClick={() => setPhase("form")}>
              Back
            </Button>
          </div>
        )}

        {phase === "review" && drafts && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Review drafts</p>
              <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                AI-generated — review before use
              </span>
            </div>
            {drafts.assignments.map((a, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <Input
                  className="mb-2 font-semibold"
                  value={a.title}
                  onChange={(e) => {
                    const next = [...drafts.assignments];
                    next[i] = { ...a, title: e.target.value };
                    setDrafts({ ...drafts, assignments: next });
                  }}
                />
                <Textarea
                  value={a.instructions}
                  onChange={(e) => {
                    const next = [...drafts.assignments];
                    next[i] = { ...a, instructions: e.target.value };
                    setDrafts({ ...drafts, assignments: next });
                  }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {a.points} pts · {a.questions.length} questions
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeAssignment(i)}>
                    Discard
                  </Button>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-sm font-semibold">{drafts.material.title}</p>
              <p className="mt-1 line-clamp-3 text-sm text-slate-500">{drafts.material.body}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={publish} disabled={drafts.assignments.length === 0}>
                Publish all
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Mount it on the classwork page**

In `src/app/class/[id]/classwork/page.tsx`:
- Add the import:
```tsx
import { BuildWithAi } from "@/components/class/build-with-ai";
```
- In the header actions block (the `{isTeacher && (...)}` near line 74), render the button next to "Create assignment":
```tsx
        {isTeacher && (
          <div className="flex items-center gap-2">
            <BuildWithAi classId={params.id} onPublished={load} />
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4" aria-hidden />
              Create assignment
            </Button>
          </div>
        )}
```

- [ ] **Step 3: Verify compile + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/class/build-with-ai.tsx src/app/class/\[id\]/classwork/page.tsx
git commit -m "feat(ui): Build with AI wizard, progress, and review-and-publish flow"
```

---

### Task 10: AI-generated marker, docs, and full verification

**Files:**
- Modify: `src/app/class/[id]/classwork/page.tsx` (show an "AI" badge on `aiGenerated` posts)
- Modify: `src/app/api/classes/[id]/classwork/route.ts:23-29` (select `aiGenerated`)
- Create: `docs/ai-models.md`
- Modify: `CLAUDE.md` (document the feature briefly)

- [ ] **Step 1: Include `aiGenerated` in the classwork query**

In `src/app/api/classes/[id]/classwork/route.ts`, the `findMany` returns full posts already (no `select`), so `aiGenerated` is included automatically. Confirm by reading the file; no change needed unless a `select` was added. (If a `select` exists, add `aiGenerated: true`.)

- [ ] **Step 2: Show an AI badge in the classwork list**

In `src/app/class/[id]/classwork/page.tsx`:
- Extend the `Post` type with `aiGenerated?: boolean`.
- In the badges row (near line 152), add:
```tsx
                            {post.aiGenerated && (
                              <Badge variant="outline">AI</Badge>
                            )}
```

- [ ] **Step 3: Write the recommended-models doc**

Create `docs/ai-models.md`:
```markdown
# AI provider & model guidance

Qlass is provider-agnostic and BYOK. Configure under Settings → AI provider.

## Cloud (BYOK)
- OpenAI: `gpt-4o` (default), `gpt-4o-mini` for cheaper drafts.
- Anthropic: `claude-3-5-sonnet-latest`.

## Local / open (OpenAI-compatible)
Point the base URL at your runtime (Ollama `http://localhost:11434/v1`, vLLM, or LM Studio).
- **Recommended:** Llama 3.3 70B or Qwen2.5 72B class for usable lesson/asset quality.
- **Dev/privacy only:** 3B–7B models. Benchmarks (OmniEduBench) show small models are weak on
  rigorous educational content — the teacher review gate is mandatory regardless of model.

## Precedence
Effective config = user BYOK setting → instance SystemSettings → server env (`AI_PROVIDER`, etc.).
```

- [ ] **Step 4: Document the feature in CLAUDE.md**

Append a short subsection under "Architecture" in `CLAUDE.md`:
```markdown
**Agentic course builder** (`src/lib/agent/*`, `src/lib/ai.ts`, `src/lib/oer.ts`): a teacher
can "Build with AI" on the classwork page. A server-side pipeline (Vercel AI SDK, zod output)
plans a unit outline and drafts assignments + an explainer; the teacher reviews and publishes
(review gate — never auto-published). Providers are BYOK/local/env (`resolveAiConfig` precedence),
keys encrypted via `ENCRYPTION_KEY`. Generated posts carry `Post.aiGenerated = true`. OER usage
is link-only with a proprietary-source denylist (`src/lib/oer.ts`).
```

- [ ] **Step 5: Full verification**

Run:
```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```
Expected: tests PASS, no type errors, lint clean, build succeeds.

- [ ] **Step 6: Manual smoke test (documented, run once)**

1. `docker compose up postgres -d` (if not running).
2. Ensure `ENCRYPTION_KEY` is set in `.env.local`; set `AI_PROVIDER`/`AI_API_KEY` OR add a BYOK key in Settings.
3. `npm run dev`, log in as a teacher (see `npm run db:seed` demo users).
4. Open a class → Classwork → "Build with AI" → enter "AP Statistics: Sampling Distributions", grade 11, 3 assignments → Generate.
5. Confirm drafts appear, edit one, discard one, "Publish all".
6. Confirm new assignments appear in the list with an "AI" badge and the explainer material is created.

- [ ] **Step 7: Commit**

```bash
git add docs/ai-models.md CLAUDE.md src/app/class/\[id\]/classwork/page.tsx
git commit -m "feat: AI-generated post badge, model guidance docs, feature docs"
```

---

## Self-Review

**Spec coverage:**
- Thin 3-step pipeline → Task 5 (planUnit/authorDrafts; research folded as source hint). ✓
- Provider layer (local/BYOK/env, precedence) → Task 3. ✓
- Encryption (`ENCRYPTION_KEY`, AES-256-GCM) → Task 2. ✓
- New models + `aiGenerated` column → Task 1. ✓
- Review gate (no auto-publish) → Task 7 publish route + Task 9 UI (no auto-publish path). ✓
- Licensing guardrails (allowlist/denylist, link-only) → Task 4 + prompt in Task 5. ✓
- API surface (start/get/publish + settings) → Tasks 6, 7. ✓
- UI (button, wizard, progress, review, settings) → Tasks 8, 9. ✓
- Audit (`AgentRun` rows) → Task 1 + Task 7. ✓
- Per-course memory → Task 1 + memory upsert in Task 7. ✓
- Docs / recommended models → Task 10. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete. Step 1 of Task 10 is a conditional verification (the existing query has no `select`, so the column flows through) — acceptable, with the contingency stated.

**Type consistency:** `BuildInput`, `UnitOutline`, `UnitDrafts`, `AssignmentDraft` defined in Task 5 and reused in Tasks 7 & 9. `ResolvedAiConfig`/`resolveAiConfig`/`loadAiConfig`/`generateStructured` defined in Task 3, used in Tasks 5 & 7. `encryptSecret`/`decryptSecret` defined in Task 2, used in Tasks 3 & 6. Provider enum (`openai`/`anthropic`/`openai-compatible`) consistent across Tasks 3, 6, 8. Names align.
