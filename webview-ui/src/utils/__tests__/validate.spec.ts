import { describe, it, expect, vi } from "vitest"

import type { ProviderSettings } from "@openai-agent/types"

// i18next is not initialized in unit tests; return the key so error messages are non-empty.
vi.mock("i18next", () => ({ default: { t: (key: string) => key } }))

import { validateApiConfiguration } from "../validate"

describe("validateApiConfiguration — OpenAI Compatible provider", () => {
	const base = { apiProvider: "openai" as const }

	it("is valid with base URL and model but NO API key (local vLLM / Ollama / TGI need no auth)", () => {
		const config: ProviderSettings = {
			...base,
			openAiBaseUrl: "http://localhost:8000/v1",
			openAiModelId: "my-model",
		}
		expect(validateApiConfiguration(config)).toBeUndefined()
	})

	it("stays valid when an API key is also provided", () => {
		const config: ProviderSettings = {
			...base,
			openAiBaseUrl: "http://localhost:8000/v1",
			openAiModelId: "my-model",
			openAiApiKey: "sk-something",
		}
		expect(validateApiConfiguration(config)).toBeUndefined()
	})

	it("errors when the base URL is missing", () => {
		expect(validateApiConfiguration({ ...base, openAiModelId: "my-model" })).toBeTruthy()
	})

	it("errors when the model id is missing", () => {
		expect(validateApiConfiguration({ ...base, openAiBaseUrl: "http://localhost:8000/v1" })).toBeTruthy()
	})
})
