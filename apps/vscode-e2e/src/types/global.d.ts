import type { AgentAPI } from "@openai-agent/types"

declare global {
	// eslint-disable-next-line no-var
	var api: AgentAPI
}

export {}
