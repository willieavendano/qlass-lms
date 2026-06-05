"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, timeAgo } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    load();
  }

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="mx-auto max-w-2xl animate-fade-in px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Notifications
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={markAllRead}
          disabled={!hasUnread}
        >
          Mark all read
        </Button>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="You're all caught up"
          description="Announcements, due assignments, and grades will show up here."
        />
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => {
            const inner = (
              <>
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-teal-600 dark:bg-teal-400"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              </>
            );
            return (
              <li
                key={n.id}
                className={cn(
                  "rounded-2xl border bg-white/95 p-4 shadow-soft transition-colors dark:bg-slate-900/80",
                  n.read
                    ? "border-slate-200/80 dark:border-slate-800"
                    : "border-teal-200 bg-teal-50/40 dark:border-teal-900 dark:bg-teal-950/20"
                )}
              >
                {n.link ? (
                  <Link href={n.link} className="block hover:opacity-90">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
