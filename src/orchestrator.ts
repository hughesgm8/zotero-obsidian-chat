import type { MCPClient } from "./mcp-client";
import type { LLMProvider, LLMMessage } from "./llm/llm-provider";
import type { ChatMessage, ZoteroMCPSettings, ZoteroSource } from "./types";

export interface OrchestratorResult {
	content: string;
	sources: ZoteroSource[];
}

export class Orchestrator {
	private mcpClient: MCPClient;
	private llmProvider: LLMProvider;
	private settings: ZoteroMCPSettings;

	constructor(
		mcpClient: MCPClient,
		llmProvider: LLMProvider,
		settings: ZoteroMCPSettings
	) {
		this.mcpClient = mcpClient;
		this.llmProvider = llmProvider;
		this.settings = settings;
	}

	async query(
		question: string,
		conversationHistory: ChatMessage[]
	): Promise<OrchestratorResult> {
		// 1) Semantic search in Zotero
		const searchResult = await this.mcpClient.callTool(
			"zotero_semantic_search",
			{ query: question }
		);

		// 2) Parse item keys from search results
		const itemKeys = this.extractItemKeys(searchResult);

		// 3) Fetch metadata for each item
		const sources: ZoteroSource[] = [];
		for (const key of itemKeys) {
			try {
				const metadata = await this.mcpClient.callTool(
					"zotero_get_item_metadata",
					{ item_key: key }
				);
				const source = this.parseMetadata(key, metadata);
				if (source) {
					sources.push(source);
				}
			} catch (err) {
				console.warn(`Failed to fetch metadata for ${key}:`, err);
			}
		}

		// 4) Build context string
		const context = this.buildContext(sources, searchResult);

		// 5) Build messages for LLM
		const messages = this.buildMessages(
			question,
			context,
			conversationHistory
		);

		// 6) Send to LLM
		const response = await this.llmProvider.chat(messages);

		return {
			content: response.content,
			sources,
		};
	}

	private extractItemKeys(searchResult: string): string[] {
		const keys: string[] = [];

		// Try to parse as JSON first (array of results)
		try {
			const parsed = JSON.parse(searchResult);
			if (Array.isArray(parsed)) {
				for (const item of parsed) {
					if (item.key) keys.push(item.key as string);
					if (item.itemKey) keys.push(item.itemKey as string);
				}
			}
			if (keys.length > 0) return keys.slice(0, 10);
		} catch {
			// Not JSON, try regex
		}

		// Fallback: extract keys that look like Zotero item keys (8 alphanumeric chars)
		const keyPattern = /\b([A-Z0-9]{8})\b/g;
		let match;
		while ((match = keyPattern.exec(searchResult)) !== null) {
			if (!keys.includes(match[1])) {
				keys.push(match[1]);
			}
		}

		return keys.slice(0, 10);
	}

	private parseMetadata(
		key: string,
		metadataStr: string
	): ZoteroSource | null {
		try {
			const data = JSON.parse(metadataStr);
			return {
				key,
				title: data.title || "Untitled",
				authors: this.formatAuthors(data.creators || data.authors),
				year: data.date
					? String(data.date).slice(0, 4)
					: data.year
						? String(data.year)
						: "n.d.",
				itemType: data.itemType || "unknown",
				abstract: data.abstractNote || data.abstract,
			};
		} catch {
			// If not JSON, try to extract from plain text
			return {
				key,
				title: metadataStr.slice(0, 100),
				authors: "",
				year: "n.d.",
				itemType: "unknown",
			};
		}
	}

	private formatAuthors(
		creators: Array<{ firstName?: string; lastName?: string; name?: string }> | undefined
	): string {
		if (!creators || !Array.isArray(creators)) return "";
		return creators
			.map((c) => {
				if (c.name) return c.name;
				if (c.lastName && c.firstName)
					return `${c.lastName}, ${c.firstName}`;
				return c.lastName || c.firstName || "";
			})
			.filter(Boolean)
			.join("; ");
	}

	private buildContext(
		sources: ZoteroSource[],
		rawSearchResult: string
	): string {
		if (sources.length === 0) {
			return `Search results (no structured metadata available):\n${rawSearchResult}`;
		}

		const parts = sources.map((s, i) => {
			let entry = `[${i + 1}] ${s.title}\n   Authors: ${s.authors || "Unknown"}\n   Year: ${s.year}\n   Type: ${s.itemType}`;
			if (s.abstract) {
				entry += `\n   Abstract: ${s.abstract}`;
			}
			return entry;
		});

		return `Papers from the user's Zotero library:\n\n${parts.join("\n\n")}`;
	}

	private buildMessages(
		question: string,
		context: string,
		history: ChatMessage[]
	): LLMMessage[] {
		const messages: LLMMessage[] = [
			{
				role: "system",
				content: this.settings.systemPrompt,
			},
		];

		// Add truncated conversation history
		const recentHistory = history.slice(-this.settings.maxConversationHistory);
		for (const msg of recentHistory) {
			messages.push({
				role: msg.role,
				content: msg.content,
			});
		}

		// Add current question with Zotero context
		messages.push({
			role: "user",
			content: `Context from Zotero library:\n\n${context}\n\n---\n\nQuestion: ${question}`,
		});

		return messages;
	}
}
