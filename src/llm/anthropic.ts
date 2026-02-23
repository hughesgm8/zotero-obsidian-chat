import { requestUrl } from "obsidian";
import type { LLMMessage, LLMProvider, LLMResponse } from "./llm-provider";

export class AnthropicProvider implements LLMProvider {
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model: string) {
		this.apiKey = apiKey;
		this.model = model;
	}

	async chat(messages: LLMMessage[]): Promise<LLMResponse> {
		// Separate system message from conversation messages
		const systemMessage = messages.find((m) => m.role === "system");
		const conversationMessages = messages
			.filter((m) => m.role !== "system")
			.map((m) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			}));

		const body: Record<string, unknown> = {
			model: this.model,
			max_tokens: 4096,
			messages: conversationMessages,
		};

		if (systemMessage) {
			body.system = systemMessage.content;
		}

		const response = await requestUrl({
			url: "https://api.anthropic.com/v1/messages",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.apiKey,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify(body),
		});

		const data = response.json as {
			content: Array<{ type: string; text?: string }>;
		};

		const text = data.content
			.filter((c) => c.type === "text" && c.text)
			.map((c) => c.text)
			.join("");

		return { content: text };
	}

	async testConnection(): Promise<boolean> {
		try {
			// Send a minimal request to check the API key
			const response = await requestUrl({
				url: "https://api.anthropic.com/v1/messages",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.apiKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model: this.model,
					max_tokens: 1,
					messages: [{ role: "user", content: "hi" }],
				}),
				throw: false,
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
