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
