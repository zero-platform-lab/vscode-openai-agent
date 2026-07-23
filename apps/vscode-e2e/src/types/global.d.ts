import type { AgentAPI } from "@openai-agent/types"

declare global {
	// eslint-disable-next-line no-var
	var api: AgentAPI
	// The loaded extension's command/view prefix (== its package name): "openai-agent" in dev,
	// "openai-compatible-agent" for the built internal extension.
	// eslint-disable-next-line no-var
	var commandPrefix: string
}

export {}
