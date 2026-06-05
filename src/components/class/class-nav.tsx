"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "stream", label: "Stream" },
  { href: "classwork", label: "Classwork" },
  { href: "people", label: "People" },
  { href: "settings", label: "Settings" },
] as const;

export function ClassNav({ classId }: { classId: string }) {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-1 border-b border-slate-200 dark:border-slate-800"
      aria-label="Class sections"
    >
      {tabs.map((tab) => {
        const href = `/class/${classId}/${tab.href}`;
        const active = pathname.includes(`/${tab.href}`);
        return (
          <Link
            key={tab.href}
            href={href}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              active
                ? "border-teal-600 text-teal-800 dark:border-teal-400 dark:text-teal-300"
                : "border-transparent text-slate-500 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
