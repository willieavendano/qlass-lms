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
