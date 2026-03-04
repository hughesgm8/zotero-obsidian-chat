import * as http from "http";
import * as https from "https";
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
		const url = new URL(`${this.baseUrl}/v1/chat/completions`);
		const transport = url.protocol === "https:" ? https : http;
		const port = url.port
			? parseInt(url.port, 10)
			: url.protocol === "https:"
				? 443
				: 80;

		const body = JSON.stringify({
			model: this.model,
			messages,
			stream: true,
		});

		return new Promise((resolve, reject) => {
			const req = transport.request(
				{
					hostname: url.hostname,
					port,
					path: url.pathname,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
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
								reject(
									new Error(`Ollama ${res.statusCode}: ${msg}`)
								);
							} catch {
								reject(
									new Error(
										`Ollama ${res.statusCode}: ${errBody}`
									)
								);
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
									choices: Array<{
										delta: { content?: string };
									}>;
								};
								const delta =
									parsed.choices?.[0]?.delta?.content;
								if (delta) content += delta;
							} catch {
								// skip malformed chunk
							}
						}
					});

					res.on("end", () => resolve({ content }));

					res.on("error", (err) => {
						if (
							(err as NodeJS.ErrnoException).code !== "ECONNRESET"
						) {
							reject(
								new Error(`Ollama stream error: ${err.message}`)
							);
						}
					});
				}
			);

			req.on("error", (err) => {
				reject(new Error(`Ollama connection error: ${err.message}`));
			});

			req.write(body);
			req.end();
		});
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
