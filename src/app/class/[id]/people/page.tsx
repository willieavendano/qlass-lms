"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  initials,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type Member = {
  role: string;
  user: { id: string; name: string | null; email: string; image: string | null };
};

function PersonRow({ member }: { member: Member }) {
  const { user, role } = member;
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <Avatar>
        {user.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
        <AvatarFallback>{initials(user.name ?? user.email)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
          {user.name ?? user.email}
        </p>
        {user.name && (
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        )}
      </div>
      {(role === "OWNER" || role === "TEACHER") && (
        <Badge variant={role === "OWNER" ? "default" : "neutral"}>
          {role === "OWNER" ? "Owner" : "Teacher"}
        </Badge>
      )}
    </li>
  );
}

export default function PeoplePage({ params }: { params: { id: string } }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    fetch(`/api/classes/${params.id}/members`)
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.members ?? []);
        setJoinCode(d.joinCode ?? "");
      });
  }, [params.id]);

  const teachers = members.filter((m) => m.role === "OWNER" || m.role === "TEACHER");
  const students = members.filter((m) => m.role === "STUDENT");

  return (
    <div className="space-y-8">
      {joinCode && (
        <div className="flex items-center justify-between rounded-2xl border border-teal-100 bg-teal-50/60 px-5 py-4 dark:border-teal-900/60 dark:bg-teal-950/30">
          <div>
            <p className="eyebrow">Class code</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Share this so students can join.
            </p>
          </div>
          <code className="rounded-lg bg-white px-3 py-1.5 font-mono text-lg font-bold tracking-[0.2em] text-teal-800 shadow-soft dark:bg-slate-900 dark:text-teal-300">
            {joinCode}
          </code>
        </div>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">
          Teachers
        </h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-soft dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/80">
          {teachers.map((m) => (
            <PersonRow key={m.user.id} member={m} />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">
          Students{" "}
          <span className="text-slate-400">· {students.length}</span>
        </h2>
        {students.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students yet"
            description="Students who join with the class code will appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-soft dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/80">
            {students.map((m) => (
              <PersonRow key={m.user.id} member={m} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
