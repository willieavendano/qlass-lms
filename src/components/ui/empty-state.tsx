import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Considered empty state — soft icon chip, display-serif title, muted copy, and
 * an optional action. Shared across stream / classwork / people / notifications.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/40 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/30",
        className
      )}
    >
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100 dark:bg-teal-950/50 dark:text-teal-400 dark:ring-teal-900">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      )}
      <p className="font-display text-lg font-semibold tracking-tight">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
