import { requestUrl } from "obsidian";
import type { LLMMessage, LLMProvider, LLMResponse } from "./llm-provider";

export class OpenRouterProvider implements LLMProvider {
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model: string) {
		this.apiKey = apiKey;
		this.model = model;
	}

	async chat(messages: LLMMessage[]): Promise<LLMResponse> {
		const response = await requestUrl({
			url: "https://openrouter.ai/api/v1/chat/completions",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
				"HTTP-Referer": "https://github.com/hughesgm8/zotero-mcp-chat",
				"X-Title": "Zotero MCP Chat",
			},
			body: JSON.stringify({
				model: this.model,
				messages,
				stream: false,
			}),
		});

		const data = response.json as {
			choices: Array<{ message: { content: string } }>;
		};

		return {
			content: data.choices[0]?.message?.content ?? "",
		};
	}

	async testConnection(): Promise<boolean> {
		try {
			const response = await requestUrl({
				url: "https://openrouter.ai/api/v1/models",
				method: "GET",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
				},
			});
			return response.status === 200;
		} catch {
			return false;
		}
	}

	getModelName(): string {
		return this.model;
	}
}
