"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type QueueItem = {
  student: { id: string; name: string | null; email: string };
  submission: {
    id: string;
    status: string;
    textResponse: string | null;
    isLate: boolean;
    grade: { points: number | null; feedback: string | null } | null;
  } | null;
};

export default function GradePage({
  params,
}: {
  params: { id: string; postId: string };
}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [points, setPoints] = useState("");
  const [feedback, setFeedback] = useState("");

  function load() {
    fetch(`/api/assignments/${params.postId}/submissions`)
      .then((r) => r.json())
      .then((d) => setQueue(d.queue ?? []));
  }

  useEffect(() => {
    load();
  }, [params.postId]);

  useEffect(() => {
    if (selected?.submission?.grade) {
      setPoints(String(selected.submission.grade.points ?? ""));
      setFeedback(selected.submission.grade.feedback ?? "");
    } else {
      setPoints("");
      setFeedback("");
    }
  }, [selected]);

  async function saveGrade(returnToStudent: boolean) {
    if (!selected?.submission) return;
    await fetch(`/api/grades/${selected.submission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points: points ? parseFloat(points) : undefined,
        feedback,
        returnToStudent: returnToStudent,
      }),
    });
    load();
  }

  return (
    <div className="flex gap-6 min-h-[400px]">
      <ul className="w-56 shrink-0 space-y-1 border-r pr-4" aria-label="Students">
        {queue.map((item) => (
          <li key={item.student.id}>
            <button
              type="button"
              onClick={() => setSelected(item)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                selected?.student.id === item.student.id
                  ? "bg-teal-100 dark:bg-teal-900/40"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {item.student.name ?? item.student.email}
              <span className="block text-xs text-slate-500">
                {item.submission?.status ?? "Missing"}
                {item.submission?.isLate && " · Late"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex-1">
        {selected ? (
          <div className="space-y-4">
            <h3 className="font-semibold">
              {selected.student.name ?? selected.student.email}
            </h3>
            {selected.submission?.textResponse ? (
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900">
                {selected.submission.textResponse}
              </p>
            ) : (
              <p className="text-slate-500 text-sm">No submission yet.</p>
            )}
            {selected.submission && (
              <>
                <div>
                  <label className="text-sm font-medium">Points</label>
                  <Input
                    type="number"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    className="mt-1 w-32"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Feedback</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-900"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => saveGrade(false)}>Save grade</Button>
                  <Button variant="secondary" onClick={() => saveGrade(true)}>
                    Return to student
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-slate-500">Select a student to grade.</p>
        )}
      </div>
    </div>
  );
}
