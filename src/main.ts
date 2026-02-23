import { Notice, Plugin } from "obsidian";
import type { ZoteroMCPSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { ZoteroMCPSettingTab } from "./settings";
import { MCPServerManager } from "./mcp-server";
import { MCPClient } from "./mcp-client";
import { createLLMProvider } from "./llm/index";
import { Orchestrator } from "./orchestrator";
import { ZoteroChatView, VIEW_TYPE_ZOTERO_CHAT } from "./chat-view";

export default class ZoteroMCPChatPlugin extends Plugin {
	settings!: ZoteroMCPSettings;
	private mcpServer: MCPServerManager | null = null;
	private mcpClient: MCPClient | null = null;
	private orchestrator: Orchestrator | null = null;

	async onload(): Promise<void> {
		console.log("Loading Zotero MCP Chat plugin");

		await this.loadSettings();

		// Register the chat view
		this.registerView(VIEW_TYPE_ZOTERO_CHAT, (leaf) => {
			return new ZoteroChatView(leaf, this);
		});

		// Ribbon icon
		this.addRibbonIcon("book-open", "Open Zotero Chat", () => {
			this.activateChatView();
		});

		// Command to open chat
		this.addCommand({
			id: "open-zotero-chat",
			name: "Open Zotero Chat",
			callback: () => {
				this.activateChatView();
			},
		});

		// Settings tab
		this.addSettingTab(new ZoteroMCPSettingTab(this.app, this));

		// Start MCP server in background
		this.startMCPServer();
	}

	async onunload(): Promise<void> {
		console.log("Unloading Zotero MCP Chat plugin");

		if (this.mcpClient) {
			await this.mcpClient.close();
			this.mcpClient = null;
		}

		if (this.mcpServer) {
			this.mcpServer.stop();
			this.mcpServer = null;
		}

		this.orchestrator = null;
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Recreate orchestrator with new settings when settings change
		this.rebuildOrchestrator();
	}

	isMCPRunning(): boolean {
		return this.mcpServer?.isRunning() ?? false;
	}

	getOrchestrator(): Orchestrator | null {
		return this.orchestrator;
	}

	private async startMCPServer(): Promise<void> {
		try {
			this.mcpServer = new MCPServerManager(
				this.settings.mcpExecutablePath,
				this.settings.mcpServerPort
			);
			await this.mcpServer.start();

			// Initialize MCP client
			this.mcpClient = new MCPClient(this.mcpServer.getBaseUrl());
			await this.mcpClient.initialize();

			// Build orchestrator
			this.rebuildOrchestrator();

			new Notice("Zotero MCP Chat: Server connected");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error("Failed to start MCP server:", msg);
			new Notice(
				`Zotero MCP Chat: Could not connect to the Zotero MCP server. ${msg}`,
				10000
			);
		}
	}

	private rebuildOrchestrator(): void {
		if (!this.mcpClient) return;
		const llm = createLLMProvider(this.settings);
		this.orchestrator = new Orchestrator(
			this.mcpClient,
			llm,
			this.settings
		);
	}

	private async activateChatView(): Promise<void> {
		const existing =
			this.app.workspace.getLeavesOfType(VIEW_TYPE_ZOTERO_CHAT);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_ZOTERO_CHAT,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}
}
