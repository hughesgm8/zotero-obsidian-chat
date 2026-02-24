import { ChildProcess, spawn, execSync } from "child_process";
import { requestUrl } from "obsidian";

function getShellPATH(): string {
	// Obsidian (as a macOS GUI app) doesn't inherit the user's full shell PATH.
	// Attempt to read it from the user's default shell so we can find tools
	// like zotero-mcp that are installed via pip, Homebrew, etc.
	try {
		const shellPath = execSync(
			'zsh -ilc "echo $PATH" 2>/dev/null || bash -ilc "echo $PATH" 2>/dev/null',
			{ encoding: "utf-8", timeout: 5000 }
		).trim();
		if (shellPath) return shellPath;
	} catch {
		// Fall through to manual fallback
	}

	// Manual fallback: common install locations on macOS
	const fallbackDirs = [
		"/usr/local/bin",
		"/opt/homebrew/bin",
		"/Library/Frameworks/Python.framework/Versions/Current/bin",
		"/Library/Frameworks/Python.framework/Versions/3.12/bin",
		"/Library/Frameworks/Python.framework/Versions/3.11/bin",
		`${process.env.HOME}/.local/bin`,
		`${process.env.HOME}/.pyenv/shims`,
	];
	const existing = process.env.PATH || "/usr/bin:/bin";
	return [...fallbackDirs, ...existing.split(":")].join(":");
}

export class MCPServerManager {
	private process: ChildProcess | null = null;
	private executablePath: string;
	private port: number;
	private stderrLog: string[] = [];
	private lastError: string | null = null;
	onUnexpectedExit: (() => void) | null = null;

	constructor(executablePath: string, port: number) {
		this.executablePath = executablePath;
		this.port = port;
	}

	async start(): Promise<void> {
		if (this.process) {
			return;
		}

		this.stderrLog = [];
		this.lastError = null;

		const env = { ...process.env, PATH: getShellPATH() };

		this.process = spawn(
			this.executablePath,
			["serve", "--transport", "streamable-http", "--port", String(this.port)],
			{
				stdio: ["ignore", "pipe", "pipe"],
				detached: false,
				env,
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
			const msg = (err as NodeJS.ErrnoException).code === "ENOENT"
				? `Could not find "${this.executablePath}". Make sure zotero-mcp is installed.`
				: `Failed to start zotero-mcp: ${err.message}`;
			console.error(msg);
			this.lastError = msg;
			this.process = null;
		});

		this.process.on("exit", (code) => {
			console.log(`zotero-mcp exited with code ${code}`);
			this.process = null;
			if (code !== 0 && code !== null) {
				this.lastError = `zotero-mcp exited with code ${code}.`;
				this.onUnexpectedExit?.();
			}
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

	getLastError(): string | null {
		return this.lastError;
	}

	getStderrLog(): string[] {
		return [...this.stderrLog];
	}

	private async waitForReady(timeoutMs = 30000): Promise<void> {
		const start = Date.now();
		const pollInterval = 500;

		while (Date.now() - start < timeoutMs) {
			if (!this.isRunning()) {
				const detail = this.lastError || this.stderrLog.slice(-5).join("\n");
				throw new Error(
					`zotero-mcp failed to start. ${detail}`
				);
			}

			try {
				// Send a GET with the required Accept header but no session ID.
				// The server returns a 400 "Missing session ID" immediately
				// (no hanging SSE stream), which proves it's alive and ready.
				// Using requestUrl here because the GET returns a finite JSON
				// response (not SSE), so it won't hang.
				const resp = await requestUrl({
					url: `${this.getBaseUrl()}/mcp`,
					method: "GET",
					headers: { "Accept": "application/json, text/event-stream" },
					throw: false,
				});
				// Any response (even 400) means the server is up
				if (resp.status > 0) return;
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
