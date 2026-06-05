import Link from "next/link";
import { BookOpen, Shield, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden px-4 py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/70 via-transparent to-amber-50/40 dark:from-teal-950/30 dark:via-transparent dark:to-amber-950/10" />
        {/* Faint ruled-paper guide lines for editorial texture. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-1/2 -z-0 h-px bg-gradient-to-r from-transparent via-teal-600/15 to-transparent"
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="eyebrow mb-6 justify-center">
            Open source · MIT · Self-hostable
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-7xl dark:text-white">
            Teaching, made{" "}
            <span className="italic text-teal-700 dark:text-teal-400">clear</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            A classroom platform for announcements, assignments, submissions, and
            grading — without vendor lock-in. Bring your own infrastructure, keep
            your data, deploy in minutes.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg">Start for free</Button>
            </Link>
            <Link href="https://github.com" target="_blank" rel="noopener">
              <Button variant="outline" size="lg">
                View on GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users, title: "Multi-class", desc: "Teachers and students across unlimited classes." },
          { icon: BookOpen, title: "Coursework", desc: "Assignments, materials, due dates, and rubrics." },
          { icon: Zap, title: "Fast grading", desc: "Submission queue with inline grades and feedback." },
          { icon: Shield, title: "Your data", desc: "PostgreSQL + S3-compatible storage you control." },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lifted dark:border-slate-800 dark:bg-slate-900/80"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-400">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-slate-200/70 bg-[hsl(var(--muted))]/60 px-4 py-16 dark:border-slate-800">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow mb-4 justify-center">Get started</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Self-host in under 5 minutes
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Docker Compose, PostgreSQL, and optional S3 or Supabase Storage. One command
            to seed demo classes and accounts.
          </p>
          <pre className="mx-auto mt-6 max-w-xl overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-4 text-left font-mono text-sm leading-relaxed text-slate-100 shadow-card">
            {`git clone <your-repo> qlass\ncd qlass && cp .env.example .env.local\ndocker compose up -d\nnpm install && npm run db:push && npm run db:seed`}
          </pre>
        </div>
      </section>

      <footer className="px-4 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Qlass · MIT License
      </footer>
    </div>
  );
}
