# AGENTS.md

Guidance for agents working in this repository. Keep project-specific facts here; put
personal, machine-local notes in `AGENTS.local.md` (gitignored).

## What this project is

**OpenAI Compatible Agent** — a feature-limited fork of Roo Code (Apache-2.0), maintained
as a **standalone repository** (not a live fork; history was squashed). It is a VS Code
extension whose agent connects **only** to OpenAI-compatible endpoints (vLLM / Ollama /
TGI) and Azure OpenAI. All other LLM provider backends were deleted, not stubbed.

The primary chat view is contributed to the **secondary side bar** (right), like GitHub
Copilot / Codex.

## Monorepo layout (pnpm workspaces + turbo)

- `src/` — the extension host. Workspace package name is `openai-agent`.
- `webview-ui/` — React webview (`@openai-agent/vscode-webview`).
- `packages/types/` — shared types & zod schemas (`@openai-agent/types`).
- `packages/core`, `packages/build`, `packages/ipc`, `packages/vscode-shim`, `packages/config-*`.
- `apps/vscode-internal/` — the **internal branded distribution build** that produces the `.vsix`.
- `apps/vscode-e2e/` — `@vscode/test-electron` end-to-end tests.

## Build, test, package

- **Typecheck:** `pnpm run check-types` (turbo, all packages). This is what pre-push runs.
- **Lint:** `pnpm turbo lint` (eslint `--max-warnings=0`; warnings fail).
- **Unit tests — run from the package that owns vitest, never from repo root:**
    - Extension host: `cd src && npx vitest run <path-relative-to-src>` (no leading `src/`).
    - Webview: `cd webview-ui && npx vitest run src/<path>`.
    - Types: `cd packages/types && npx vitest run src/<path>`.
- **Build the distributable:** `pnpm bundle:internal` (esbuild) → `pnpm vsix:internal`
  (vsce → `bin/openai-compatible-agent-1.0.0.vsix`).
- **Hooks:** pre-commit = lint + prettier on staged files (`--max-warnings=0`); pre-push =
  `check-types` and a block on pushing directly to `main` (branch + PR instead).

## Branding / identity (important, easy to break)

- `Package.name = process.env.PKG_NAME || name` (`src/shared/package.ts`). Commands/views are
  registered at runtime as `${Package.name}.<id>`.
- The internal build (`apps/vscode-internal/esbuild.mjs`) sets `PKG_NAME=openai-compatible-agent`
  and **substitutes `openai-agent` → `openai-compatible-agent`** throughout the generated
  `package.json`. In source, contributions use the `openai-agent.` prefix.
- **Contribution IDs in `package.json` MUST match the runtime `${Package.name}.<id>`.** A
  mismatch shows up as "command not found", a settings button that does nothing, or a
  first-launch loop. `packages/build`'s guard test asserts this.

## Gotchas learned the hard way

- **Stale `packages/types/dist`:** typecheck/unit tests resolve the TS source (`exports.import`),
  but e2e / CJS `require` the built `dist`. After changing types, run
  `pnpm --filter @openai-agent/types build` or e2e fails with `Cannot find module`.
- **Tests block the network:** `src/vitest.setup.ts` calls `nock.disableNetConnect()`. A live
  integration test must re-enable its host via the exported `allowNetConnect(host)` and should
  be gated behind an env var (see `openaiConnection.live.spec.ts`).
- **Distribution builds must be minified:** `bundle:internal` passes `--production`; without it
  `extension.js` is ~23 MB unminified and activation ("Activating Extension") is slow.
- **`bundle:internal` / `vsix:internal` are `cache:false`** in `turbo.json`. They read `src/`
  from a different package, so turbo's default caching served stale (and unminified) output.
- **Secondary side bar key is `secondarySidebar`** (lowercase `b`) and needs
  `engines.vscode >= 1.106`. The wrong casing is silently ignored → the view falls back into
  the Explorer.
- **Verifying UI empirically:** `apps/vscode-e2e` + Xvfb can launch a real VS Code with
  `--extensionDevelopmentPath=apps/vscode-internal/build`; screenshot with `import -window root`.
- **Settings view:** inputs bind to the local `cachedState`, NOT the live `useExtensionState()`,
  so edits stay buffered until "Save" writes to the `ContextProxy` source of truth.

## Direction & standing decisions

- **Autonomy modes** (Manual / Auto-Edit / Auto / Plan) exist — Claude Code-style permission
  modes, separate from role modes. Defined in `packages/types/src/autonomy.ts`, applied by
  `ClineProvider.setAutonomyMode`, with Plan's read-only gate in `src/core/tools/validateToolUse.ts`.
  Autonomy is **user-controlled only**; the model must never raise its own level.
- **Role modes** (Code/Architect/Ask/Debug/Orchestrator) are slated for deletion to **Code only**
  plus removal of the `switch_mode` tool (pending; large blast radius).
- **Deletion standard:** "delete" means remove the structures **and all their callers** — never
  leave a stub. Verify completeness with an independent audit.
- **Completion is external:** do not report work as done on your own sense of "finished." Back it
  with verification output (tests, typecheck, a real run), or it is not done.

## Security scanning (local, dev-only)

These are local dev tools; they do NOT ship in the `.vsix`.

- **eslint-plugin-security**: `pnpm lint:security` (standalone `eslint.security.config.mjs`, kept
  out of the strict build lint). High recall, low precision — `detect-object-injection` /
  `detect-non-literal-fs-filename` are mostly noise; focus on `detect-unsafe-regex` /
  `detect-non-literal-regexp`.
- **Semgrep** (higher signal): install once in a venv, then
  `semgrep --config p/security-audit --config p/javascript --config p/typescript --metrics off --oss-only src webview-ui/src`.
  (`--config auto` needs metrics on; use explicit rulesets for an offline/private run.)
- **Dependency vulns**: `pnpm audit --prod`. Most of the tree is transitive/build-only and does
  not ship; the runtime-relevant ones to watch are `shell-quote` (command parsing) and
  `simple-git` (checkpoints), plus `dompurify` (mermaid rendering in the webview).

## Nested rules & commands

Concrete, still-current rules live under `.agent/` — consult them:

- `.agent/rules/`, `.agent/rules-code/`, `.agent/rules-debug/` — coding/test/debug rules.
- `.agent/commands/` — `commit.md`, `release.md` project workflows.
