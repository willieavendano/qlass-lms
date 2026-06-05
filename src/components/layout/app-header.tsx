"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Bell, GraduationCap, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback, initials } from "@/components/ui/avatar";

export function AppHeader() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (session) {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => setUnread(d.unreadCount ?? 0))
        .catch(() => {});
    }
  }, [session]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/70 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link
          href={session ? "/dashboard" : "/"}
          className="group flex items-center gap-2 font-semibold text-teal-800 dark:text-teal-400"
          aria-label="Qlass home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-soft transition-transform group-hover:scale-105">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Qlass
          </span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Main">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="hidden px-3 py-2 text-sm text-slate-600 hover:text-teal-700 sm:inline dark:text-slate-300"
              >
                Classes
              </Link>
              {session.user.systemRole === "ADMIN" && (
                <Link
                  href="/admin"
                  className="hidden px-3 py-2 text-sm text-slate-600 hover:text-teal-700 sm:inline dark:text-slate-300"
                >
                  Admin
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                {mounted && theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
              <Link href="/notifications" className="relative" aria-label="Notifications">
                <Button variant="ghost" size="icon">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Button>
              </Link>
              <div className="mx-1 hidden items-center gap-2 sm:flex">
                <Avatar>
                  {session.user.image && (
                    <AvatarImage
                      src={session.user.image}
                      alt={session.user.name ?? ""}
                    />
                  )}
                  <AvatarFallback>
                    {initials(session.user.name ?? session.user.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[120px] truncate text-sm text-slate-600 md:inline dark:text-slate-400">
                  {session.user.name ?? session.user.email}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
