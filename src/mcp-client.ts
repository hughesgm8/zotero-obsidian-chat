import * as http from "http";

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

export class MCPClient {
	private baseUrl: string;
	private host: string;
	private port: number;
	private sessionId: string | null = null;
	private nextId = 1;
	private initialized = false;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
		const url = new URL(baseUrl);
		this.host = url.hostname;
		this.port = parseInt(url.port, 10) || 80;
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

	private send(
		method: string,
		params: Record<string, unknown>
	): Promise<unknown> {
		return new Promise((resolve, reject) => {
			const body = JSON.stringify({
				jsonrpc: "2.0",
				id: this.nextId++,
				method,
				params,
			});

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				"Accept": "application/json, text/event-stream",
				"Content-Length": String(Buffer.byteLength(body)),
			};

			if (this.sessionId) {
				headers["Mcp-Session-Id"] = this.sessionId;
			}

			const req = http.request(
				{
					hostname: this.host,
					port: this.port,
					path: "/mcp",
					method: "POST",
					headers,
				},
				(res) => {
					// Capture session ID
					const sid = res.headers["mcp-session-id"];
					if (sid && typeof sid === "string") {
						this.sessionId = sid;
					}

					if (res.statusCode && res.statusCode >= 400) {
						let errBody = "";
						res.on("data", (chunk) => {
							errBody += chunk.toString();
						});
						res.on("end", () => {
							reject(
								new Error(
									`MCP request failed (${res.statusCode}): ${errBody}`
								)
							);
						});
						return;
					}

					const contentType = res.headers["content-type"] || "";
					if (contentType.includes("text/event-stream")) {
						// Read SSE stream — get first JSON-RPC data event, then close
						this.readSSEFromStream(res, req, resolve, reject);
					} else {
						// Plain JSON response
						let data = "";
						res.on("data", (chunk) => {
							data += chunk.toString();
						});
						res.on("end", () => {
							try {
								const parsed = JSON.parse(
									data
								) as JsonRpcResponse;
								if (parsed.error) {
									reject(
										new Error(
											`MCP error ${parsed.error.code}: ${parsed.error.message}`
										)
									);
								} else {
									resolve(parsed.result);
								}
							} catch (e) {
								reject(
									new Error(
										`Failed to parse MCP response: ${data.slice(0, 200)}`
									)
								);
							}
						});
					}
				}
			);

			req.on("error", (err) => {
				reject(new Error(`MCP connection error: ${err.message}`));
			});

			req.write(body);
			req.end();
		});
	}

	private readSSEFromStream(
		res: http.IncomingMessage,
		req: http.ClientRequest,
		resolve: (value: unknown) => void,
		reject: (reason: Error) => void
	): void {
		let buffer = "";

		res.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();

			const lines = buffer.split("\n");
			// Keep last potentially incomplete line
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (line.startsWith("data: ")) {
					const data = line.slice(6).trim();
					if (!data) continue;

					try {
						const parsed = JSON.parse(data) as JsonRpcResponse;
						// Got our response — clean up the connection
						res.destroy();
						req.destroy();

						if (parsed.error) {
							reject(
								new Error(
									`MCP error ${parsed.error.code}: ${parsed.error.message}`
								)
							);
						} else {
							resolve(parsed.result);
						}
						return;
					} catch {
						// Not valid JSON, skip
					}
				}
			}
		});

		res.on("error", (err) => {
			// ECONNRESET is expected after we destroy the connection
			if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
				reject(new Error(`SSE stream error: ${err.message}`));
			}
		});

		res.on("end", () => {
			// Stream ended without a response
			resolve(null);
		});
	}

	private sendNotification(
		method: string,
		params: Record<string, unknown>
	): Promise<void> {
		return new Promise((resolve) => {
			const body = JSON.stringify({
				jsonrpc: "2.0",
				method,
				params,
			});

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				"Content-Length": String(Buffer.byteLength(body)),
			};

			if (this.sessionId) {
				headers["Mcp-Session-Id"] = this.sessionId;
			}

			const req = http.request(
				{
					hostname: this.host,
					port: this.port,
					path: "/mcp",
					method: "POST",
					headers,
				},
				(res) => {
					const sid = res.headers["mcp-session-id"];
					if (sid && typeof sid === "string") {
						this.sessionId = sid;
					}
					// Consume and discard the response body
					res.resume();
					res.on("end", () => resolve());
				}
			);

			req.on("error", () => {
				// Notifications are fire-and-forget
				resolve();
			});

			req.write(body);
			req.end();
		});
	}
}
