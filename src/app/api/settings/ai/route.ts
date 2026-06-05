import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";

const schema = z.object({
  provider: z.enum(["openai", "anthropic", "openai-compatible"]),
  model: z.string().optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(), // omitted => keep existing
});

export async function GET() {
  const session = await requireSession();
  const row = await prisma.userAiSetting.findUnique({
    where: { userId: session.user.id },
  });
  // Never return the key; just whether one is stored.
  return NextResponse.json({
    setting: row
      ? {
          provider: row.provider,
          model: row.model,
          baseUrl: row.baseUrl,
          hasKey: Boolean(row.apiKeyEnc),
        }
      : null,
  });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  try {
    const data = schema.parse(await req.json());
    if (data.provider === "openai-compatible" && !data.baseUrl) {
      return NextResponse.json(
        { error: "baseUrl is required for openai-compatible" },
        { status: 400 }
      );
    }
    const apiKeyEnc = data.apiKey ? encryptSecret(data.apiKey) : undefined;
    const setting = await prisma.userAiSetting.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        provider: data.provider,
        model: data.model,
        baseUrl: data.baseUrl,
        apiKeyEnc,
      },
      update: {
        provider: data.provider,
        model: data.model,
        baseUrl: data.baseUrl,
        ...(apiKeyEnc ? { apiKeyEnc } : {}),
      },
    });
    return NextResponse.json({
      setting: {
        provider: setting.provider,
        model: setting.model,
        baseUrl: setting.baseUrl,
        hasKey: Boolean(setting.apiKeyEnc),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save AI settings" }, { status: 500 });
  }
}
