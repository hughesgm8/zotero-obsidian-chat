import { requestUrl } from "obsidian";

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: Record<string, unknown>;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

export class MCPClient {
	private baseUrl: string;
	private sessionId: string | null = null;
	private nextId = 1;
	private initialized = false;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		const result = await this.send("initialize", {
			protocolVersion: "2025-03-26",
			capabilities: {},
			clientInfo: {
				name: "zotero-mcp-chat",
				version: "0.1.0",
			},
		});

		if (!result) {
			throw new Error("MCP initialize returned no result");
		}

		// Send initialized notification
		await this.sendNotification("notifications/initialized", {});
		this.initialized = true;
	}

	async listTools(): Promise<unknown[]> {
		const result = (await this.send("tools/list", {})) as {
			tools: unknown[];
		};
		return result?.tools ?? [];
	}

	async callTool(
		name: string,
		args: Record<string, unknown>
	): Promise<string> {
		const result = (await this.send("tools/call", {
			name,
			arguments: args,
		})) as {
			content?: Array<{ type: string; text?: string }>;
		};

		if (!result?.content) return "";

		return result.content
			.filter((c) => c.type === "text" && c.text)
			.map((c) => c.text)
			.join("\n");
	}

	async close(): Promise<void> {
		this.initialized = false;
		this.sessionId = null;
	}

	private async send(
		method: string,
		params: Record<string, unknown>
	): Promise<unknown> {
		const request: JsonRpcRequest = {
			jsonrpc: "2.0",
			id: this.nextId++,
			method,
			params,
		};

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
		};

		if (this.sessionId) {
			headers["Mcp-Session-Id"] = this.sessionId;
		}

		const response = await requestUrl({
			url: `${this.baseUrl}/mcp`,
			method: "POST",
			headers,
			body: JSON.stringify(request),
			throw: false,
		});

		if (response.status >= 400) {
			throw new Error(
				`MCP request failed (${response.status}): ${response.text}`
			);
		}

		// Capture session ID from response headers
		const newSessionId = response.headers["mcp-session-id"];
		if (newSessionId) {
			this.sessionId = newSessionId;
		}

		// Handle SSE response (text/event-stream)
		const contentType = response.headers["content-type"] || "";
		if (contentType.includes("text/event-stream")) {
			return this.parseSSE(response.text);
		}

		// Handle JSON response
		const jsonResp = response.json as JsonRpcResponse;
		if (jsonResp.error) {
			throw new Error(
				`MCP error ${jsonResp.error.code}: ${jsonResp.error.message}`
			);
		}

		return jsonResp.result;
	}

	private parseSSE(text: string): unknown {
		// Parse Server-Sent Events to extract JSON-RPC response
		const lines = text.split("\n");
		for (const line of lines) {
			if (line.startsWith("data: ")) {
				const data = line.slice(6).trim();
				if (!data) continue;
				try {
					const parsed = JSON.parse(data) as JsonRpcResponse;
					if (parsed.error) {
						throw new Error(
							`MCP error ${parsed.error.code}: ${parsed.error.message}`
						);
					}
					return parsed.result;
				} catch (e) {
					if (e instanceof Error && e.message.startsWith("MCP error")) {
						throw e;
					}
					// Not valid JSON, skip
				}
			}
		}
		return null;
	}

	private async sendNotification(
		method: string,
		params: Record<string, unknown>
	): Promise<void> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (this.sessionId) {
			headers["Mcp-Session-Id"] = this.sessionId;
		}

		// Notifications have no id
		await requestUrl({
			url: `${this.baseUrl}/mcp`,
			method: "POST",
			headers,
			body: JSON.stringify({
				jsonrpc: "2.0",
				method,
				params,
			}),
			throw: false,
		});
	}
}
