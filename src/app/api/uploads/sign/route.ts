import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { createUploadUrl } from "@/lib/storage";

const schema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().max(50 * 1024 * 1024),
});

export async function POST(req: Request) {
  const session = await requireSession();
  try {
    const data = schema.parse(await req.json());
    const { uploadUrl, storageKey } = await createUploadUrl(
      data.fileName,
      data.mimeType
    );
    const attachment = await prisma.attachment.create({
      data: {
        fileName: data.fileName,
        mimeType: data.mimeType,
        size: data.size,
        storageKey,
        uploaderId: session.user.id,
      },
    });
    return NextResponse.json({ uploadUrl, attachment });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Upload sign failed" }, { status: 500 });
  }
}
