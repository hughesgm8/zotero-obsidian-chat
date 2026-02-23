import {
	ItemView,
	MarkdownRenderer,
	Notice,
	WorkspaceLeaf,
	setIcon,
} from "obsidian";
import type ZoteroMCPChatPlugin from "./main";
import type { ChatMessage } from "./types";

export const VIEW_TYPE_ZOTERO_CHAT = "zotero-mcp-chat-view";

export class ZoteroChatView extends ItemView {
	plugin: ZoteroMCPChatPlugin;
	private messages: ChatMessage[] = [];
	private messageListEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtnEl!: HTMLButtonElement;
	private statusEl!: HTMLElement;
	private isLoading = false;

	constructor(leaf: WorkspaceLeaf, plugin: ZoteroMCPChatPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ZOTERO_CHAT;
	}

	getDisplayText(): string {
		return "Zotero Chat";
	}

	getIcon(): string {
		return "book-open";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("zotero-chat-container");

		// Header with status and clear button
		const header = container.createDiv({ cls: "zotero-chat-header" });

		const statusWrapper = header.createDiv({
			cls: "zotero-chat-status-wrapper",
		});
		this.statusEl = statusWrapper.createSpan({
			cls: "zotero-chat-status-dot",
		});
		statusWrapper.createSpan({
			text: "Zotero Chat",
			cls: "zotero-chat-status-text",
		});

		const clearBtn = header.createEl("button", {
			cls: "zotero-chat-clear-btn clickable-icon",
			attr: { "aria-label": "Clear chat" },
		});
		setIcon(clearBtn, "trash-2");
		clearBtn.addEventListener("click", () => this.clearChat());

		// Message list
		this.messageListEl = container.createDiv({
			cls: "zotero-chat-messages",
		});

		// Welcome message
		this.renderWelcome();

		// Input area
		const inputArea = container.createDiv({
			cls: "zotero-chat-input-area",
		});

		this.inputEl = inputArea.createEl("textarea", {
			cls: "zotero-chat-input",
			attr: {
				placeholder: "Ask about your Zotero library...",
				rows: "2",
			},
		});

		this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.handleSend();
			}
		});

		this.sendBtnEl = inputArea.createEl("button", {
			cls: "zotero-chat-send-btn",
			text: "Send",
		});
		this.sendBtnEl.addEventListener("click", () => this.handleSend());

		this.updateStatus();
	}

	async onClose(): Promise<void> {
		// Nothing to clean up
	}

	private renderWelcome(): void {
		const welcome = this.messageListEl.createDiv({
			cls: "zotero-chat-welcome",
		});
		welcome.createEl("p", {
			text: "Ask questions about papers in your Zotero library. The plugin will search your library and provide cited answers.",
		});
	}

	private async handleSend(): Promise<void> {
		const question = this.inputEl.value.trim();
		if (!question || this.isLoading) return;

		this.inputEl.value = "";
		this.setLoading(true);

		// Add user message
		const userMsg: ChatMessage = {
			role: "user",
			content: question,
			timestamp: Date.now(),
		};
		this.messages.push(userMsg);
		this.renderMessage(userMsg);
		this.scrollToBottom();

		try {
			const orchestrator = this.plugin.getOrchestrator();
			if (!orchestrator) {
				throw new Error(
					"Plugin not ready. Check that the MCP server is running."
				);
			}

			const result = await orchestrator.query(question, this.messages.slice(0, -1));

			const assistantMsg: ChatMessage = {
				role: "assistant",
				content: result.content,
				sources: result.sources,
				timestamp: Date.now(),
			};
			this.messages.push(assistantMsg);
			this.renderMessage(assistantMsg);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			const assistantMsg: ChatMessage = {
				role: "assistant",
				content: `**Error:** ${errorMsg}`,
				timestamp: Date.now(),
			};
			this.messages.push(assistantMsg);
			this.renderMessage(assistantMsg);
		}

		this.setLoading(false);
		this.scrollToBottom();
	}

	private renderMessage(msg: ChatMessage): void {
		const wrapper = this.messageListEl.createDiv({
			cls: `zotero-chat-message zotero-chat-message-${msg.role}`,
		});

		const contentEl = wrapper.createDiv({
			cls: "zotero-chat-message-content",
		});

		if (msg.role === "assistant") {
			// Render markdown for assistant messages
			MarkdownRenderer.render(
				this.app,
				msg.content,
				contentEl,
				"",
				this
			);

			// Sources list
			if (msg.sources && msg.sources.length > 0) {
				const sourcesEl = wrapper.createDiv({
					cls: "zotero-chat-sources",
				});
				sourcesEl.createEl("strong", { text: "Sources:" });
				const list = sourcesEl.createEl("ul");
				for (const src of msg.sources) {
					const li = list.createEl("li");
					li.createEl("span", {
						text: `${src.title} — ${src.authors || "Unknown"} (${src.year})`,
					});
				}
			}

			// Copy button
			const actions = wrapper.createDiv({
				cls: "zotero-chat-message-actions",
			});
			const copyBtn = actions.createEl("button", {
				cls: "zotero-chat-copy-btn clickable-icon",
				attr: { "aria-label": "Copy response" },
			});
			setIcon(copyBtn, "copy");
			copyBtn.addEventListener("click", () => {
				navigator.clipboard.writeText(msg.content);
				new Notice("Copied to clipboard");
			});
		} else {
			// Plain text for user messages
			contentEl.setText(msg.content);
		}
	}

	private clearChat(): void {
		this.messages = [];
		this.messageListEl.empty();
		this.renderWelcome();
	}

	private setLoading(loading: boolean): void {
		this.isLoading = loading;
		this.sendBtnEl.disabled = loading;
		this.inputEl.disabled = loading;

		if (loading) {
			this.sendBtnEl.setText("...");
			// Add loading indicator
			const loadingEl = this.messageListEl.createDiv({
				cls: "zotero-chat-loading",
			});
			loadingEl.createSpan({ text: "Searching library and thinking..." });
		} else {
			this.sendBtnEl.setText("Send");
			// Remove loading indicator
			const loadingEl =
				this.messageListEl.querySelector(".zotero-chat-loading");
			loadingEl?.remove();
		}

		this.updateStatus();
	}

	private updateStatus(): void {
		if (!this.statusEl) return;

		const mcpRunning = this.plugin.isMCPRunning();
		this.statusEl.removeClass(
			"status-green",
			"status-yellow",
			"status-red"
		);

		if (this.isLoading) {
			this.statusEl.addClass("status-yellow");
		} else if (mcpRunning) {
			this.statusEl.addClass("status-green");
		} else {
			this.statusEl.addClass("status-red");
		}
	}

	private scrollToBottom(): void {
		this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
	}
}
