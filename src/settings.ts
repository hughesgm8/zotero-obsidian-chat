import { App, PluginSettingTab, Setting } from "obsidian";
import type ZoteroMCPChatPlugin from "./main";
import type { LLMProviderType } from "./types";

export class ZoteroMCPSettingTab extends PluginSettingTab {
	plugin: ZoteroMCPChatPlugin;

	constructor(app: App, plugin: ZoteroMCPChatPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// --- MCP Server Section ---
		containerEl.createEl("h2", { text: "MCP Server" });

		new Setting(containerEl)
			.setName("zotero-mcp executable path")
			.setDesc(
				'Path to the zotero-mcp binary. Use "zotero-mcp" if it\'s in your PATH.'
			)
			.addText((text) =>
				text
					.setPlaceholder("zotero-mcp")
					.setValue(this.plugin.settings.mcpExecutablePath)
					.onChange(async (value) => {
						this.plugin.settings.mcpExecutablePath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Server port")
			.setDesc("Port for the MCP HTTP server.")
			.addText((text) =>
				text
					.setPlaceholder("8000")
					.setValue(String(this.plugin.settings.mcpServerPort))
					.onChange(async (value) => {
						const port = parseInt(value, 10);
						if (!isNaN(port) && port > 0 && port < 65536) {
							this.plugin.settings.mcpServerPort = port;
							await this.plugin.saveSettings();
						}
					})
			);

		// --- LLM Provider Section ---
		containerEl.createEl("h2", { text: "LLM Provider" });

		new Setting(containerEl)
			.setName("Provider")
			.setDesc("Choose your LLM provider.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("ollama", "Ollama (Local)")
					.addOption("openrouter", "OpenRouter")
					.addOption("anthropic", "Anthropic (Claude API)")
					.setValue(this.plugin.settings.llmProvider)
					.onChange(async (value) => {
						this.plugin.settings.llmProvider =
							value as LLMProviderType;
						await this.plugin.saveSettings();
						this.display(); // Re-render to show/hide provider fields
					})
			);

		const provider = this.plugin.settings.llmProvider;

		if (provider === "ollama") {
			new Setting(containerEl)
				.setName("Ollama base URL")
				.setDesc("URL where Ollama is running.")
				.addText((text) =>
					text
						.setPlaceholder("http://localhost:11434")
						.setValue(this.plugin.settings.ollamaBaseUrl)
						.onChange(async (value) => {
							this.plugin.settings.ollamaBaseUrl = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Model")
				.setDesc("Ollama model name (e.g., deepseek-r1:8b).")
				.addText((text) =>
					text
						.setPlaceholder("deepseek-r1:8b")
						.setValue(this.plugin.settings.ollamaModel)
						.onChange(async (value) => {
							this.plugin.settings.ollamaModel = value;
							await this.plugin.saveSettings();
						})
				);
		}

		if (provider === "openrouter") {
			new Setting(containerEl)
				.setName("API key")
				.setDesc("Your OpenRouter API key.")
				.addText((text) =>
					text
						.setPlaceholder("sk-or-...")
						.setValue(this.plugin.settings.openrouterApiKey)
						.onChange(async (value) => {
							this.plugin.settings.openrouterApiKey = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Model")
				.setDesc("OpenRouter model ID.")
				.addText((text) =>
					text
						.setPlaceholder("deepseek/deepseek-r1")
						.setValue(this.plugin.settings.openrouterModel)
						.onChange(async (value) => {
							this.plugin.settings.openrouterModel = value;
							await this.plugin.saveSettings();
						})
				);
		}

		if (provider === "anthropic") {
			new Setting(containerEl)
				.setName("API key")
				.setDesc("Your Anthropic API key.")
				.addText((text) =>
					text
						.setPlaceholder("sk-ant-...")
						.setValue(this.plugin.settings.anthropicApiKey)
						.onChange(async (value) => {
							this.plugin.settings.anthropicApiKey = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Model")
				.setDesc("Anthropic model ID.")
				.addText((text) =>
					text
						.setPlaceholder("claude-sonnet-4-5-20250929")
						.setValue(this.plugin.settings.anthropicModel)
						.onChange(async (value) => {
							this.plugin.settings.anthropicModel = value;
							await this.plugin.saveSettings();
						})
				);
		}

		// --- Behavior Section ---
		containerEl.createEl("h2", { text: "Behavior" });

		new Setting(containerEl)
			.setName("Conversation history length")
			.setDesc(
				"Number of past messages to include as context (higher = more token usage)."
			)
			.addSlider((slider) =>
				slider
					.setLimits(2, 20, 2)
					.setValue(this.plugin.settings.maxConversationHistory)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.maxConversationHistory = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("System prompt")
			.setDesc("Instructions given to the LLM for every conversation.")
			.addTextArea((text) =>
				text
					.setPlaceholder("You are a research assistant...")
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.systemPrompt = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
