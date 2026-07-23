// npx vitest run src/api/providers/__tests__/testOpenAiConnection.spec.ts

import axios from "axios"
import { describe, it, expect, vi, beforeEach } from "vitest"

import { testOpenAiConnection } from "../openai"

vi.mock("axios")

const mockedGet = axios.get as unknown as ReturnType<typeof vi.fn>

describe("testOpenAiConnection", () => {
	beforeEach(() => {
		vi.resetAllMocks()
	})

	it("fails when the base URL is missing", async () => {
		const r = await testOpenAiConnection("")
		expect(r.success).toBe(false)
		expect(r.message).toContain("Base URL")
	})

	it("fails when the base URL is malformed", async () => {
		const r = await testOpenAiConnection("not a url")
		expect(r.success).toBe(false)
		expect(r.message).toContain("不正")
	})

	it("succeeds and reports the model count", async () => {
		mockedGet.mockResolvedValue({ data: { data: [{ id: "a" }, { id: "b" }, { id: "c" }] } })
		const r = await testOpenAiConnection("http://localhost:8000/v1")
		expect(r.success).toBe(true)
		expect(r.message).toContain("3")
	})

	it("classifies 401/403 as an auth error", async () => {
		mockedGet.mockRejectedValue({ response: { status: 401 } })
		const r = await testOpenAiConnection("http://x/v1", "bad-key")
		expect(r.success).toBe(false)
		expect(r.message).toContain("認証")
	})

	it("classifies 404 as an endpoint/path error", async () => {
		mockedGet.mockRejectedValue({ response: { status: 404 } })
		expect((await testOpenAiConnection("http://x")).message).toContain("404")
	})

	it("classifies DNS failures", async () => {
		mockedGet.mockRejectedValue({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND" })
		expect((await testOpenAiConnection("http://nope.invalid/v1")).message).toContain("DNS")
	})

	it("classifies connection refused", async () => {
		mockedGet.mockRejectedValue({ code: "ECONNREFUSED", message: "connect ECONNREFUSED" })
		expect((await testOpenAiConnection("http://localhost:9/v1")).message).toContain("拒否")
	})

	it("classifies TLS/SSL certificate errors", async () => {
		mockedGet.mockRejectedValue({ code: "CERT_HAS_EXPIRED", message: "certificate has expired" })
		expect((await testOpenAiConnection("https://x/v1")).message).toContain("SSL")
	})

	it("classifies timeouts", async () => {
		mockedGet.mockRejectedValue({ code: "ECONNABORTED", message: "timeout of 15000ms exceeded" })
		expect((await testOpenAiConnection("http://x/v1")).message).toContain("タイムアウト")
	})

	it("classifies proxy failures", async () => {
		mockedGet.mockRejectedValue({ code: "", message: "error connecting to proxy" })
		expect((await testOpenAiConnection("http://x/v1")).message).toContain("プロキシ")
	})
})
