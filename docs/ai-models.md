# AI provider & model guidance

Qlass is provider-agnostic and BYOK. Configure under Settings → AI provider.

## Cloud (BYOK)
- OpenAI: `gpt-4o` (default), `gpt-4o-mini` for cheaper drafts.
- Anthropic: `claude-3-5-sonnet-latest`.

## Local / open (OpenAI-compatible)
Point the base URL at your runtime (Ollama `http://localhost:11434/v1`, vLLM, or LM Studio).
- **Recommended:** Llama 3.3 70B or Qwen2.5 72B class for usable lesson/asset quality.
- **Dev/privacy only:** 3B–7B models. Benchmarks (OmniEduBench) show small models are weak on
  rigorous educational content — the teacher review gate is mandatory regardless of model.

## Precedence
Effective config = user BYOK setting → instance SystemSettings → server env (`AI_PROVIDER`, etc.).

## Deployment policy: do NOT self-host models on the app host

Never run the model on the same host that serves Qlass (Railway, Render, a
small VPS). BYOK cloud APIs are the supported path for hosted deployments.

- App hosts are CPU-only. A 12B-class model runs ~1–3 tok/s there; a unit
  build is now three structured generations (plan → author → review) and the
  run executes synchronously inside the HTTP request — it will hit request
  timeouts long before finishing. Slow first-token also trips the client's
  headers timeout, failing runs with "Cannot connect to API".
- Keeping ~8–10 GB of weights resident 24/7 costs on the order of $80–100/mo
  in RAM billing — versus roughly a cent or two per unit build on a cloud API.

If you want open/local models anyway, host them **elsewhere** and point the
`openai-compatible` base URL at them:
- your own GPU box over Tailscale/cloudflared, or
- a hosted open-model provider (Groq, Together, DeepInfra).
