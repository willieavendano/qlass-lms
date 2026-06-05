import { NextResponse } from "next/server";
import { ClassRole, NotificationType, PostStatus, PostType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const membership = await requireClassAccess(session.user.id, params.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  const posts = await prisma.post.findMany({
    where: {
      classId: params.id,
      status: PostStatus.PUBLISHED,
      type: { in: [PostType.ANNOUNCEMENT, PostType.MATERIAL] },
    },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { publishedAt: "desc" },
    include: {
      author: { select: { id: true, name: true, image: true } },
      attachments: true,
      _count: { select: { comments: true } },
      assignment: true,
    },
  });

  let nextCursor: string | null = null;
  if (posts.length > limit) {
    const next = posts.pop();
    nextCursor = next?.id ?? null;
  }

  return NextResponse.json({ posts, nextCursor });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const membership = await requireClassAccess(session.user.id, params.id, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const post = await prisma.post.create({
    data: {
      classId: params.id,
      authorId: session.user.id,
      type: body.type ?? PostType.ANNOUNCEMENT,
      status: body.publish ? PostStatus.PUBLISHED : PostStatus.DRAFT,
      title: body.title,
      content: body.content,
      linkUrl: body.linkUrl,
      youtubeUrl: body.youtubeUrl,
      publishedAt: body.publish ? new Date() : null,
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
  if (body.publish) {
    const members = await prisma.classMembership.findMany({
      where: { classId: params.id, userId: { not: session.user.id } },
      select: { userId: true },
    });
    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        type: NotificationType.ANNOUNCEMENT,
        title: `New announcement in class`,
        body: post.title,
        link: `/class/${params.id}/stream`,
      })),
    });
  }
  return NextResponse.json({ post }, { status: 201 });
}
