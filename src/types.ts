export type LLMProviderType = "ollama" | "openrouter" | "anthropic";

export interface ZoteroMCPSettings {
	// MCP Server
	mcpExecutablePath: string;
	mcpServerPort: number;

	// LLM Provider
	llmProvider: LLMProviderType;

	// Ollama
	ollamaBaseUrl: string;
	ollamaModel: string;

	// OpenRouter
	openrouterApiKey: string;
	openrouterModel: string;

	// Anthropic
	anthropicApiKey: string;
	anthropicModel: string;

	// Behavior
	maxConversationHistory: number;
	systemPrompt: string;
	fullTextTopN: number;
	fullTextMaxChars: number;
}

export const DEFAULT_SETTINGS: ZoteroMCPSettings = {
	mcpExecutablePath: "zotero-mcp",
	mcpServerPort: 8000,

	llmProvider: "ollama",

	ollamaBaseUrl: "http://localhost:11434",
	ollamaModel: "deepseek-r1:8b",

	openrouterApiKey: "",
	openrouterModel: "deepseek/deepseek-r1",

	anthropicApiKey: "",
	anthropicModel: "claude-sonnet-4-5-20250929",

	maxConversationHistory: 6,
	fullTextTopN: 3,
	fullTextMaxChars: 4000,
	systemPrompt:
		"You are a research assistant with access to the user's Zotero library. " +
		"Answer questions using the provided paper metadata and context. " +
		"Always cite sources by title and author when referencing specific papers. " +
		"If no relevant papers are found, say so honestly.",
};

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	sources?: ZoteroSource[];
	timestamp: number;
}

export interface ZoteroSource {
	key: string;
	title: string;
	authors: string;
	year: string;
	itemType: string;
	abstract?: string;
}
