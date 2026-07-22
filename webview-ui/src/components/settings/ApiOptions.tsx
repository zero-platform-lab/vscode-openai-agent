import React, { memo, useCallback, useEffect, useMemo, useState } from "react"
import { convertHeadersToObject } from "./utils/headers"
import { useDebounce } from "react-use"

import {
	type ProviderName,
	type ProviderSettings,
	isRetiredProvider,
	DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
} from "@openai-agent/types"

import { vscode } from "@src/utils/vscode"
import { validateApiConfigurationExcludingModelErrors, getModelValidationError } from "@src/utils/validate"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useRouterModels } from "@src/components/ui/hooks/useRouterModels"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { filterModels } from "./utils/organizationFilters"
import { SearchableSelect, Collapsible, CollapsibleTrigger, CollapsibleContent } from "@src/components/ui"

import { OpenAICompatible } from "./providers"

import { MODELS_BY_PROVIDER, PROVIDERS } from "./constants"
import { inputEventTransform, noTransform } from "./transforms"
import { ApiErrorMessage } from "./ApiErrorMessage"
import { ThinkingBudget } from "./ThinkingBudget"
import { Verbosity } from "./Verbosity"
import { TodoListSettingsControl } from "./TodoListSettingsControl"
import { TemperatureControl } from "./TemperatureControl"
import { RateLimitSecondsControl } from "./RateLimitSecondsControl"
import { ConsecutiveMistakeLimitControl } from "./ConsecutiveMistakeLimitControl"

export interface ApiOptionsProps {
	uriScheme: string | undefined
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	fromWelcomeView?: boolean
	errorMessage: string | undefined
	setErrorMessage: React.Dispatch<React.SetStateAction<string | undefined>>
}

const ApiOptions = ({
	apiConfiguration,
	setApiConfigurationField,
	fromWelcomeView,
	errorMessage,
	setErrorMessage,
}: ApiOptionsProps) => {
	const { t } = useAppTranslation()
	const { organizationAllowList } = useExtensionState()

	const [customHeaders, setCustomHeaders] = useState<[string, string][]>(() => {
		const headers = apiConfiguration?.openAiHeaders || {}
		return Object.entries(headers)
	})

	useEffect(() => {
		const propHeaders = apiConfiguration?.openAiHeaders || {}

		if (JSON.stringify(customHeaders) !== JSON.stringify(Object.entries(propHeaders))) {
			setCustomHeaders(Object.entries(propHeaders))
		}
	}, [apiConfiguration?.openAiHeaders, customHeaders])

	// Helper to convert array of tuples to object (filtering out empty keys).

	// Debounced effect to update the main configuration when local
	// customHeaders state stabilizes.
	useDebounce(
		() => {
			const currentConfigHeaders = apiConfiguration?.openAiHeaders || {}
			const newHeadersObject = convertHeadersToObject(customHeaders)

			// Only update if the processed object is different from the current config.
			if (JSON.stringify(currentConfigHeaders) !== JSON.stringify(newHeadersObject)) {
				setApiConfigurationField("openAiHeaders", newHeadersObject, false)
			}
		},
		300,
		[customHeaders, apiConfiguration?.openAiHeaders, setApiConfigurationField],
	)

	const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false)

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	const {
		provider: selectedProvider,
		id: selectedModelId,
		info: selectedModelInfo,
	} = useSelectedModel(apiConfiguration)
	const isRetiredSelectedProvider =
		typeof apiConfiguration.apiProvider === "string" && isRetiredProvider(apiConfiguration.apiProvider)

	const { data: routerModels } = useRouterModels()

	// Update `apiModelId` whenever `selectedModelId` changes.
	useEffect(() => {
		if (isRetiredSelectedProvider) {
			return
		}

		if (selectedModelId && apiConfiguration.apiModelId !== selectedModelId) {
			// Pass false as third parameter to indicate this is not a user action
			// This is an internal sync, not a user-initiated change
			setApiConfigurationField("apiModelId", selectedModelId, false)
		}
	}, [selectedModelId, setApiConfigurationField, apiConfiguration.apiModelId, isRetiredSelectedProvider])

	// Debounced refresh model updates, only executed 250ms after the user
	// stops typing.
	useDebounce(
		() => {
			if (selectedProvider === "openai") {
				const headerObject = convertHeadersToObject(customHeaders)

				vscode.postMessage({
					type: "requestOpenAiModels",
					values: {
						baseUrl: apiConfiguration?.openAiBaseUrl,
						apiKey: apiConfiguration?.openAiApiKey,
						customHeaders: {},
						openAiHeaders: headerObject,
					},
				})
			}
		},
		250,
		[selectedProvider, apiConfiguration?.openAiBaseUrl, apiConfiguration?.openAiApiKey, customHeaders],
	)

	useEffect(() => {
		if (isRetiredSelectedProvider) {
			setErrorMessage(undefined)
			return
		}

		const apiValidationResult = validateApiConfigurationExcludingModelErrors(
			apiConfiguration,
			routerModels,
			organizationAllowList,
		)
		setErrorMessage(apiValidationResult)
	}, [apiConfiguration, routerModels, organizationAllowList, setErrorMessage, isRetiredSelectedProvider])

	const onProviderChange = useCallback(
		(value: ProviderName) => {
			setApiConfigurationField("apiProvider", value)

			// It would be much easier to have a single attribute that stores
			// the modelId, but we have a separate attribute for each of
			// OpenRouter and Requesty.
			// If you switch to one of these providers and the corresponding
			// modelId is not set then you immediately end up in an error state.
			// To address that we set the modelId to the default value for th
			// provider if it's not already set.
			const validateAndResetModel = (
				provider: ProviderName,
				modelId: string | undefined,
				field: keyof ProviderSettings,
				defaultValue?: string,
			) => {
				// in case we haven't set a default value for a provider
				if (!defaultValue) return

				// 1) If nothing is set, initialize to the provider default.
				if (!modelId) {
					setApiConfigurationField(field, defaultValue, false)
					return
				}

				// 2) If something *is* set, ensure it's valid for the newly selected provider.
				//
				// Without this, switching providers can leave the UI showing a model from the
				// previously selected provider (including model IDs that don't exist for the
				// newly selected provider).
				//
				// Note: We only validate providers with static model lists.
				const staticModels = MODELS_BY_PROVIDER[provider]
				if (!staticModels) {
					return
				}

				// Bedrock has a special “custom-arn” pseudo-model that isn't part of MODELS_BY_PROVIDER.
				if (provider === "bedrock" && modelId === "custom-arn") {
					return
				}

				const filteredModels = filterModels(staticModels, provider, organizationAllowList)
				const isValidModel = !!filteredModels && Object.prototype.hasOwnProperty.call(filteredModels, modelId)
				if (!isValidModel) {
					setApiConfigurationField(field, defaultValue, false)
				}
			}

			const PROVIDER_MODEL_CONFIG: Partial<
				Record<
					ProviderName,
					{
						field: keyof ProviderSettings
						default?: string
					}
				>
			> = {
				openai: { field: "openAiModelId" },
			}

			const config = PROVIDER_MODEL_CONFIG[value]
			if (config) {
				validateAndResetModel(
					value,
					apiConfiguration[config.field] as string | undefined,
					config.field,
					config.default,
				)
			}
		},
		[setApiConfigurationField, apiConfiguration, organizationAllowList],
	)

	const modelValidationError = useMemo(() => {
		return getModelValidationError(apiConfiguration, routerModels, organizationAllowList)
	}, [apiConfiguration, routerModels, organizationAllowList])

	const providerOptions = useMemo(() => {
		return PROVIDERS.map(({ value, label }) => ({ value, label }))
	}, [])

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1 relative">
				<div className="flex justify-between items-center">
					<label className="block font-medium">{t("settings:providers.apiProvider")}</label>
				</div>
				<SearchableSelect
					value={selectedProvider}
					onValueChange={(value) => onProviderChange(value as ProviderName)}
					options={providerOptions}
					placeholder={t("settings:common.select")}
					searchPlaceholder={t("settings:providers.searchProviderPlaceholder")}
					emptyMessage={t("settings:providers.noProviderMatchFound")}
					className="w-full"
					data-testid="provider-select"
				/>
			</div>

			{errorMessage && <ApiErrorMessage errorMessage={errorMessage} />}

			{isRetiredSelectedProvider ? (
				<div
					className="rounded-md border border-vscode-panel-border px-3 py-2 text-sm text-vscode-descriptionForeground"
					data-testid="retired-provider-message">
					{t("settings:providers.retiredProviderMessage")}
				</div>
			) : (
				<>
					{selectedProvider === "openai" && (
						<OpenAICompatible
							apiConfiguration={apiConfiguration}
							setApiConfigurationField={setApiConfigurationField}
							organizationAllowList={organizationAllowList}
							modelValidationError={modelValidationError}
							simplifySettings={fromWelcomeView}
						/>
					)}

					{!fromWelcomeView && (
						<ThinkingBudget
							key={`${selectedProvider}-${selectedModelId}`}
							apiConfiguration={apiConfiguration}
							setApiConfigurationField={setApiConfigurationField}
							modelInfo={selectedModelInfo}
						/>
					)}

					{!fromWelcomeView && selectedModelInfo?.supportsVerbosity && (
						<Verbosity
							apiConfiguration={apiConfiguration}
							setApiConfigurationField={setApiConfigurationField}
							modelInfo={selectedModelInfo}
						/>
					)}

					{!fromWelcomeView && (
						<Collapsible open={isAdvancedSettingsOpen} onOpenChange={setIsAdvancedSettingsOpen}>
							<CollapsibleTrigger className="flex items-center gap-1 w-full cursor-pointer hover:opacity-80 mb-2">
								<span
									className={`codicon codicon-chevron-${isAdvancedSettingsOpen ? "down" : "right"}`}></span>
								<span className="font-medium">{t("settings:advancedSettings.title")}</span>
							</CollapsibleTrigger>
							<CollapsibleContent className="space-y-3">
								<TodoListSettingsControl
									todoListEnabled={apiConfiguration.todoListEnabled}
									onChange={(field, value) => setApiConfigurationField(field, value)}
								/>
								{selectedModelInfo?.supportsTemperature !== false && (
									<TemperatureControl
										value={apiConfiguration.modelTemperature}
										onChange={handleInputChange("modelTemperature", noTransform)}
										maxValue={2}
										defaultValue={selectedModelInfo?.defaultTemperature}
									/>
								)}
								<RateLimitSecondsControl
									value={apiConfiguration.rateLimitSeconds || 0}
									onChange={(value) => setApiConfigurationField("rateLimitSeconds", value)}
								/>
								<ConsecutiveMistakeLimitControl
									value={
										apiConfiguration.consecutiveMistakeLimit !== undefined
											? apiConfiguration.consecutiveMistakeLimit
											: DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
									}
									onChange={(value) => setApiConfigurationField("consecutiveMistakeLimit", value)}
								/>
							</CollapsibleContent>
						</Collapsible>
					)}
				</>
			)}
		</div>
	)
}

export default memo(ApiOptions)
