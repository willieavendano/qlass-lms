"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback, initials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { timeAgo } from "@/lib/utils";

type Post = {
  id: string;
  title: string;
  content: string | null;
  publishedAt: string;
  author: { name: string | null; image: string | null };
  _count: { comments: number };
};

export default function StreamPage({ params }: { params: { id: string } }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/classes/${params.id}/stream`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []));
    fetch(`/api/classes/${params.id}`)
      .then((r) => r.json())
      .then((d) =>
        setIsTeacher(d.membership?.role === "OWNER" || d.membership?.role === "TEACHER")
      );
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function postAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/classes/${params.id}/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, publish: true }),
    });
    setTitle("");
    setContent("");
    load();
  }

  return (
    <div className="space-y-6">
      {isTeacher && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="eyebrow">Share an announcement</p>
            <form onSubmit={postAnnouncement} className="space-y-3">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Textarea
                placeholder="Share something with your class…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <Button type="submit">Post</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {posts.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nothing posted yet"
          description={
            isTeacher
              ? "Share your first announcement and it will appear here for the class."
              : "When your teacher posts an announcement, it will show up here."
          }
        />
      ) : (
        <ul className="space-y-4" aria-label="Class stream">
          {posts.map((post) => (
            <li key={post.id}>
              <Card className="group relative overflow-hidden transition-shadow hover:shadow-lifted">
                {/* Editorial accent rail. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 bg-brand-gradient opacity-70"
                />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {post.author.image && (
                        <AvatarImage
                          src={post.author.image}
                          alt={post.author.name ?? ""}
                        />
                      )}
                      <AvatarFallback>
                        {initials(post.author.name ?? "Teacher")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="leading-tight">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {post.author.name ?? "Teacher"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {timeAgo(post.publishedAt)}
                      </p>
                    </div>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold tracking-tight">
                    {post.title}
                  </h3>
                  {post.content && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {post.content}
                    </p>
                  )}
                  {post._count.comments > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <Badge variant="neutral">
                        <MessageSquare className="h-3 w-3" aria-hidden />
                        {post._count.comments} comment
                        {post._count.comments === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
