import { getApiKeyFromEnv } from "../provider.js"

describe("getApiKeyFromEnv", () => {
	const originalEnv = process.env

	beforeEach(() => {
		// Reset process.env before each test.
		process.env = { ...originalEnv }
	})

	afterEach(() => {
		process.env = originalEnv
	})

	it("should return API key from environment variable for openai", () => {
		process.env.OPENAI_API_KEY = "test-openai-key"
		expect(getApiKeyFromEnv("openai")).toBe("test-openai-key")
	})

	it("should return undefined when API key is not set", () => {
		delete process.env.OPENAI_API_KEY
		expect(getApiKeyFromEnv("openai")).toBeUndefined()
	})
})
