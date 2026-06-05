"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDueDate } from "@/lib/utils";

type Post = {
  id: string;
  title: string;
  dueDate: string | null;
  points: number | null;
  status: string;
  category: { name: string } | null;
};

export default function ClassworkPage({ params }: { params: { id: string } }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", instructions: "", points: 100 });

  const load = useCallback(() => {
    fetch(`/api/classes/${params.id}/classwork`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []));
    fetch(`/api/classes/${params.id}`)
      .then((r) => r.json())
      .then((d) =>
        setIsTeacher(d.membership?.role === "OWNER" || d.membership?.role === "TEACHER")
      );
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: params.id,
        title: form.title,
        instructions: form.instructions,
        points: form.points,
        publish: true,
      }),
    });
    setShowForm(false);
    setForm({ title: "", instructions: "", points: 100 });
    load();
  }

  // Group assignments by category for an editorial, sectioned layout.
  const grouped = posts.reduce<Record<string, Post[]>>((acc, p) => {
    const key = p.category?.name ?? "General";
    (acc[key] ??= []).push(p);
    return acc;
  }, {});
  const sections = Object.entries(grouped);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">Classwork</p>
        {isTeacher && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" aria-hidden />
            Create assignment
          </Button>
        )}
      </div>

      {isTeacher && showForm && (
        <Card className="animate-slide-up">
          <CardContent className="space-y-3 pt-6">
            <form onSubmit={createAssignment} className="space-y-3">
              <Input
                placeholder="Assignment title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Textarea
                placeholder="Instructions"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              />
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  className="w-32"
                  placeholder="Points"
                  value={form.points}
                  onChange={(e) => setForm({ ...form, points: +e.target.value })}
                />
                <Button type="submit">Publish</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {posts.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description={
            isTeacher
              ? "Create your first assignment — it'll show up here, grouped by topic."
              : "Assignments your teacher posts will appear here."
          }
          action={
            isTeacher ? (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Create assignment
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {sections.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">
                {category}
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/class/${params.id}/assignments/${post.id}`}
                        className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400">
                          <ClipboardList className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-semibold tracking-tight">
                            {post.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {post.dueDate && (
                              <Badge variant="accent">
                                Due {formatDueDate(post.dueDate)}
                              </Badge>
                            )}
                            {post.points != null && (
                              <Badge variant="neutral">{post.points} pts</Badge>
                            )}
                            {post.status === "DRAFT" && (
                              <Badge variant="outline">Draft</Badge>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
