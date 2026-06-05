"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClassSettingsPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState({
    name: "",
    section: "",
    bannerColor: "#0d9488",
    joinCode: "",
  });
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    fetch(`/api/classes/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setForm({
          name: d.class.name,
          section: d.class.section ?? "",
          bannerColor: d.class.bannerColor,
          joinCode: d.class.joinCode,
        });
        setCanEdit(
          d.membership?.role === "OWNER" || d.membership?.role === "TEACHER"
        );
      });
  }, [params.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/classes/${params.id}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
  }

  if (!canEdit) {
    return <p className="text-slate-500">Only teachers can edit class settings.</p>;
  }

  return (
    <form onSubmit={save} className="max-w-md space-y-4">
      <div>
        <label className="text-sm font-medium">Class name</label>
        <Input
          className="mt-1"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Section</label>
        <Input
          className="mt-1"
          value={form.section}
          onChange={(e) => setForm({ ...form, section: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Banner color</label>
        <Input
          type="color"
          className="mt-1 h-10 w-20"
          value={form.bannerColor}
          onChange={(e) => setForm({ ...form, bannerColor: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Join code</label>
        <p className="mt-1 font-mono text-teal-800">{form.joinCode}</p>
      </div>
      <Button type="submit">Save settings</Button>
    </form>
  );
}
