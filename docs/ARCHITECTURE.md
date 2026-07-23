# アーキテクチャ概要

本ドキュメントは、ソースコードを解析して得られた **OpenAI Compatible Agent**（Roo Code を Apache 2.0 のもとで改変したフォーク）の大まかな内部仕様をまとめたものです。実装の入り口と主要コンポーネントの関係を把握するための地図として利用してください。

> 注意: 本書はコードから機械的に導出した概要であり、詳細や最新の挙動は必ずソースを参照してください。ファイル・関数・フラグ名は解析時点のものです。

---

## 1. 全体像

VS Code 拡張機能として動作する AI コーディングエージェントです。ユーザーのメッセージを受け取り、LLM（OpenAI 互換エンドポイント / Azure OpenAI）に問い合わせ、返ってきた「ツール呼び出し」を実行しながらタスクを進めます。

- **プロバイダは OpenAI Compatible の 1 種類のみ**（Azure OpenAI を含む）。カスタムヘッダー設定に対応。
- **UI 言語は日本語（既定）と英語のみ**。
- **テレメトリなし**。設定した LLM エンドポイント以外への外部通信を行いません。

---

## 2. モノレポ構成

pnpm workspaces + turbo によるモノレポです。

| パッケージ                                     | 役割                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `src`（`openai-agent`）                        | VS Code 拡張機能本体。エージェントループ、ツール、Webview ホスト            |
| `webview-ui`（`@openai-agent/vscode-webview`） | React 製の Webview UI（チャット、設定画面）                                 |
| `packages/types`（`@openai-agent/types`）      | 共有型定義（設定・イベント・モード・API スキーマ）。zod ベース              |
| `packages/core`（`@openai-agent/core`）        | プラットフォーム非依存のコア機能（task-history, worktree, custom-tools 等） |
| `packages/ipc`（`@openai-agent/ipc`）          | 外部プロセス（CLI/E2E）が拡張を制御するためのソケット IPC                   |
| `packages/vscode-shim`                         | Node.js 環境で VS Code API を模倣する互換レイヤー（CLI 用）                 |
| `packages/build`                               | esbuild ユーティリティ、`package.json` 生成                                 |
| `apps/cli`（`@openai-agent/cli`）              | ターミナルからエージェントを動かすスタンドアロン CLI                        |
| `apps/vscode-internal`                         | 拡張のビルド設定（`patchBranding` によるブランド差し替えを含む）            |
| `apps/vscode-e2e`                              | 拡張を実起動して行う統合テスト                                              |

---

## 3. 拡張機能のライフサイクル

入口は `src/extension.ts` の `activate()`。

1. `ContextProxy` で設定・シークレットを初期化。
2. ワークスペースごとに `CodeIndexManager` を生成し、バックグラウンドでコードインデックスを構築。
3. `ClineProvider`（`src/core/webview/ClineProvider.ts`）を生成し、サイドバー Webview として登録。
4. `registerCommands()`（`src/activate/registerCommands.ts`）でコマンド（新規タスク、履歴、設定、別タブで開く等）を登録。

`ClineProvider` が Webview と拡張ホストの橋渡しを担い、`Task` インスタンスのスタックを管理します（サブタスクで入れ子になる）。

---

## 4. エージェントループ（Task）

中核は `src/core/task/Task.ts`。1 回のユーザー要求 = 1 つの `Task`。

大まかな流れ:

1. ユーザーメッセージ + システムプロンプト（モードの `roleDefinition` や環境情報を含む）を組み立てる。
2. プロバイダ経由で LLM にストリーミング要求（`recursivelyMakeAgentRequests`）。
3. 応答からアシスタントメッセージ（`src/core/assistant-message`）をパースし、**ツール呼び出し**を抽出。
4. 自動承認（`src/core/auto-approval`）または `.agentignore`/保護ファイル（`src/core/ignore`, `src/core/protect`）の判定を経てツールを実行。
5. ツール結果を会話に追加して 2 へループ。`attempt_completion` ツールでタスク終了。

補助機構:

- **コンテキスト圧縮**（`src/core/condense`, `context-management`）: 会話が長くなった際に要約。
- **チェックポイント**（`src/core/checkpoints`, `services/checkpoints`）: 作業状態のスナップショット（shadow git）。
- **ファイル追跡**（`src/core/context-tracking/FileContextTracker.ts`）: エージェントが読んだ／編集したファイルの記録。

タスクの各段階はイベント（`AgentEventName`）として発火し、`src/extension/api.ts` の `API` クラスが集約して外部（IPC）へ中継します。

---

## 5. モード

組み込みモードは `packages/types/src/mode.ts` の `DEFAULT_MODES` で定義（`roleDefinition` / `whenToUse` / `groups` / `customInstructions`）。

| slug           | 用途                               | 権限グループ              |
| -------------- | ---------------------------------- | ------------------------- |
| `architect`    | 実装前の計画・設計                 | read, edit(.md のみ), mcp |
| `code`         | コードの記述・修正・リファクタ     | read, edit, command, mcp  |
| `ask`          | 質問への回答・説明（変更しない）   | read, mcp                 |
| `debug`        | 系統的な問題診断と修正             | read, edit, command, mcp  |
| `orchestrator` | 複雑なタスクを分割し各モードへ委譲 | （委譲のみ）              |

**カスタムモード**はプロジェクトルートの `.agentmodes`（YAML/JSON）で定義でき、`groups` によりツール権限を制御します。モード固有ルールは `.agent/rules-<slug>/` に置けます。

---

## 6. ツール

`src/core/tools/` に約 26 種。モードの `groups`（read / edit / command / mcp / browser…）で使用可否が決まります。代表例:

- ファイル: `ReadFileTool`, `WriteToFileTool`, `ApplyDiffTool`, `SearchAndReplaceTool`, `EditFileTool`, `ListFilesTool`
- 探索: `SearchFilesTool`, `CodebaseSearchTool`（コードインデックス利用）
- 実行: `ExecuteCommandTool`, `ReadCommandOutputTool`
- 制御: `AttemptCompletionTool`（完了）, `SwitchModeTool`, `NewTaskTool`（サブタスク）, `AskFollowupQuestionTool`, `UpdateTodoListTool`
- 拡張: `UseMcpToolTool` / `accessMcpResourceTool`（MCP）, `SkillTool`（スキル）, `RunSlashCommandTool`

ファイル編集は `DiffViewProvider`（`src/core/diff`）を通じ、適用前に差分をレビュー表示します。

---

## 7. プロバイダ（LLM 接続）

`src/api/providers/` のうち、本フォークで有効なのは **OpenAI Compatible**（`openai-compatible.ts` / `base-openai-compatible-provider.ts`）のみ。任意の OpenAI 互換エンドポイントと Azure OpenAI をカバーします。

- カスタムヘッダーは設定（`openAiHeaders`）で付与可能。
- 共通 HTTP ヘッダーは `src/api/providers/constants.ts`（`User-Agent`, `HTTP-Referer`, `X-Title`）。
- 退役プロバイダ（`retiredProviderNames`）は既存設定を安全に扱うためのフォールバックとして型に残存。

---

## 8. サービス層（`src/services/`）

| サービス                                      | 役割                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `mcp`                                         | Model Context Protocol サーバーとの接続。設定は `.agent/mcp.json`（プロジェクト）等 |
| `code-index`                                  | コードのベクトルインデックス（Qdrant 等）と埋め込み。`CodebaseSearchTool` の基盤    |
| `checkpoints`                                 | shadow git による作業スナップショット                                               |
| `skills`                                      | スキル（`SKILL.md`）の探索。`.agent/skills` が `.agents/skills` より優先            |
| `command`                                     | スラッシュコマンド・組み込みコマンド（`built-in-commands.ts`）                      |
| `agent-config`                                | `.agent` ディレクトリの探索（グローバル/プロジェクト/サブフォルダ）                 |
| `glob` / `search` / `ripgrep` / `tree-sitter` | ファイル列挙・全文検索・構文解析                                                    |

---

## 9. 統合層（`src/integrations/`）

- `terminal`: シェル実行の抽象化（`AgentTerminal*`）。VS Code ターミナル統合と実行結果の取り込み。
- `editor`: `DiffViewProvider` による差分表示、装飾。
- `diagnostics`: 言語サーバーの診断取り込み。
- `workspace` / `misc` / `theme`: ワークスペース情報、ファイルオープン、テーマ連携。

---

## 10. Webview UI（`webview-ui/`）

React + Vite。拡張ホストとは `postMessage` で通信します。

- 主要画面: チャット（`components/chat/ChatView.tsx`）、設定（`components/settings/`）。
- 設定のプロバイダ UI は `OpenAICompatible` のみ。
- 入力は `cachedState`（ローカルバッファ）にバインドし、「保存」で `ContextProxy` に反映（`AGENTS.md` の Settings View パターン参照）。
- 内部エイリアス `@agent/*` は拡張側の `src/shared/*` を指します。
- ビルドは Vite。ロケールは Vite が同梱するため、`patchBranding`（NLS 用）とは別経路です。

---

## 11. 設定・ファイル規約

| パス                                 | 用途                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `.agent/`                            | ルール・コマンド・MCP 設定・スキルを格納するプロジェクト設定ディレクトリ |
| `.agentmodes`                        | カスタムモード定義                                                       |
| `.agentrules` / `.agentrules-<mode>` | ルールファイル（レガシー `.clinerules` も併読）                          |
| `.agentignore`                       | エージェントのアクセス対象外指定                                         |
| `.agentprotected`                    | 書き込み保護対象（`AgentProtectedController`）                           |

保護パターンは `src/core/protect/AgentProtectedController.ts` の `PROTECTED_PATTERNS`（`.agentignore`, `.agentmodes`, `.agentrules*`, `.agent/**`, `.vscode/**`, `AGENTS.md` など）。

---

## 12. 国際化（i18n）

- 拡張側: `src/i18n/locales/{ja,en}`、およびマニフェスト用 `src/package.nls.json`（既定=英語）と `src/package.nls.ja.json`。
- Webview 側: `webview-ui/src/i18n/locales/{ja,en}`。
- 対応言語は日本語・英語のみ（`src/shared/language.ts` の `LANGUAGES`）。

---

## 13. ビルドとパッケージング

```bash
pnpm install
pnpm build                      # turbo で全パッケージをビルド
pnpm --filter openai-agent vsix # .vsix を生成
```

- 拡張本体は esbuild（`src/esbuild.mjs`）でバンドル。
- `apps/vscode-internal/esbuild.mjs` の `patchBranding()` が、ビルド成果物中に残る文字列を新ブランドへ機械的に置換する安全網として機能します。
- 拡張 ID: `internal.openai-compatible-agent` / publisher: `internal`。

---

## 付録: 主要な入口ファイル

| 関心事                 | ファイル                                               |
| ---------------------- | ------------------------------------------------------ |
| 拡張の起動             | `src/extension.ts`                                     |
| Webview ホスト         | `src/core/webview/ClineProvider.ts`                    |
| Webview メッセージ処理 | `src/core/webview/webviewMessageHandler.ts`            |
| エージェントループ     | `src/core/task/Task.ts`                                |
| モード定義             | `packages/types/src/mode.ts`                           |
| ツール群               | `src/core/tools/`                                      |
| プロバイダ             | `src/api/providers/openai-compatible.ts`               |
| 外部 API/イベント      | `src/extension/api.ts`, `packages/types/src/events.ts` |
