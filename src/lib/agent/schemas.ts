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

export const reviewFindingSchema = z.object({
  target: z.string().min(1), // which draft it concerns, e.g. "assignment 2: Photosynthesis lab"
  severity: z.enum(["info", "warn", "fix"]),
  issue: z.string().min(1),
  suggestion: z.string().optional(),
});
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;

export const unitReviewSchema = z.object({
  summary: z.string().min(1),
  clarityScore: z.number().int().min(1).max(5),
  gradeLevelFit: z.enum(["below", "on_level", "above"]),
  sourceSafety: z.enum(["pass", "flagged"]),
  findings: z.array(reviewFindingSchema).max(12),
});
export type UnitReview = z.infer<typeof unitReviewSchema>;

/** Request body for starting a unit build. */
export const buildInputSchema = z.object({
  topic: z.string().min(1),
  gradeLevel: z.string().optional(),
  standards: z.string().optional(),
  assignmentCount: z.number().int().min(1).max(8).default(3),
});
export type BuildInput = z.infer<typeof buildInputSchema>;
