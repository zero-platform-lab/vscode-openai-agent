// npx vitest run api/transform/__tests__/model-params.spec.ts

import { type ModelInfo } from "@openai-agent/types"

import { getModelParams } from "../model-params"
import {
	DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS,
	DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS,
} from "../../../shared/api"

// [INTERNAL] This build only ships the OpenAI Compatible provider, so getModelParams
// always produces OpenAI-format params. These tests cover that single path.
describe("getModelParams", () => {
	const baseModel: ModelInfo = {
		contextWindow: 16000,
		supportsPromptCache: true,
	}

	const base = {
		modelId: "test",
		defaultTemperature: 0,
	}

	describe("Basic functionality", () => {
		it("should return default values when no custom values are provided", () => {
			const result = getModelParams({
				...base,
				settings: {},
				model: baseModel,
				defaultTemperature: 0.5,
			})

			expect(result).toEqual({
				format: "openai",
				maxTokens: undefined,
				temperature: 0.5,
				reasoningEffort: undefined,
				reasoningBudget: undefined,
				verbosity: undefined,
				reasoning: undefined,
			})
		})

		it("should use custom temperature from settings when provided", () => {
			const result = getModelParams({
				...base,
				settings: { modelTemperature: 0.7 },
				model: baseModel,
				defaultTemperature: 0.5,
			})

			expect(result.temperature).toBe(0.7)
		})

		it("should fall back to defaultTemperature when settings temperature is null", () => {
			const result = getModelParams({
				...base,
				settings: { modelTemperature: null },
				model: baseModel,
				defaultTemperature: 0.5,
			})

			expect(result.temperature).toBe(0.5)
		})

		it("should use model defaultTemperature over provider defaultTemperature", () => {
			const model: ModelInfo = { ...baseModel, defaultTemperature: 0.8 }
			const result = getModelParams({ ...base, settings: {}, model, defaultTemperature: 0.5 })
			expect(result.temperature).toBe(0.8)
		})

		it("should prefer settings temperature over model defaultTemperature", () => {
			const model: ModelInfo = { ...baseModel, defaultTemperature: 0.8 }
			const result = getModelParams({
				...base,
				settings: { modelTemperature: 0.3 },
				model,
				defaultTemperature: 0.5,
			})
			expect(result.temperature).toBe(0.3)
		})

		it("should use model maxTokens when available", () => {
			const model: ModelInfo = { ...baseModel, maxTokens: 2000 }
			expect(getModelParams({ ...base, settings: {}, model }).maxTokens).toBe(2000)
		})

		it("should leave maxTokens undefined when neither model nor settings provide it", () => {
			const model: ModelInfo = { ...baseModel, maxTokens: null }
			expect(getModelParams({ ...base, settings: {}, model }).maxTokens).toBeUndefined()
		})

		it("should exclude temperature for o1/o3-mini models", () => {
			const o1 = getModelParams({ ...base, modelId: "o1", settings: { modelTemperature: 0.9 }, model: baseModel })
			expect(o1.temperature).toBeUndefined()
			const o3 = getModelParams({
				...base,
				modelId: "o3-mini",
				settings: { modelTemperature: 0.9 },
				model: baseModel,
			})
			expect(o3.temperature).toBeUndefined()
		})
	})

	describe("Reasoning Budget (Hybrid reasoning models)", () => {
		it("should compute the reasoning budget and force temperature to 1.0", () => {
			const model: ModelInfo = { ...baseModel, requiredReasoningBudget: true }
			const result = getModelParams({ ...base, settings: { modelMaxTokens: 2000 }, model })

			expect(result.maxTokens).toBe(2000)
			expect(result.temperature).toBe(1.0)
			expect(result.reasoningBudget).toBe(1600) // 80% of 2000
			// OpenAI-format params do not carry a provider-specific reasoning payload for budget models.
			expect(result.reasoning).toBeUndefined()
		})

		it("should honor customMaxThinkingTokens for reasoning budget models", () => {
			const model: ModelInfo = { ...baseModel, requiredReasoningBudget: true }
			const result = getModelParams({
				...base,
				settings: { modelMaxTokens: 4000, modelMaxThinkingTokens: 1500 },
				model,
			})
			expect(result.reasoningBudget).toBe(1500)
		})

		it("should clamp thinking budget to at least 1024 tokens", () => {
			const model: ModelInfo = { ...baseModel, requiredReasoningBudget: true }
			const result = getModelParams({
				...base,
				settings: { modelMaxTokens: 2000, modelMaxThinkingTokens: 500 },
				model,
			})
			expect(result.reasoningBudget).toBe(1024)
		})

		it("should clamp thinking budget to at most 80% of max tokens", () => {
			const model: ModelInfo = { ...baseModel, requiredReasoningBudget: true }
			const result = getModelParams({
				...base,
				settings: { modelMaxTokens: 4000, modelMaxThinkingTokens: 5000 },
				model,
			})
			expect(result.reasoningBudget).toBe(3200) // 80% of 4000
		})

		it("should use hybrid-reasoning defaults when no maxTokens is provided", () => {
			const model: ModelInfo = { ...baseModel, requiredReasoningBudget: true }
			const result = getModelParams({ ...base, settings: {}, model })
			expect(result.maxTokens).toBe(DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS)
			expect(result.reasoningBudget).toBe(DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS)
		})

		it("should not use a reasoning budget when enableReasoningEffort is false", () => {
			const model: ModelInfo = { ...baseModel, maxTokens: 2000, supportsReasoningBudget: true }
			const result = getModelParams({ ...base, settings: { enableReasoningEffort: false }, model })
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0)
		})
	})

	describe("Reasoning Effort (Traditional reasoning models)", () => {
		it("should use the model's reasoningEffort", () => {
			const model: ModelInfo = { ...baseModel, supportsReasoningEffort: true, reasoningEffort: "medium" }
			const result = getModelParams({ ...base, settings: {}, model })
			expect(result.reasoningEffort).toBe("medium")
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0) // Not forced to 1.0 for effort models
			expect(result.reasoning).toEqual({ reasoning_effort: "medium" })
		})

		it("should prefer settings reasoningEffort over the model's", () => {
			const model: ModelInfo = { ...baseModel, supportsReasoningEffort: true, reasoningEffort: "low" }
			const result = getModelParams({ ...base, settings: { reasoningEffort: "high" }, model })
			expect(result.reasoningEffort).toBe("high")
			expect(result.reasoning).toEqual({ reasoning_effort: "high" })
		})

		it("should not set reasoning effort when none is specified", () => {
			const model: ModelInfo = { ...baseModel, supportsReasoningEffort: true }
			const result = getModelParams({ ...base, settings: {}, model })
			expect(result.reasoningEffort).toBeUndefined()
			expect(result.reasoning).toBeUndefined()
		})

		it("should include 'minimal' effort", () => {
			const model: ModelInfo = {
				...baseModel,
				supportsReasoningEffort: ["minimal", "low", "medium", "high"] as any,
			}
			const result = getModelParams({ ...base, settings: { reasoningEffort: "minimal" as any }, model })
			expect(result.reasoningEffort).toBe("minimal")
			expect(result.reasoning).toEqual({ reasoning_effort: "minimal" })
		})

		it("should omit reasoning for a 'disable' selection", () => {
			const model: ModelInfo = { ...baseModel, supportsReasoningEffort: true }
			const result = getModelParams({ ...base, settings: { reasoningEffort: "disable" as any }, model })
			expect(result.reasoningEffort).toBeUndefined()
			expect(result.reasoning).toBeUndefined()
		})
	})
})
