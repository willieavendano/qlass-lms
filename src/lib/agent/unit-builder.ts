import { generateStructured, type ResolvedAiConfig } from "@/lib/ai";
import { DENIED_DOMAINS, OER_SOURCES } from "@/lib/oer";
import {
  unitOutlineSchema,
  unitDraftsSchema,
  unitReviewSchema,
  type BuildInput,
  type UnitOutline,
  type UnitDrafts,
  type UnitReview,
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

/** Builds the reviewer prompt. Pure — exported for tests. */
export function buildReviewPrompt(
  input: BuildInput,
  outline: UnitOutline,
  drafts: UnitDrafts
): string {
  const assignments = drafts.assignments
    .map(
      (a, i) =>
        `Assignment ${i + 1}: ${a.title} (${a.points} pts)\nInstructions: ${a.instructions}\nQuestions: ${a.questions.join(" | ")}`
    )
    .join("\n\n");
  return `You are a skeptical instructional reviewer checking AI-drafted classwork before a teacher sees it.
Unit: "${outline.title}"${input.gradeLevel ? ` — intended grade level: ${input.gradeLevel}` : ""}
Objectives: ${outline.objectives.join("; ")}

${assignments}

Material: ${drafts.material.title}\n${drafts.material.body}

Review for:
1. CLARITY — are student-facing instructions unambiguous and complete? (clarityScore 1-5)
2. GRADE LEVEL — is reading level and difficulty right for the intended grade? (gradeLevelFit)
3. SOURCE SAFETY — flag any reference to proprietary/copyrighted sources, especially these denied domains: ${DENIED_DOMAINS.join(", ")}. (sourceSafety)
4. Anything factually dubious or pedagogically weak.

Report specific findings with severity: "fix" (must address), "warn" (should address), "info" (nice to know).
Be concise and concrete; do not invent problems if the drafts are sound.`;
}

/** Step 4: REVIEW — advisory AI pass over the drafts (clarity, grade level,
 *  source safety). Callers should fail open: a reviewer error must never
 *  block the teacher from seeing the drafts. */
export async function reviewDrafts(
  cfg: ResolvedAiConfig | null,
  input: BuildInput,
  outline: UnitOutline,
  drafts: UnitDrafts
): Promise<UnitReview> {
  return generateStructured(cfg, unitReviewSchema, buildReviewPrompt(input, outline, drafts));
}
