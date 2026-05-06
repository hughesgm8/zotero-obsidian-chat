import * as https from "https";
import { requestUrl } from "obsidian";
import type { LLMMessage, LLMProvider, LLMResponse } from "./llm-provider";

const ENDPOINT_HOST = "generativelanguage.googleapis.com";
const ENDPOINT_PATH = "/v1beta/openai/chat/completions";

export class GeminiProvider implements LLMProvider {
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model: string) {
		this.apiKey = apiKey;
		this.model = model;
	}

	async chat(messages: LLMMessage[]): Promise<LLMResponse> {
		const body = JSON.stringify({
			model: this.model,
			messages,
			stream: true,
		});

		return new Promise((resolve, reject) => {
			const req = https.request(
				{
					hostname: ENDPOINT_HOST,
					port: 443,
					path: ENDPOINT_PATH,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${this.apiKey}`,
						"Content-Length": Buffer.byteLength(body),
					},
				},
				(res) => {
					if (res.statusCode && res.statusCode >= 400) {
						let errBody = "";
						res.on("data", (chunk: Buffer) => {
							errBody += chunk.toString();
						});
						res.on("end", () => {
							try {
								const err = JSON.parse(errBody) as {
									error?: string | { message?: string };
								};
								const msg =
									typeof err.error === "string"
										? err.error
										: err.error?.message ?? errBody;
								reject(new Error(`Gemini ${res.statusCode}: ${msg}`));
							} catch {
								reject(new Error(`Gemini ${res.statusCode}: ${errBody}`));
							}
						});
						return;
					}

					let content = "";
					let buffer = "";

					res.on("data", (chunk: Buffer) => {
						buffer += chunk.toString();
						const lines = buffer.split("\n");
						buffer = lines.pop() ?? "";

						for (const line of lines) {
							if (!line.startsWith("data: ")) continue;
							const data = line.slice(6).trim();
							if (data === "[DONE]") continue;
							try {
								const parsed = JSON.parse(data) as {
									choices: Array<{ delta: { content?: string } }>;
								};
								const delta = parsed.choices?.[0]?.delta?.content;
								if (delta) content += delta;
							} catch {
								// skip malformed chunk
							}
						}
					});

					res.on("end", () => resolve({ content }));

					res.on("error", (err) => {
						if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
							reject(new Error(`Gemini stream error: ${err.message}`));
						}
					});
				}
			);

			req.on("error", (err) => {
				reject(new Error(`Gemini connection error: ${err.message}`));
			});

			req.write(body);
			req.end();
		});
	}

	async testConnection(): Promise<boolean> {
		try {
			const response = await requestUrl({
				url: `https://${ENDPOINT_HOST}/v1beta/openai/models`,
				method: "GET",
				headers: {
					"Authorization": `Bearer ${this.apiKey}`,
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
