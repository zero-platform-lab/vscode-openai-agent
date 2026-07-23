import {
	type ModelInfo,
	type ProviderSettings,
	type VerbosityLevel,
	type ReasoningEffortExtended,
} from "@openai-agent/types"

import {
	DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS,
	GEMINI_25_PRO_MIN_THINKING_TOKENS,
	shouldUseReasoningBudget,
	shouldUseReasoningEffort,
	getModelMaxOutputTokens,
} from "../../shared/api"

import { type OpenAiReasoningParams, getOpenAiReasoning } from "./reasoning"

type GetModelParamsOptions = {
	modelId: string
	model: ModelInfo
	settings: ProviderSettings
	defaultTemperature: number
}

type BaseModelParams = {
	maxTokens: number | undefined
	temperature: number | undefined
	reasoningEffort: ReasoningEffortExtended | undefined
	reasoningBudget: number | undefined
	verbosity: VerbosityLevel | undefined
	tools?: boolean
}

export type ModelParams = {
	format: "openai"
	reasoning: OpenAiReasoningParams | undefined
} & BaseModelParams

export function getModelParams({ modelId, model, settings, defaultTemperature }: GetModelParamsOptions): ModelParams {
	const {
		modelMaxThinkingTokens: customMaxThinkingTokens,
		modelTemperature: customTemperature,
		reasoningEffort: customReasoningEffort,
		verbosity: customVerbosity,
	} = settings

	// Use the centralized logic for computing maxTokens
	const maxTokens = getModelMaxOutputTokens({
		modelId,
		model,
		settings,
		format: "openai",
	})

	let temperature: number | undefined = customTemperature ?? model.defaultTemperature ?? defaultTemperature
	let reasoningBudget: ModelParams["reasoningBudget"] = undefined
	let reasoningEffort: ModelParams["reasoningEffort"] = undefined
	const verbosity: VerbosityLevel | undefined = customVerbosity

	if (shouldUseReasoningBudget({ model, settings })) {
		// Check if this is a Gemini 2.5 Pro model
		const isGemini25Pro = modelId.includes("gemini-2.5-pro")

		// If `customMaxThinkingTokens` is not specified use the default.
		// For Gemini 2.5 Pro, default to 128 instead of 8192
		const defaultThinkingTokens = isGemini25Pro
			? GEMINI_25_PRO_MIN_THINKING_TOKENS
			: DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS
		reasoningBudget = customMaxThinkingTokens ?? defaultThinkingTokens

		// Reasoning cannot exceed 80% of the `maxTokens` value.
		// maxTokens should always be defined for reasoning budget models, but add a guard just in case
		if (maxTokens && reasoningBudget > Math.floor(maxTokens * 0.8)) {
			reasoningBudget = Math.floor(maxTokens * 0.8)
		}

		// Reasoning cannot be less than minimum tokens.
		// For Gemini 2.5 Pro models, the minimum is 128 tokens
		// For other models, the minimum is 1024 tokens
		const minThinkingTokens = isGemini25Pro ? GEMINI_25_PRO_MIN_THINKING_TOKENS : 1024
		if (reasoningBudget < minThinkingTokens) {
			reasoningBudget = minThinkingTokens
		}

		// Let's assume that "Hybrid" reasoning models require a temperature of
		// 1.0 since Anthropic does.
		temperature = 1.0
	} else if (shouldUseReasoningEffort({ model, settings })) {
		// "Traditional" reasoning models use the `reasoningEffort` parameter.
		// Only fallback to model default if user hasn't explicitly set a value.
		// If customReasoningEffort is "disable", don't fallback to model default.
		const effort =
			customReasoningEffort !== undefined
				? customReasoningEffort
				: (model.reasoningEffort as ReasoningEffortExtended | "disable" | undefined)
		// Capability and settings checks are handled by shouldUseReasoningEffort.
		// Here we simply propagate the resolved effort into the params, while
		// still treating "disable" as an omission.
		if (effort && effort !== "disable") {
			reasoningEffort = effort as ReasoningEffortExtended
		}
	}

	// Special case for o1 and o3-mini, which don't support temperature.
	// TODO: Add a `supportsTemperature` field to the model info.
	if (modelId.startsWith("o1") || modelId.startsWith("o3-mini")) {
		temperature = undefined
	}

	return {
		format: "openai",
		maxTokens,
		temperature,
		reasoningEffort,
		reasoningBudget,
		verbosity,
		reasoning: getOpenAiReasoning({ model, reasoningBudget, reasoningEffort, settings }),
	}
}
