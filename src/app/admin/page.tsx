"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type User = {
  id: string;
  name: string | null;
  email: string;
  systemRole: string;
  suspended: boolean;
  createdAt: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.stats ?? {}));
  }, []);

  async function toggleSuspend(id: string, suspended: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !suspended }),
    });
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, suspended: !suspended } : u))
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Qlass Admin</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        System-wide management
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {Object.entries(stats).map(([key, value]) => (
          <div
            key={key}
            className="rounded-xl border p-4 dark:border-slate-800"
          >
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-slate-500 capitalize">{key}</p>
          </div>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left dark:border-slate-800">
            <th className="py-2">Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b dark:border-slate-800">
              <td className="py-3">{u.name ?? "—"}</td>
              <td>{u.email}</td>
              <td>{u.systemRole}</td>
              <td>{u.suspended ? "Suspended" : "Active"}</td>
              <td>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSuspend(u.id, u.suspended)}
                >
                  {u.suspended ? "Restore" : "Suspend"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
