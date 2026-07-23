import * as path from "path"
import Mocha from "mocha"
import { glob } from "glob"
import * as vscode from "vscode"

import type { AgentAPI } from "@openai-agent/types"

import { waitFor } from "./utils"

export async function run() {
	// Works whether VS Code loads the dev extension (src → "internal.openai-agent") or the built
	// internal extension (→ "internal.openai-compatible-agent"). The command/view prefix equals the
	// loaded extension's package name, so we derive it rather than hard-coding it.
	const extension =
		vscode.extensions.getExtension<AgentAPI>("internal.openai-compatible-agent") ??
		vscode.extensions.getExtension<AgentAPI>("internal.openai-agent")

	if (!extension) {
		throw new Error("Extension not found")
	}

	const commandPrefix: string = extension.packageJSON.name
	globalThis.commandPrefix = commandPrefix

	const api = extension.isActive ? extension.exports : await extension.activate()

	await api.setConfiguration({
		apiProvider: "openai" as const,
		// A reachable endpoint is not required to launch the sidebar webview (isReady === viewLaunched),
		// so a mock base URL is enough to exercise activation / command / view registration.
		openAiBaseUrl: process.env.OPENAI_BASE_URL ?? "http://127.0.0.1:65000/v1",
		openAiApiKey: process.env.OPENAI_API_KEY ?? "mock",
		openAiModelId: process.env.OPENAI_MODEL_ID ?? "mock-model",
	})

	await vscode.commands.executeCommand(`${commandPrefix}.SidebarProvider.focus`)
	await waitFor(() => api.isReady())

	globalThis.api = api

	const mochaOptions: Mocha.MochaOptions = {
		ui: "tdd",
		timeout: 20 * 60 * 1_000, // 20m
	}

	if (process.env.TEST_GREP) {
		mochaOptions.grep = process.env.TEST_GREP
		console.log(`Running tests matching pattern: ${process.env.TEST_GREP}`)
	}

	const mocha = new Mocha(mochaOptions)
	const cwd = path.resolve(__dirname, "..")

	let testFiles: string[]

	if (process.env.TEST_FILE) {
		const specificFile = process.env.TEST_FILE.endsWith(".js")
			? process.env.TEST_FILE
			: `${process.env.TEST_FILE}.js`

		testFiles = await glob(`**/${specificFile}`, { cwd })
		console.log(`Running specific test file: ${specificFile}`)
	} else {
		testFiles = await glob("**/**.test.js", { cwd })
	}

	if (testFiles.length === 0) {
		throw new Error(`No test files found matching criteria: ${process.env.TEST_FILE || "all tests"}`)
	}

	testFiles.forEach((testFile) => mocha.addFile(path.resolve(cwd, testFile)))

	return new Promise<void>((resolve, reject) =>
		mocha.run((failures) => (failures === 0 ? resolve() : reject(new Error(`${failures} tests failed.`)))),
	)
}
