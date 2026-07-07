"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function DataSettings({ email }: { email: string }) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDeleting(true);
    const res = await fetch("/api/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail }),
    });
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
      return;
    }
    const d = await res.json().catch(() => ({}));
    setError(
      typeof d.error === "string" ? d.error : "Failed to delete account. Try again."
    );
    setDeleting(false);
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Your data</h2>
          <p className="text-sm text-slate-500">
            Download a copy of everything Qlass stores about you, or delete your account.
          </p>
        </div>

        <div>
          <Button asChild variant="outline">
            <a href="/api/me/export" download>
              Download my data (JSON)
            </a>
          </Button>
        </div>

        <form onSubmit={deleteAccount} className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <p className="text-sm font-medium text-red-700">Delete account</p>
          <p className="text-sm text-slate-500">
            This permanently removes your account, submissions, comments, and
            notifications. Classes you solely own must be empty first. Type your
            email to confirm.
          </p>
          <Input
            type="email"
            placeholder={email}
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
          />
          <Button
            type="submit"
            variant="destructive"
            disabled={deleting || confirmEmail.toLowerCase() !== email.toLowerCase()}
          >
            {deleting ? "Deleting…" : "Permanently delete my account"}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
