// npx vitest run src/__tests__/index.test.ts

import { generatePackageJson } from "../index.js"

describe("generatePackageJson", () => {
	it("should be a test", () => {
		const generatedPackageJson = generatePackageJson({
			packageJson: {
				name: "openai-agent",
				displayName: "%extension.displayName%",
				description: "%extension.description%",
				publisher: "internal",
				version: "3.17.2",
				icon: "assets/icons/icon.png",
				contributes: {
					viewsContainers: {
						activitybar: [
							{
								id: "openai-agent-ActivityBar",
								title: "%views.activitybar.title%",
								icon: "assets/icons/icon.svg",
							},
						],
					},
					views: {
						"openai-agent-ActivityBar": [
							{
								type: "webview",
								id: "openai-agent.SidebarProvider",
								name: "",
							},
						],
					},
					commands: [
						{
							command: "openai-agent.plusButtonClicked",
							title: "%command.newTask.title%",
							icon: "$(edit)",
						},
						{
							command: "openai-agent.openInNewTab",
							title: "%command.openInNewTab.title%",
							category: "%configuration.title%",
						},
					],
					menus: {
						"editor/context": [
							{
								submenu: "openai-agent.contextMenu",
								group: "navigation",
							},
						],
						"openai-agent.contextMenu": [
							{
								command: "openai-agent.addToContext",
								group: "1_actions@1",
							},
						],
						"editor/title": [
							{
								command: "openai-agent.plusButtonClicked",
								group: "navigation@1",
								when: "activeWebviewPanelId == openai-agent.TabPanelProvider",
							},
							{
								command: "openai-agent.settingsButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == openai-agent.TabPanelProvider",
							},
							{
								command: "openai-agent.accountButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == openai-agent.TabPanelProvider",
							},
						],
					},
					submenus: [
						{
							id: "openai-agent.contextMenu",
							label: "%views.contextMenu.label%",
						},
						{
							id: "openai-agent.terminalMenu",
							label: "%views.terminalMenu.label%",
						},
					],
					configuration: {
						title: "%configuration.title%",
						properties: {
							"openai-agent.allowedCommands": {
								type: "array",
								items: {
									type: "string",
								},
								default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
								description: "%commands.allowedCommands.description%",
							},
							"openai-agent.customStoragePath": {
								type: "string",
								default: "",
								description: "%settings.customStoragePath.description%",
							},
						},
					},
				},
				scripts: {
					lint: "eslint **/*.ts",
				},
			},
			overrideJson: {
				name: "openai-agent-nightly",
				displayName: "OpenAI Agent Nightly",
				publisher: "internal",
				version: "0.0.1",
				icon: "assets/icons/icon-nightly.png",
				scripts: {},
			},
			substitution: ["openai-agent", "openai-agent-nightly"],
		})

		expect(generatedPackageJson).toStrictEqual({
			name: "openai-agent-nightly",
			displayName: "OpenAI Agent Nightly",
			description: "%extension.description%",
			publisher: "internal",
			version: "0.0.1",
			icon: "assets/icons/icon-nightly.png",
			contributes: {
				viewsContainers: {
					activitybar: [
						{
							id: "openai-agent-nightly-ActivityBar",
							title: "%views.activitybar.title%",
							icon: "assets/icons/icon.svg",
						},
					],
				},
				views: {
					"openai-agent-nightly-ActivityBar": [
						{
							type: "webview",
							id: "openai-agent-nightly.SidebarProvider",
							name: "",
						},
					],
				},
				commands: [
					{
						command: "openai-agent-nightly.plusButtonClicked",
						title: "%command.newTask.title%",
						icon: "$(edit)",
					},
					{
						command: "openai-agent-nightly.openInNewTab",
						title: "%command.openInNewTab.title%",
						category: "%configuration.title%",
					},
				],
				menus: {
					"editor/context": [
						{
							submenu: "openai-agent-nightly.contextMenu",
							group: "navigation",
						},
					],
					"openai-agent-nightly.contextMenu": [
						{
							command: "openai-agent-nightly.addToContext",
							group: "1_actions@1",
						},
					],
					"editor/title": [
						{
							command: "openai-agent-nightly.plusButtonClicked",
							group: "navigation@1",
							when: "activeWebviewPanelId == openai-agent-nightly.TabPanelProvider",
						},
						{
							command: "openai-agent-nightly.settingsButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == openai-agent-nightly.TabPanelProvider",
						},
						{
							command: "openai-agent-nightly.accountButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == openai-agent-nightly.TabPanelProvider",
						},
					],
				},
				submenus: [
					{
						id: "openai-agent-nightly.contextMenu",
						label: "%views.contextMenu.label%",
					},
					{
						id: "openai-agent-nightly.terminalMenu",
						label: "%views.terminalMenu.label%",
					},
				],
				configuration: {
					title: "%configuration.title%",
					properties: {
						"openai-agent-nightly.allowedCommands": {
							type: "array",
							items: {
								type: "string",
							},
							default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
							description: "%commands.allowedCommands.description%",
						},
						"openai-agent-nightly.customStoragePath": {
							type: "string",
							default: "",
							description: "%settings.customStoragePath.description%",
						},
					},
				},
			},
			scripts: {},
		})
	})
})
