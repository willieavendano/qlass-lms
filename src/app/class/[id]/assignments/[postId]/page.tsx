"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDueDate } from "@/lib/utils";

export default function AssignmentPage({
  params,
}: {
  params: { id: string; postId: string };
}) {
  const [post, setPost] = useState<Record<string, unknown> | null>(null);
  const [text, setText] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [submission, setSubmission] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/assignments/${params.postId}`)
      .then((r) => r.json())
      .then((d) => {
        setPost(d.post);
        setIsTeacher(
          d.membership?.role === "OWNER" || d.membership?.role === "TEACHER"
        );
        const sub = d.post?.assignment?.submissions?.[0];
        setSubmission(sub ?? null);
        if (sub?.textResponse) setText(sub.textResponse as string);
      });
  }, [params.postId]);

  async function turnIn(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/assignments/${params.postId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ textResponse: text }),
    });
    const d = await res.json();
    setSubmission(d.submission);
  }

  async function unsubmit() {
    await fetch(`/api/assignments/${params.postId}/submit`, { method: "DELETE" });
    setSubmission(null);
    setText("");
  }

  if (!post) return <p className="text-slate-500">Loading…</p>;

  const assignment = post.assignment as Record<string, unknown> | undefined;
  const grade = submission?.grade as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{post.title as string}</h2>
        {Boolean(post.dueDate) && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Due {formatDueDate(post.dueDate as string)}
          </p>
        )}
        {assignment?.instructions ? (
          <p className="mt-4 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
            {assignment.instructions as string}
          </p>
        ) : null}
      </div>

      {isTeacher ? (
        <Link href={`/class/${params.id}/assignments/${params.postId}/grade`}>
          <Button>View submissions & grade</Button>
        </Link>
      ) : (
        <div className="rounded-xl border p-4 space-y-4">
          <h3 className="font-semibold">Your work</h3>
          {submission?.status === "TURNED_IN" ||
          submission?.status === "GRADED" ||
          submission?.status === "RETURNED" ? (
            <>
              <p className="text-sm text-teal-700">Turned in</p>
              {grade && (
                <p className="text-sm">
                  Grade: {grade.points as number} / {grade.maxPoints as number}
                </p>
              )}
              {submission?.status !== "GRADED" && (
                <Button variant="outline" onClick={unsubmit}>
                  Unsubmit
                </Button>
              )}
            </>
          ) : (
            <form onSubmit={turnIn} className="space-y-3">
              <textarea
                className="w-full min-h-[120px] rounded-lg border px-3 py-2 text-sm dark:bg-slate-900"
                placeholder="Type your response…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <Button type="submit">Turn in</Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
