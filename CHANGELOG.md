# OpenAI Compatible Agent Changelog

## 1.0.0

Initial release of **OpenAI Compatible Agent** — a feature-limited VS Code coding
agent for OpenAI-compatible endpoints and Azure OpenAI, intended for enterprise
use with in-house local LLM endpoints (vLLM / Ollama / TGI) or Azure OpenAI.

This project is a modified version of
[Roo Code](https://github.com/RooCodeInc/Roo-Code) (Apache License 2.0 © 2025 Roo
Code, Inc.). Prior release history belongs to the upstream project and is not
reproduced here.

- Single provider: **OpenAI Compatible** (includes Azure OpenAI), with
  configurable custom headers.
- Built-in modes: Architect, Code, Ask, Debug, Orchestrator. Custom modes via
  `.agentmodes`; per-mode rules via `.agent/rules-<slug>/`.
- Reviewable diff view for file edits.
- Japanese (default) and English UI only.
- No telemetry or external communication beyond the configured LLM endpoint.
