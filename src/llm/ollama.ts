import { requestUrl } from "obsidian";
import type { LLMMessage, LLMProvider, LLMResponse } from "./llm-provider";

export class OllamaProvider implements LLMProvider {
	private baseUrl: string;
	private model: string;

	constructor(baseUrl: string, model: string) {
		this.baseUrl = baseUrl.replace(/\/$/, "");
		this.model = model;
	}

	async chat(messages: LLMMessage[]): Promise<LLMResponse> {
		const response = await requestUrl({
			url: `${this.baseUrl}/v1/chat/completions`,
			method: "POST",
			headers: { "Content-Type": "application/json" },
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
				url: `${this.baseUrl}/api/tags`,
				method: "GET",
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
