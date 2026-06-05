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
