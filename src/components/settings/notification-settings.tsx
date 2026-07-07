"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

const OPTIONS = [
  {
    value: "IMMEDIATE",
    label: "Immediate",
    hint: "Email me as soon as something happens.",
  },
  {
    value: "DAILY",
    label: "Daily digest",
    hint: "One summary email a day with anything I haven't read.",
  },
  {
    value: "OFF",
    label: "Off",
    hint: "In-app notifications only, no email.",
  },
] as const;

type Digest = (typeof OPTIONS)[number]["value"];

export function NotificationSettings() {
  const [value, setValue] = useState<Digest | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((d) => setValue(d.emailDigest ?? "DAILY"));
  }, []);

  async function update(next: Digest) {
    setValue(next);
    setSaved(false);
    const res = await fetch("/api/settings/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailDigest: next }),
    });
    if (res.ok) setSaved(true);
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Email notifications
          </h2>
          <p className="text-sm text-slate-500">
            How should Qlass email you about new classwork, announcements, and grades?
          </p>
        </div>
        <div className="space-y-2" role="radiogroup" aria-label="Email notification preference">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm has-[:checked]:border-slate-900 dark:border-slate-700 dark:has-[:checked]:border-slate-100"
            >
              <input
                type="radio"
                name="emailDigest"
                className="mt-0.5"
                checked={value === opt.value}
                disabled={value === null}
                onChange={() => update(opt.value)}
              />
              <span>
                <span className="font-medium">{opt.label}</span>
                <span className="block text-slate-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {saved && <p className="text-sm text-teal-600">Saved</p>}
      </CardContent>
    </Card>
  );
}
