"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, LogIn, Download, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDueDate } from "@/lib/utils";

type ClassItem = {
  id: string;
  name: string;
  section: string | null;
  bannerColor: string;
  joinCode: string;
  role: string;
  memberCount: number;
};

type Upcoming = {
  id: string;
  title: string;
  dueDate: string;
  classId: string;
  className: string;
};

export default function DashboardPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newClass, setNewClass] = useState({ name: "", section: "" });
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const canImport =
    session?.user?.systemRole === "TEACHER" ||
    session?.user?.systemRole === "ADMIN";

  useEffect(() => {
    Promise.all([
      fetch("/api/classes").then((r) => r.json()),
      fetch("/api/dashboard/upcoming").then((r) => r.json()).catch(() => ({ upcoming: [] })),
    ]).then(([c, u]) => {
      setClasses(c.classes ?? []);
      setUpcoming(u.upcoming ?? []);
      setLoading(false);
    });
  }, []);

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClass),
    });
    if (res.ok) {
      const { class: cls } = await res.json();
      setClasses((prev) => [
        { ...cls, role: "OWNER", memberCount: 1 },
        ...prev,
      ]);
      setShowCreate(false);
      setNewClass({ name: "", section: "" });
    }
  }

  async function joinClass(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/classes/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode }),
    });
    if (res.ok) {
      const { class: cls } = await res.json();
      setClasses((prev) => {
        if (prev.some((c) => c.id === cls.id)) return prev;
        return [{ ...cls, role: "STUDENT", memberCount: 0 }, ...prev];
      });
      setJoinCode("");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        Loading your classes…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Your classes
            </h1>
            <div className="flex gap-2">
              <form onSubmit={joinClass} className="flex gap-2">
                <Input
                  placeholder="Join code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-32 uppercase"
                  aria-label="Class join code"
                />
                <Button type="submit" variant="outline" size="sm">
                  <LogIn className="h-4 w-4" aria-hidden />
                  Join
                </Button>
              </form>
              <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
                <Plus className="h-4 w-4" aria-hidden />
                Create
              </Button>
              {canImport && (
                <Link href="/dashboard/import">
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" aria-hidden />
                    Import
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {showCreate && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <form onSubmit={createClass} className="flex flex-wrap gap-4">
                  <Input
                    placeholder="Class name"
                    required
                    value={newClass.name}
                    onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                    className="min-w-[200px] flex-1"
                  />
                  <Input
                    placeholder="Section (optional)"
                    value={newClass.section}
                    onChange={(e) => setNewClass({ ...newClass, section: e.target.value })}
                    className="w-40"
                  />
                  <Button type="submit">Create class</Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((c) => (
              <Link key={c.id} href={`/class/${c.id}/stream`}>
                <article className="group h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lifted dark:border-slate-800 dark:bg-slate-900/80">
                  <div
                    className="relative h-24 px-5 py-4"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${c.bannerColor} 0%, ${c.bannerColor}bb 100%)`,
                    }}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/15 blur-xl"
                    />
                    <h2 className="relative font-display text-lg font-semibold leading-snug text-white drop-shadow-sm">
                      {c.name}
                    </h2>
                    {c.section && (
                      <p className="relative text-sm text-white/85">{c.section}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {c.role}
                    </span>
                    <span>{c.memberCount} members</span>
                  </div>
                </article>
              </Link>
            ))}
            {classes.length === 0 && (
              <EmptyState
                className="col-span-full"
                icon={GraduationCap}
                title="No classes yet"
                description="Create a class, join with a code, or import from Google Classroom to get started."
              />
            )}
          </div>
        </div>

        <aside className="w-full lg:w-72" aria-label="Upcoming work">
          <h2 className="mb-4 font-display text-xl font-semibold tracking-tight">
            Upcoming
          </h2>
          <ul className="space-y-3">
            {upcoming.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/class/${item.classId}/assignments/${item.id}`}
                  className="block rounded-xl border border-slate-200 bg-white/70 p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-card dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {formatDueDate(item.dueDate)}
                  </p>
                  <p className="text-xs text-slate-500">{item.className}</p>
                </Link>
              </li>
            ))}
            {upcoming.length === 0 && (
              <p className="text-sm text-slate-500">No upcoming due dates.</p>
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
