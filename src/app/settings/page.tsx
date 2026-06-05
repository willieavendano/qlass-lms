"use client";

import { useSession } from "next-auth/react";
import { AiSettings } from "@/components/settings/ai-settings";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Account settings</h1>
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="text-slate-500">Name</dt>
          <dd className="font-medium">{session?.user?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd className="font-medium">{session?.user?.email}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Role</dt>
          <dd className="font-medium">{session?.user?.systemRole}</dd>
        </div>
      </dl>

      <div className="mt-8">
        <AiSettings />
      </div>

      <p className="mt-8 text-sm text-slate-500">
        Email digest preferences and profile editing coming in a future release.
      </p>
    </div>
  );
}
