import { ChildProcess, spawn } from "child_process";
import { requestUrl } from "obsidian";

export class MCPServerManager {
	private process: ChildProcess | null = null;
	private executablePath: string;
	private port: number;
	private stderrLog: string[] = [];

	constructor(executablePath: string, port: number) {
		this.executablePath = executablePath;
		this.port = port;
	}

	async start(): Promise<void> {
		if (this.process) {
			return;
		}

		this.stderrLog = [];

		this.process = spawn(
			this.executablePath,
			["serve", "--transport", "streamable-http", "--port", String(this.port)],
			{
				stdio: ["ignore", "pipe", "pipe"],
				detached: false,
			}
		);

		this.process.stderr?.on("data", (data: Buffer) => {
			const line = data.toString().trim();
			if (line) {
				this.stderrLog.push(line);
				// Keep only last 50 lines
				if (this.stderrLog.length > 50) {
					this.stderrLog.shift();
				}
			}
		});

		this.process.on("error", (err) => {
			console.error("zotero-mcp process error:", err);
			this.process = null;
		});

		this.process.on("exit", (code) => {
			console.log(`zotero-mcp exited with code ${code}`);
			this.process = null;
		});

		// Wait for the server to be ready
		await this.waitForReady();
	}

	stop(): void {
		if (this.process) {
			this.process.kill("SIGTERM");
			this.process = null;
		}
	}

	isRunning(): boolean {
		return this.process !== null && this.process.exitCode === null;
	}

	getBaseUrl(): string {
		return `http://127.0.0.1:${this.port}`;
	}

	getStderrLog(): string[] {
		return [...this.stderrLog];
	}

	private async waitForReady(timeoutMs = 15000): Promise<void> {
		const start = Date.now();
		const pollInterval = 500;

		while (Date.now() - start < timeoutMs) {
			if (!this.isRunning()) {
				const lastErr = this.stderrLog.slice(-5).join("\n");
				throw new Error(
					`zotero-mcp process exited unexpectedly.\n${lastErr}`
				);
			}

			try {
				await requestUrl({
					url: `${this.getBaseUrl()}/mcp`,
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 0,
						method: "initialize",
						params: {
							protocolVersion: "2025-03-26",
							capabilities: {},
							clientInfo: {
								name: "zotero-mcp-chat-probe",
								version: "0.1.0",
							},
						},
					}),
				});
				// Server responded — it's ready
				return;
			} catch {
				// Not ready yet, wait and retry
				await new Promise((resolve) => setTimeout(resolve, pollInterval));
			}
		}

		throw new Error(
			`zotero-mcp did not become ready within ${timeoutMs / 1000}s`
		);
	}
}
