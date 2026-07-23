import { Package } from "../../shared/package"

export const DEFAULT_HEADERS = {
	"HTTP-Referer": "https://github.com/zero-platform-lab/vscode-openai-agent",
	"X-Title": "OpenAI Compatible Agent",
	"User-Agent": `OpenAIAgent/${Package.version}`,
}
