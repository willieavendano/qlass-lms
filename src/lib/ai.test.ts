import { describe, it, expect } from "vitest";
import { resolveAiConfig, type AiConfigInputs } from "./ai";

const base: AiConfigInputs = { userSetting: null, systemSettings: null, env: {} };

describe("resolveAiConfig", () => {
  it("prefers the user BYOK setting", () => {
    const cfg = resolveAiConfig({
      ...base,
      userSetting: { provider: "openai", model: "gpt-x", baseUrl: null, apiKey: "u-key" },
      systemSettings: { provider: "anthropic", model: "claude-x", baseUrl: null, apiKey: "s-key" },
      env: { AI_PROVIDER: "openai-compatible", AI_API_KEY: "e-key" },
    });
    expect(cfg).toMatchObject({ provider: "openai", model: "gpt-x", apiKey: "u-key" });
  });

  it("falls back to system settings when no user setting", () => {
    const cfg = resolveAiConfig({
      ...base,
      systemSettings: { provider: "anthropic", model: "claude-x", baseUrl: null, apiKey: "s-key" },
      env: { AI_PROVIDER: "openai", AI_API_KEY: "e-key" },
    });
    expect(cfg).toMatchObject({ provider: "anthropic", model: "claude-x", apiKey: "s-key" });
  });

  it("falls back to env when nothing else is set", () => {
    const cfg = resolveAiConfig({
      ...base,
      env: { AI_PROVIDER: "openai", AI_MODEL: "gpt-env", AI_API_KEY: "e-key" },
    });
    expect(cfg).toMatchObject({ provider: "openai", model: "gpt-env", apiKey: "e-key" });
  });

  it("returns null when nothing is configured", () => {
    expect(resolveAiConfig(base)).toBeNull();
  });

  it("requires baseUrl for openai-compatible", () => {
    expect(() =>
      resolveAiConfig({ ...base, env: { AI_PROVIDER: "openai-compatible", AI_MODEL: "llama" } })
    ).toThrow();
  });
});
