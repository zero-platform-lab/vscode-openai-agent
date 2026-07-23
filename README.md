# Local Agent

A feature-limited AI coding agent for VS Code that connects to OpenAI-compatible endpoints and Azure OpenAI. It is designed for local environments running OpenAI-compatible LLM endpoints (vLLM / Ollama / TGI), as well as Azure OpenAI.

Japanese documentation (primary): see [README-internal.md](./README-internal.md).

## Features

- **OpenAI Compatible provider only** — one provider covering any OpenAI-compatible endpoint, including Azure OpenAI. Custom headers are configurable.
- **Built-in modes** — Architect, Code, Ask, Debug, and Orchestrator. Custom modes can be defined in `.agentmodes`.
- **Diff view** — file edits are shown as a reviewable diff before they are applied.
- **Japanese and English** — the UI ships in Japanese (default) and English only.
- **No telemetry** — no analytics or external communication beyond the configured LLM endpoint.

## Build from source

```bash
pnpm install
pnpm build
pnpm --filter openai-agent vsix
```

The generated `.vsix` can be installed in VS Code via **Extensions: Install from VSIX…**.

For connection setup (OpenAI-compatible endpoints, Azure OpenAI), external-communication limits, and security notes, see [README-internal.md](./README-internal.md).

## License

Licensed under the [Apache License 2.0](./LICENSE).

This software is a modified version of [Roo Code](https://github.com/RooCodeInc/Roo-Code) (Apache License 2.0 © 2025 Roo Code, Inc.).
