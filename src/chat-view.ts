import {
	ItemView,
	MarkdownRenderer,
	Notice,
	TFile,
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
	private attachedNote: { name: string; path: string; content: string } | null = null;
	private attachmentChipEl!: HTMLElement;
	private sizeObserver: ResizeObserver | null = null;

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

		const headerActions = header.createDiv({
			cls: "zotero-chat-header-actions",
		});

		const saveBtn = headerActions.createEl("button", {
			cls: "zotero-chat-save-btn clickable-icon",
			attr: { "aria-label": "Save conversation" },
		});
		setIcon(saveBtn, "save");
		saveBtn.addEventListener("click", () => this.saveConversation());

		const clearBtn = headerActions.createEl("button", {
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

		this.attachmentChipEl = inputArea.createDiv({
			cls: "zotero-chat-attachment-chip-area",
		});
		this.attachmentChipEl.style.display = "none";

		const inputRow = inputArea.createDiv({
			cls: "zotero-chat-input-row",
		});

		const paperclipBtn = inputRow.createEl("button", {
			cls: "zotero-chat-paperclip-btn clickable-icon",
			attr: { "aria-label": "Attach current note as context" },
		});
		setIcon(paperclipBtn, "paperclip");
		paperclipBtn.addEventListener("click", () => this.attachActiveNote());

		this.inputEl = inputRow.createEl("textarea", {
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

		this.sendBtnEl = inputRow.createEl("button", {
			cls: "zotero-chat-send-btn",
			text: "Send",
		});
		this.sendBtnEl.addEventListener("click", () => this.handleSend());

		this.updateStatus();

		// Obsidian may not have finalised sidebar dimensions when onOpen() runs,
		// so height:100% on the container resolves to 0 until a layout pass
		// completes. Watch for the panel getting its real size, then trigger a
		// workspace resize once — this is the same event that fixes it when the
		// server connects, just fired at the right moment instead of 30s later.
		const panelEl = this.containerEl.children[1] as HTMLElement;
		this.sizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				if (entry.contentRect.height > 0) {
					this.sizeObserver?.disconnect();
					this.sizeObserver = null;
					this.app.workspace.trigger("resize");
					break;
				}
			}
		});
		this.sizeObserver.observe(panelEl);
	}

	async onClose(): Promise<void> {
		this.sizeObserver?.disconnect();
		this.sizeObserver = null;
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
		const rawQuestion = this.inputEl.value.trim();
		if (!rawQuestion || this.isLoading) return;

		this.inputEl.value = "";
		this.setLoading(true);

		// The raw question is used for semantic search.
		// The attached note is passed separately so it only reaches the LLM, not the search query.

		// Store only the user's visible question (not the full context blob).
		// attachedNotePath is recorded for the save feature.
		const userMsg: ChatMessage & { attachedNotePath?: string } = {
			role: "user",
			content: rawQuestion,
			timestamp: Date.now(),
			...(this.attachedNote
				? { attachedNotePath: this.attachedNote.path }
				: {}),
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

			const result = await orchestrator.query(
			rawQuestion,
			this.messages.slice(0, -1),
			this.attachedNote ?? undefined
		);

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

	updateStatus(): void {
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

	private async saveConversation(): Promise<void> {
		const userMessages = this.messages.filter((m) => m.role === "user");
		if (userMessages.length === 0) {
			new Notice("Nothing to save yet");
			return;
		}

		const now = new Date();
		const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
		const timeStr = now.toTimeString().slice(0, 8);  // HH:MM:SS
		const fileSafeTime = timeStr.replace(/:/g, "-"); // HH-MM-SS

		const firstUserMsg = userMessages[0].content;
		const sanitized = firstUserMsg
			.slice(0, 40)
			.replace(/[\\/:*?"<>|#^[\]]/g, "")
			.trim();

		const folderRoot = (this.plugin.settings.saveFolder || "Zotero Chats").trim();
		const dateFolder = `${folderRoot}/${dateStr}`;
		const filename = `${fileSafeTime} - ${sanitized}.md`;
		const fullPath = `${dateFolder}/${filename}`;

		if (!this.app.vault.getAbstractFileByPath(folderRoot)) {
			await this.app.vault.createFolder(folderRoot);
		}
		if (!this.app.vault.getAbstractFileByPath(dateFolder)) {
			await this.app.vault.createFolder(dateFolder);
		}

		const title = firstUserMsg.slice(0, 60);
		const savedAt = `${dateStr} at ${timeStr}`;

		let md = `---\ndate: ${dateStr}\ntags: [zotero-chat]\n---\n\n`;
		md += `# ${title}\n\n`;
		md += `*Saved: ${savedAt}*\n\n---\n\n`;

		for (const msg of this.messages) {
			if (msg.role === "user") {
				md += `**You:** ${msg.content}\n`;
				const attachedPath = (msg as ChatMessage & { attachedNotePath?: string }).attachedNotePath;
				if (attachedPath) {
					md += `\n*📎 Attached: [[${attachedPath}]]*\n`;
				}
				md += "\n";
			} else {
				md += `**Zotero Assistant:** ${msg.content}\n`;
				if (msg.sources && msg.sources.length > 0) {
					md += "\n**Sources:**\n";
					for (const src of msg.sources) {
						md += `- ${src.title} — ${src.authors || "Unknown"} (${src.year})\n`;
					}
				}
				md += "\n---\n\n";
			}
		}

		await this.app.vault.create(fullPath, md);
		new Notice(`Saved to ${fullPath}`);
	}

	private async attachActiveNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile)) {
			new Notice("No note is currently open. Open a note first.");
			return;
		}

		const content = await this.app.vault.read(file);
		this.attachedNote = { name: file.basename, path: file.path, content };
		this.renderAttachmentChip();
	}

	private renderAttachmentChip(): void {
		if (!this.attachedNote) return;
		this.attachmentChipEl.empty();
		this.attachmentChipEl.style.display = "flex";

		const chip = this.attachmentChipEl.createDiv({
			cls: "zotero-chat-attachment-chip",
		});
		chip.createSpan({ text: `📎 ${this.attachedNote.name}` });

		const removeBtn = chip.createEl("button", {
			cls: "zotero-chat-attachment-remove clickable-icon",
			attr: { "aria-label": "Remove attachment" },
		});
		setIcon(removeBtn, "x");
		removeBtn.addEventListener("click", () => this.removeAttachment());
	}

	private removeAttachment(): void {
		this.attachedNote = null;
		this.attachmentChipEl.style.display = "none";
		this.attachmentChipEl.empty();
	}
}
