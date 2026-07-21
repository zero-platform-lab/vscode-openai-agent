# OpenAI Compatible Agent — 社内配布用 VSCode 拡張

社内の OpenAI 互換 LLM エンドポイント（vLLM / Ollama / TGI / Azure OpenAI）に接続する
エージェント型 VSCode 拡張です。  
[Roo Code v3.54.0](https://github.com/RooCodeInc/Roo-Code)（Apache 2.0）をベースに改名・テレメトリ遮断を加えたスナップショットです。

---

## 目次

1. [ビルド済み .vsix のインストール](#ビルド済み-vsix-のインストール)
2. [社内エンドポイントの接続設定](#社内エンドポイントの接続設定)
3. [Azure OpenAI の接続設定](#azure-openai-の接続設定)
4. [ソースからビルドする場合](#ソースからビルドする場合)
5. [テレメトリ遮断について](#テレメトリ遮断について)
6. [セキュリティ上の注意事項](#セキュリティ上の注意事項)
7. [トラブルシューティング](#トラブルシューティング)

---

## ビルド済み .vsix のインストール

```bash
# VS Code にインストール
code --install-extension openai-compatible-agent-1.0.0.vsix

# Cursor にインストール
cursor --install-extension openai-compatible-agent-1.0.0.vsix

# VS Code を再起動する（必須）
```

アクティビティバーに「OpenAI Compatible Agent」のアイコンが表示されます。

### アンインストール

```bash
code --uninstall-extension internal.openai-compatible-agent
```

---

## 社内エンドポイントの接続設定

### 前提

社内 LLM サーバが OpenAI 互換の `/v1/chat/completions` エンドポイントを公開していること。

| サーバ種別 | base URL の例                |
| ---------- | ---------------------------- |
| vLLM       | `http://llm-server:8000/v1`  |
| Ollama     | `http://llm-server:11434/v1` |
| TGI        | `http://llm-server:8080/v1`  |

### 設定手順

1. VSCode で `OpenAI Compatible Agent` のサイドバーアイコンをクリック
2. 右上の歯車アイコン → **Settings** を開く
3. **API Provider** → **OpenAI Compatible** を選択
4. 以下を入力:

| 設定項目     | 入力値                                                                                  |
| ------------ | --------------------------------------------------------------------------------------- |
| **Base URL** | `http://<社内ホスト>:<ポート>/v1`                                                       |
| **API Key**  | サーバが API Key を要求する場合はその値。不要な場合は任意の文字列（例: `not-required`） |
| **Model ID** | サーバが提供するモデル名（例: `meta-llama/Llama-3.1-70B-Instruct`）                     |

5. **Done** をクリック。チャット欄にメッセージを入力してレスポンスが返れば接続成功。

### settings.json で設定する場合

```jsonc
// .vscode/settings.json
{
	"openai-compatible-agent.apiProvider": "openai-compatible",
	"openai-compatible-agent.openAiBaseUrl": "http://llm-server:8000/v1",
	"openai-compatible-agent.openAiApiKey": "not-required",
	"openai-compatible-agent.openAiModelId": "meta-llama/Llama-3.1-70B-Instruct",
}
```

> **Note:** モデルが利用可能か確認するには、以下を実行:
>
> ```bash
> curl http://llm-server:8000/v1/models
> ```

---

## Azure OpenAI の接続設定

Azure OpenAI Service のエンドポイントにも対応しています。

### 設定手順

1. **API Provider** → **OpenAI Compatible** を選択
2. 以下を入力:

| 設定項目     | 入力値                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| **Base URL** | `https://<リソース名>.openai.azure.com/openai/deployments/<デプロイ名>` |
| **API Key**  | Azure ポータルで取得した API キー                                       |
| **Model ID** | デプロイメント名（例: `gpt-4o`）                                        |

3. **Use Azure OpenAI** トグルを **ON** にする
4. **Azure API Version** にバージョンを入力（例: `2024-12-01-preview`。空欄ならデフォルト値が使われる）

### Azure AI Inference（Azure AI サービス）の場合

Azure AI Studio 経由の DeepSeek 等のモデルの場合:

| 設定項目     | 入力値                                              |
| ------------ | --------------------------------------------------- |
| **Base URL** | `https://<リソース名>.services.ai.azure.com/models` |
| **API Key**  | Azure ポータルで取得した API キー                   |
| **Model ID** | デプロイメント名                                    |

※ Azure AI Inference は base URL のドメインが `.services.ai.azure.com` であれば自動認識されます。

---

## ソースからビルドする場合

### 前提条件

- Node.js 20.x
- pnpm 10.8.1（`corepack enable pnpm && corepack prepare pnpm@10.8.1 --activate`）
- Git

### ビルド手順

```bash
# 依存パッケージのインストール
pnpm install

# internal ビルドの .vsix を生成
pnpm clean
pnpm vsix:internal

# 生成物
ls -lh bin/openai-compatible-agent-*.vsix
```

### ワンライナー（クリーンインストール）

```bash
pnpm install && pnpm clean && pnpm vsix:internal && code --install-extension bin/openai-compatible-agent-1.0.0.vsix
```

### バージョン変更

`apps/vscode-internal/package.internal.json` の `version` フィールドを書き換えてリビルドしてください。

---

## テレメトリ遮断について

本ビルドでは以下の外部通信を遮断しています:

1. **起動時の自動モデルリスト取得を無効化**  
   素の Roo Code は起動時に openrouter.ai / vercel-ai-gateway へモデル一覧を取得しに行きますが、
   internal ビルドではこの処理を無効化しています（`initializeModelCacheRefresh` を no-op に変更）。

2. **Webview の CSP（Content Security Policy）を最小化**  
   外部ドメイン（storage.googleapis.com, img.clerk.com, api.requesty.ai 等）への接続許可を除去しました。
   Webview は拡張自身のリソースのみ読み込みます。

3. **意図的な外部通信（残存）**  
   ユーザが明示的に設定した LLM エンドポイント（OpenAI Compatible / Azure OpenAI）への API 呼び出しは
   当然ながら残っています。これ以外の自動的な外部通信は発生しません。

---

## セキュリティ上の注意事項

本拡張はエージェント型 AI コーディングツールであり、以下のリスクがあります。  
利用者に周知のうえ、運用ルールを定めてください。

### 1. コマンド実行

エージェントはユーザの許可を得てターミナルコマンドを実行できます。  
悪意ある LLM レスポンスや、ファイル内のプロンプト注入によって意図しないコマンドが実行されるリスクがあります。

**対策:**

- `openai-compatible-agent.allowedCommands` でホワイトリスト運用する
- `openai-compatible-agent.deniedCommands` で危険なコマンド（`rm -rf`、`curl | sh` 等）をブロックする
- コマンド実行時の確認ダイアログを必ず確認する

### 2. ソースコードの LLM 送信

エージェントはワークスペース内のファイルを読み取り、プロンプトの一部として LLM に送信します。  
社内の機密コードが LLM エンドポイントに送られることを前提に運用してください。

**対策:**

- LLM サーバが社内ネットワーク内で完結していることを確認する
- 秘匿情報（API キー、パスワード）をソースコードに直書きしない
- `.gitignore` に含まれるファイルもエージェントは読み取れることに留意する

### 3. ファイル編集

エージェントはワークスペース内のファイルを直接編集します。  
差分は VSCode 上で確認・承認できますが、自動承認モードでは確認なしに編集が行われます。

### 4. MCP サーバ連携

MCP（Model Context Protocol）サーバを接続すると、外部ツールの機能をエージェントに追加できます。  
信頼できない MCP サーバの接続は**任意コード実行と同等のリスク**があります。

**対策:**

- 社内で検証済みの MCP サーバのみ接続を許可する

### 5. API キーの保管

API キーは VSCode の SecretStorage に保存されますが、ユーザのマシン上に保持されます。  
マシンの物理セキュリティが API キーの保護に直結します。

---

## トラブルシューティング

### API レスポンスが返ってこない

1. **ネットワーク疎通の確認**

    ```bash
    curl -v http://llm-server:8000/v1/models
    ```

2. **ストリーミングレスポンスの確認**

    ```bash
    curl -N -X POST http://llm-server:8000/v1/chat/completions \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer <your-key>" \
      -d '{"model":"<model-id>","messages":[{"role":"user","content":"hello"}],"stream":true}'
    ```

3. **VSCode の出力パネルで確認**

    - `表示` → `出力` → ドロップダウンから `OpenAI-Compatible-Agent` を選択
    - エラーメッセージやスタックトレースが表示されます

4. **よくある原因**
   | 症状 | 原因 | 対処 |
   |---|---|---|
   | `Connection refused` | サーバが起動していない / ポートが違う | URL とポートを確認 |
   | `401 Unauthorized` | API Key が違う | 正しい API Key を設定 |
   | `404 Not Found` | base URL のパスが違う | `/v1` が含まれているか確認 |
   | `timeout` | モデルのロード中 / サーバ過負荷 | サーバ側のログを確認 |
   | レスポンスが途中で切れる | `max_tokens` が小さい | モデル設定の Max Tokens を増やす |
   | ツール呼び出しが失敗する | モデルが function calling 非対応 | function calling 対応モデルを使用 |

### 拡張が表示されない

```bash
# インストール済みか確認
code --list-extensions | grep openai-compatible-agent
```

表示されない場合は `.vsix` ファイルを再インストールし、VSCode を再起動してください。

---

## ライセンス

[Apache 2.0 © 2026 Roo Code, Inc.](./LICENSE)

本ビルドは Roo Code の Apache 2.0 ライセンスに基づく改変物です。
