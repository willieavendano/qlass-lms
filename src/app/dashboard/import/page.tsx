"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Download, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Sensitive Classroom + Drive scopes requested only at connect time (mirrors
// CONNECT_SCOPES in src/lib/google.ts — kept here client-side to avoid importing
// server-only code).
const CONNECT_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
  "https://www.googleapis.com/auth/classroom.topics.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

type Course = {
  id: string;
  name: string;
  section: string | null;
  descriptionHeading: string | null;
  courseState: string | null;
  alreadyImported: boolean;
  importedClassId: string | null;
};

type ImportResult = {
  courseId: string;
  status: "imported" | "updated" | "failed";
  classId?: string;
  className?: string;
  counts?: Record<string, number>;
  error?: string;
};

const OPTION_LABELS: { key: string; label: string }[] = [
  { key: "importStudents", label: "Students & roster" },
  { key: "importCoursework", label: "Coursework" },
  { key: "importAnnouncements", label: "Announcements" },
  { key: "importSubmissions", label: "Submissions" },
  { key: "importGrades", label: "Grades" },
  { key: "importAttachments", label: "Attachments (Drive files)" },
];

export default function ImportPage() {
  const [state, setState] = useState<"loading" | "connect" | "ready" | "error">(
    "loading"
  );
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<Record<string, boolean>>(
    Object.fromEntries(OPTION_LABELS.map((o) => [o.key, true]))
  );
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [demo, setDemo] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    const res = await fetch("/api/import/classroom");
    if (res.status === 409) {
      setState("connect");
      return;
    }
    if (!res.ok) {
      setState("error");
      return;
    }
    const data = await res.json();
    setCourses(data.courses ?? []);
    setDemo(Boolean(data.demo));
    setState("ready");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function connect() {
    signIn(
      "google",
      { callbackUrl: "/dashboard/import" },
      {
        scope: CONNECT_SCOPES,
        access_type: "offline",
        prompt: "consent",
      }
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runImport() {
    setImporting(true);
    setResults(null);
    const res = await fetch("/api/import/classroom/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseIds: Array.from(selected), options }),
    });
    const data = await res.json();
    setImporting(false);
    if (res.ok) {
      setResults(data.results ?? []);
      load(); // refresh alreadyImported flags
    } else if (res.status === 409) {
      setState("connect");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Import from Google Classroom
          </h1>
          {demo && <Badge variant="accent">Demo data</Badge>}
        </div>
        <Link href="/dashboard" className="text-sm text-teal-700 hover:underline">
          ← Back
        </Link>
      </div>

      {demo && state === "ready" && (
        <p className="mb-4 text-sm text-slate-500">
          Demo mode is on — these are built-in sample courses. Importing creates
          real classes so you can click through the result.
        </p>
      )}

      {state === "loading" && (
        <p className="text-slate-500">Loading your Google Classroom courses…</p>
      )}

      {state === "error" && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-slate-700 dark:text-slate-300">
              Couldn&apos;t reach Google Classroom. Try again in a moment.
            </p>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {state === "connect" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-slate-700 dark:text-slate-300">
              Connect your Google account to let Qlass read your Classroom
              courses, rosters, coursework, and attachments. You&apos;ll be asked
              to grant read-only access.
            </p>
            <Button onClick={connect}>
              <Download className="h-4 w-4" aria-hidden />
              Connect Google Classroom
            </Button>
          </CardContent>
        </Card>
      )}

      {state === "ready" && (
        <div className="space-y-6">
          {/* Options */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-3 text-sm font-semibold">What to import</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {OPTION_LABELS.map((o) => (
                  <label
                    key={o.key}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={options[o.key]}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          [o.key]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Course list */}
          {courses.length === 0 ? (
            <p className="text-slate-500">
              No Google Classroom courses found for your account.
            </p>
          ) : (
            <div className="space-y-2">
              {courses.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.alreadyImported && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          Already imported · re-import to update
                        </span>
                      )}
                    </div>
                    {c.section && (
                      <p className="text-sm text-slate-500">{c.section}</p>
                    )}
                  </div>
                  {c.alreadyImported && c.importedClassId && (
                    <Link
                      href={`/class/${c.importedClassId}/stream`}
                      className="text-xs text-teal-700 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open
                    </Link>
                  )}
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={runImport}
              disabled={selected.size === 0 || importing}
            >
              <Download className="h-4 w-4" aria-hidden />
              {importing
                ? "Importing…"
                : `Import ${selected.size || ""} course${
                    selected.size === 1 ? "" : "s"
                  }`}
            </Button>
            {importing && (
              <span className="text-sm text-slate-500">
                This can take a minute for large classes with attachments.
              </span>
            )}
          </div>

          {/* Results */}
          {results && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Results</h2>
              {results.map((r) => (
                <div
                  key={r.courseId}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
                >
                  {r.status === "failed" ? (
                    <XCircle className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden />
                  ) : (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 text-teal-700"
                      aria-hidden
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {r.className ?? r.courseId} — {r.status}
                    </p>
                    {r.error && (
                      <p className="text-amber-700 dark:text-amber-400">
                        {r.error}
                      </p>
                    )}
                    {r.counts && (
                      <p className="text-xs text-slate-500">
                        {Object.entries(r.counts)
                          .filter(([, v]) => v > 0)
                          .map(([k, v]) => `${v} ${k}`)
                          .join(" · ") || "no new items"}
                      </p>
                    )}
                    {r.classId && r.status !== "failed" && (
                      <Link
                        href={`/class/${r.classId}/stream`}
                        className="text-xs text-teal-700 hover:underline"
                      >
                        Open class →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              <p className="pt-2 text-xs text-slate-500">
                Imported students appear in the roster but can&apos;t sign in
                until they register or sign in with Google using the same email.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
