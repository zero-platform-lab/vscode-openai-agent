import { type ProviderName, type ModelInfo } from "@openai-agent/types"

export const MODELS_BY_PROVIDER: Partial<Record<ProviderName, Record<string, ModelInfo>>> = {}

export const PROVIDERS = [{ value: "openai", label: "OpenAI Compatible / Azure OpenAI", proxy: true }]
