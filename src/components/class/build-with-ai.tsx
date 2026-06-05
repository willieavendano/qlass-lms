"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type AssignmentDraft = {
  title: string;
  instructions: string;
  points: number;
  questions: string[];
};
type Drafts = { assignments: AssignmentDraft[]; material: { title: string; body: string } };

export function BuildWithAi({
  classId,
  onPublished,
}: {
  classId: string;
  onPublished: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"form" | "running" | "review" | "error">("form");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    topic: "",
    gradeLevel: "",
    standards: "",
    assignmentCount: 3,
  });
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
      setError(typeof d.error === "string" ? d.error : "Build failed");
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
      setError(typeof d.error === "string" ? d.error : "Publish failed");
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
          <p className="text-sm text-slate-500">
            Agent is working… planning and drafting classwork.
          </p>
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
              <div
                key={i}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAssignment(i)}
                  >
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
