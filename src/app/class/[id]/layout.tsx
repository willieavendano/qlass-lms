"use client";

import { useEffect, useState } from "react";
import { ClassNav } from "@/components/class/class-nav";
import { ClassBanner } from "@/components/class/class-banner";

export default function ClassLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const [classroom, setClassroom] = useState<{
    name: string;
    section: string | null;
    bannerColor: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/classes/${params.id}`)
      .then((r) => r.json())
      .then((d) => setClassroom(d.class));
  }, [params.id]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {classroom && (
        <ClassBanner
          name={classroom.name}
          section={classroom.section}
          bannerColor={classroom.bannerColor}
        />
      )}
      <div className="mt-6">
        <ClassNav classId={params.id} />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
