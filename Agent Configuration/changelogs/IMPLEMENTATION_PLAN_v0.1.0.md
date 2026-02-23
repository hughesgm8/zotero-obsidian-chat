# Obsidian Zotero MCP Chat Plugin — Implementation Plan

## Context

Gabriel wants to query his Zotero library from within Obsidian using natural language. He already has the `zotero-mcp` server working with Claude Desktop. This plugin will automatically start zotero-mcp as a background process, communicate with it over HTTP, retrieve relevant papers, send the context to a configurable LLM, and display cited responses in a sidebar chat panel (modeled after Obsidian Copilot).

**Server lifecycle:** The plugin spawns `zotero-mcp serve --transport streamable-http` as a child process on load and kills it on unload. The user never needs to manually start the server. Since Obsidian runs on Electron with full Node.js access, `child_process.spawn()` is available. Settings include the path to the `zotero-mcp` executable (auto-detected from PATH by default).

The plugin orchestrates MCP tool calls deterministically (search → fetch metadata → send to LLM) rather than letting the LLM choose tools. This is intentional — local models like DeepSeek via Ollama often fail at tool-calling, and a fixed pipeline is more reliable for MVP.

---

## Step 1: Project Scaffolding

**Goal:** Obsidian recognizes and loads the plugin. "Hello world" in the dev console.

Create these files based on the official Obsidian sample plugin template:

| File | Purpose |
|------|---------|
| `manifest.json` | Plugin ID, name, version, `minAppVersion: "0.15.0"`, `isDesktopOnly: true`, author: `hughesgm8` |
| `package.json` | `type: "module"`, deps: `obsidian`, devDeps: `esbuild`, `typescript`, `tslib`, `@types/node` |
| `tsconfig.json` | `baseUrl: "src"`, strict null checks, `isolatedModules`, target ES6 |
| `esbuild.config.mjs` | Bundles `src/main.ts` → `main.js` (CJS), externalizes `obsidian`/`electron`/codemirror/builtins |
| `versions.json` | `{ "0.1.0": "0.15.0" }` |
| `styles.css` | Empty placeholder |
| `src/main.ts` | Minimal `Plugin` subclass with `onload()` console log |

**Test:** `npm install && npm run dev`, symlink into vault, enable plugin, check console.

---

## Step 2: Settings Infrastructure

**Goal:** Users can configure MCP server settings, LLM provider, API keys, and model selection.

| File | Purpose |
|------|---------|
| `src/types.ts` | `ZoteroMCPSettings` interface, `DEFAULT_SETTINGS`, `ChatMessage`, `ZoteroSource` types |
| `src/settings.ts` | `PluginSettingTab` with sections for MCP server (executable path, port), LLM provider (dropdown: Ollama/OpenRouter/Claude API), and behavior settings. Re-renders on provider change to show/hide relevant fields. |
| `src/main.ts` | Add `loadSettings()` / `saveSettings()`, register settings tab |

**Defaults:** Ollama at `localhost:11434` with `deepseek-r1:8b`, zotero-mcp executable auto-detected from PATH, server port `8000`.

**Test:** Open Settings → Zotero MCP Chat, change values, restart, verify persistence.

---

## Step 3: MCP Server Manager + Client

**Goal:** Auto-start zotero-mcp as a child process and connect to it over HTTP.

| File | Purpose |
|------|---------|
| `src/mcp-server.ts` | Manages the zotero-mcp child process lifecycle. Uses `child_process.spawn()` to start `zotero-mcp serve --transport streamable-http --port <port>`. Polls the HTTP endpoint until the server is ready. Kills the process on `stop()`. Captures stderr for error reporting. |
| `src/mcp-client.ts` | Minimal MCP client using `requestUrl` (Obsidian's CORS-free HTTP). Implements JSON-RPC 2.0: `initialize` → `notifications/initialized` → `tools/call`. Tracks session ID via `Mcp-Session-Id` header. |

Why not the MCP TypeScript SDK: It depends on Node.js HTTP modules that don't work in Obsidian's Electron renderer. The protocol over HTTP is just JSON-RPC POSTs, simple enough to implement directly.

**Test:** Temporary command that starts the server, calls `listTools()`, and logs results to console.

---

## Step 4: LLM Provider Abstraction

**Goal:** Unified interface for Ollama, OpenRouter, and Claude API.

| File | Purpose |
|------|---------|
| `src/llm/llm-provider.ts` | `LLMProvider` interface: `chat()`, `testConnection()`, `getModelName()` |
| `src/llm/ollama.ts` | Uses `/v1/chat/completions` (OpenAI-compatible endpoint) |
| `src/llm/openrouter.ts` | Same format as Ollama, different base URL + auth header |
| `src/llm/anthropic.ts` | Uses Messages API (`/v1/messages`), system prompt in top-level field |
| `src/llm/index.ts` | Factory: `createLLMProvider(settings)` → correct provider instance |

All providers use `requestUrl` for HTTP. No streaming for MVP (simpler, works everywhere).

**Test:** Temporary command that calls `testConnection()` for each provider.

---

## Step 5: Query Orchestrator

**Goal:** The pipeline that ties everything together: question → MCP search → LLM response.

| File | Purpose |
|------|---------|
| `src/orchestrator.ts` | 1) Call `zotero_semantic_search` with user question. 2) Parse item keys from results. 3) Fetch `zotero_get_item_metadata` for each. 4) Build context string. 5) Send context + question + conversation history to LLM. 6) Return response with source citations. |

Conversation history is truncated to last 6 messages to avoid context window overflow.

**Test:** Temporary command that runs full pipeline and logs result.

---

## Step 6: Sidebar Chat View

**Goal:** The user-facing chat panel in Obsidian's right sidebar.

| File | Purpose |
|------|---------|
| `src/chat-view.ts` | `ItemView` subclass. DOM-based UI (no framework): status bar, scrollable message list, textarea + send button. Uses `MarkdownRenderer.render()` for responses. Copy button on assistant messages. Sources list below each response. Clear chat via header action button. |
| `src/main.ts` | Register view with `registerView()`, add ribbon icon (`book-open`), add "Open Zotero Chat" command, `activateChatView()` opens in right sidebar. |

**Test:** Click ribbon icon, type a question, verify full flow works visually.

---

## Step 7: Styling

**Goal:** Polish the chat panel to match Obsidian's look and feel.

| File | Purpose |
|------|---------|
| `styles.css` | Flexbox layout, Obsidian CSS variables (`--background-primary`, `--text-normal`, etc.) for theme compatibility. User messages right-indented, assistant messages left-indented. |

**Test:** Verify appearance in light/dark themes.

---

## Step 8: Error Handling & Polish

**Goal:** Handle common failure modes gracefully.

Changes across files:
- **Settings:** "Test Connection" buttons for MCP and LLM
- **MCP client:** Timeout handling, clear error messages for "server not running" / "wrong URL"
- **Chat view:** Loading indicator while waiting, color-coded status dot, disabled send during loading
- **Main:** Start MCP server process in `onload()`, stop in `onunload()`. Create MCPClient once and reuse.

**Test:** Disable zotero-mcp from PATH → verify error message. Wrong Ollama URL → verify error. Switch providers → verify it works.

---

## Final File Tree

```
src/
  main.ts               Entry point, lifecycle, view registration
  types.ts              Interfaces and defaults
  settings.ts           Settings tab UI
  mcp-server.ts         Child process manager for zotero-mcp
  mcp-client.ts         MCP streamable-http client
  orchestrator.ts       Search → LLM pipeline
  chat-view.ts          Sidebar chat panel
  llm/
    index.ts            Provider factory
    llm-provider.ts     Abstract interface
    ollama.ts           Ollama provider
    openrouter.ts       OpenRouter provider
    anthropic.ts        Anthropic/Claude provider
manifest.json
package.json
tsconfig.json
esbuild.config.mjs
versions.json
styles.css
```

## Verification

After all steps:
1. `npm run build` succeeds with no type errors
2. Plugin loads in Obsidian without console errors
3. Settings tab shows all configuration options with correct conditional display
4. Plugin automatically starts zotero-mcp on load (visible in status indicator)
5. Sidebar chat can:
   - Send a question about the Zotero library
   - Display a markdown-formatted response with citations
   - Copy response to clipboard
6. Works with Ollama (local), OpenRouter, and Claude API
