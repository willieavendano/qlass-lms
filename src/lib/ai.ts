import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

export type AiProvider = "openai" | "anthropic" | "openai-compatible";

export type ResolvedAiConfig = {
  provider: AiProvider;
  model: string;
  baseUrl: string | null;
  apiKey: string | null;
};

type SettingShape = {
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  apiKey: string | null;
} | null;

export type AiConfigInputs = {
  userSetting: SettingShape;
  systemSettings: SettingShape;
  env: {
    AI_PROVIDER?: string;
    AI_MODEL?: string;
    AI_BASE_URL?: string;
    AI_API_KEY?: string;
  };
};

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-latest",
  "openai-compatible": "llama3.3:70b",
};

function normalizeProvider(p: string | null | undefined): AiProvider | null {
  if (p === "openai" || p === "anthropic" || p === "openai-compatible") return p;
  return null;
}

/** Pure precedence: user BYOK → system settings → env. Returns null if unconfigured. */
export function resolveAiConfig(inputs: AiConfigInputs): ResolvedAiConfig | null {
  const candidates: SettingShape[] = [
    inputs.userSetting,
    inputs.systemSettings,
    inputs.env.AI_PROVIDER
      ? {
          provider: inputs.env.AI_PROVIDER,
          model: inputs.env.AI_MODEL ?? null,
          baseUrl: inputs.env.AI_BASE_URL ?? null,
          apiKey: inputs.env.AI_API_KEY ?? null,
        }
      : null,
  ];
  for (const c of candidates) {
    const provider = normalizeProvider(c?.provider);
    if (!c || !provider) continue;
    if (provider === "openai-compatible" && !c.baseUrl) {
      throw new Error("openai-compatible provider requires a base URL.");
    }
    return {
      provider,
      model: c.model || DEFAULT_MODELS[provider],
      baseUrl: c.baseUrl ?? null,
      apiKey: c.apiKey ?? null,
    };
  }
  return null;
}

/** Loads, decrypts, and resolves the effective AI config for a user. */
export async function loadAiConfig(userId: string): Promise<ResolvedAiConfig | null> {
  const [userRow, sys] = await Promise.all([
    prisma.userAiSetting.findUnique({ where: { userId } }),
    prisma.systemSettings.findUnique({ where: { id: "default" } }),
  ]);
  return resolveAiConfig({
    userSetting: userRow
      ? {
          provider: userRow.provider,
          model: userRow.model,
          baseUrl: userRow.baseUrl,
          apiKey: userRow.apiKeyEnc ? decryptSecret(userRow.apiKeyEnc) : null,
        }
      : null,
    systemSettings: sys
      ? {
          provider: sys.aiProvider,
          model: sys.aiModel,
          baseUrl: sys.aiBaseUrl,
          apiKey: sys.aiApiKeyEnc ? decryptSecret(sys.aiApiKeyEnc) : null,
        }
      : null,
    env: {
      AI_PROVIDER: process.env.AI_PROVIDER,
      AI_MODEL: process.env.AI_MODEL,
      AI_BASE_URL: process.env.AI_BASE_URL,
      AI_API_KEY: process.env.AI_API_KEY,
    },
  });
}

function buildModel(cfg: ResolvedAiConfig) {
  switch (cfg.provider) {
    case "openai":
      return createOpenAI({ apiKey: cfg.apiKey ?? undefined })(cfg.model);
    case "anthropic":
      return createAnthropic({ apiKey: cfg.apiKey ?? undefined })(cfg.model);
    case "openai-compatible":
      // Enable structured outputs so the JSON schema is enforced by the endpoint
      // (Ollama 0.5+/vLLM support this). Without it, generateObject's schema is
      // dropped and small models return non-conforming JSON → NoObjectGenerated.
      return createOpenAICompatible({
        name: "local",
        baseURL: cfg.baseUrl!,
        apiKey: cfg.apiKey ?? undefined,
        supportsStructuredOutputs: true,
      })(cfg.model);
  }
}

/** Provider-agnostic structured generation. Throws if AI is not configured. */
export async function generateStructured<T>(
  cfg: ResolvedAiConfig | null,
  schema: z.ZodType<T>,
  prompt: string
): Promise<T> {
  if (!cfg) throw new Error("AI is not configured for this user or instance.");
  const { object } = await generateObject({ model: buildModel(cfg), schema, prompt });
  return object;
}
