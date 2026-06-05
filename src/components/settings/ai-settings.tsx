"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Setting = {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  hasKey: boolean;
} | null;

export function AiSettings() {
  const [setting, setSetting] = useState<Setting>(null);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((d) => {
        if (d.setting) {
          setSetting(d.setting);
          setProvider(d.setting.provider);
          setModel(d.setting.model ?? "");
          setBaseUrl(d.setting.baseUrl ?? "");
        }
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const body: Record<string, unknown> = { provider };
    if (model) body.model = model;
    if (baseUrl) body.baseUrl = baseUrl;
    if (apiKey) body.apiKey = apiKey;
    const res = await fetch("/api/settings/ai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const d = await res.json();
      setSetting(d.setting);
      setApiKey("");
      setSaved(true);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            AI provider (BYOK)
          </h2>
          <p className="text-sm text-slate-500">
            Bring your own key. For local/open models, choose &ldquo;OpenAI-compatible&rdquo; and
            point the base URL at Ollama / vLLM / LM Studio (e.g. http://localhost:11434/v1).
            Recommended local models: Llama 3.3 70B or Qwen2.5 72B — small 3B–7B models are
            dev/privacy only.
          </p>
        </div>
        <form onSubmit={save} className="space-y-3">
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai-compatible">OpenAI-compatible (local/open)</option>
          </select>
          <Input
            placeholder="Model (optional)"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          {provider === "openai-compatible" && (
            <Input
              placeholder="Base URL (e.g. http://localhost:11434/v1)"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          )}
          <Input
            type="password"
            placeholder={
              setting?.hasKey ? "API key (stored — leave blank to keep)" : "API key"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button type="submit">Save</Button>
            {saved && <span className="text-sm text-teal-600">Saved</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
