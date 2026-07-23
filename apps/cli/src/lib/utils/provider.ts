import { AgentSettings } from "@openai-agent/types"

import type { SupportedProvider } from "@/types/index.js"

// [INTERNAL] Only the OpenAI Compatible provider is supported in this build.
const envVarMap: Record<SupportedProvider, string> = {
	openai: "OPENAI_API_KEY",
}

export function getEnvVarName(provider: SupportedProvider): string {
	return envVarMap[provider]
}

export function getApiKeyFromEnv(provider: SupportedProvider): string | undefined {
	const envVar = getEnvVarName(provider)
	return process.env[envVar]
}

export function getProviderSettings(
	provider: SupportedProvider,
	apiKey: string | undefined,
	model: string | undefined,
): AgentSettings {
	const config: AgentSettings = { apiProvider: provider }

	if (apiKey) config.openAiApiKey = apiKey
	if (model) config.openAiModelId = model

	return config
}
