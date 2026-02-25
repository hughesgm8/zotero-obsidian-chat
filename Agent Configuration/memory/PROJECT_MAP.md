# Purpose
Maintain a system map the user can understand. The project's status is updated regularly, while the project's specification is established in earlier vision-focused sessions and updated only when major decisions dictate changes should be made.

# Project Status

## ✅ Working Well
- Full plugin scaffolding (manifest, package.json, tsconfig, esbuild)
- TypeScript compiles with zero errors, `npm run build` produces `main.js`
- Settings tab with conditional provider fields (re-renders on dropdown change)
- MCP server manager: auto-spawn, warm-server reuse across reloads (`tryReuseExistingServer`), `stop()` keeps server alive
- MCP client (JSON-RPC 2.0 over HTTP with SSE support via Node `http` module)
- LLM provider abstraction (Ollama, OpenRouter, Anthropic)
- Deterministic query orchestrator (search → metadata → full text → LLM)
- Sidebar chat view with markdown rendering, citations, copy button
- Save conversation to vault (floppy disk button → `Zotero Chats/YYYY-MM-DD/` folder)
- Attach active note as context (paperclip button → chip UI, prepends note content to query)
- Sources citations: correctly parses markdown format returned by `zotero_get_item_metadata`
- UI layout: `ResizeObserver` in `onOpen()` fires `workspace.trigger("resize")` as soon as panel gets real dimensions (no more squash on cold open)
- Tested end-to-end in a real Obsidian vault (confirmed working)

## 📋 Planned
- "Test Connection" buttons in settings for MCP and LLM
- "Smart mode" for capable models that can call MCP tools themselves
- Model switching directly in the sidebar UI (currently settings-only)

## ⚠️ Known Issues
- **zotero-mcp ChromaDB bug**: `chroma_client.py` line 194 uses `create_collection()` instead of `get_or_create_collection()`. When Claude Desktop's zotero-mcp processes are running simultaneously, they share `~/.config/zotero-mcp/chroma_db` and the plugin's instance fails with "Collection [zotero_library] already exists". **Workaround applied**: edited installed package at `/Library/Frameworks/Python.framework/Versions/3.12/lib/python3.12/site-packages/zotero_mcp/chroma_client.py` line 194. This will be overwritten by `pip upgrade`. Gabriel is considering forking zotero-mcp long-term.
- **zotero-mcp crashes after queries** (exit code 1) — likely related to the above ChromaDB issue. Plugin now shows a Notice and turns status dot red when this happens.
- Test Connection buttons not yet implemented

# Project Spec

## Description & Purpose
An Obsidian plugin that connects to the [Zotero MCP server](https://github.com/54yyyu/zotero-mcp), letting users query their vectorized Zotero library from within Obsidian. The plugin supports multiple LLM backends — Claude API, OpenRouter, and local models via Ollama — with a focus on accessibility for users who want a free, local-only option.

## Key User Stories
- As a researcher, I can ask questions about my Zotero library from within Obsidian by typing in a sidebar panel
- As a user, I can receive answers with citations to specific papers in my library
- As a user, I can copy responses (formatted as markdown) to paste into my notes
- As a user, I can configure multiple LLM backends (Claude, OpenRouter, Ollama) in settings
- As a user, I can switch between configured models directly in the sidebar UI

## Architecture

### MVP Approach
The plugin handles MCP calls directly rather than delegating tool selection to the LLM. This ensures reliability with local models that may not handle tool-calling well.

**Flow:**
1. User asks a question in sidebar
2. Plugin calls MCP server (semantic search → fetch relevant full text/metadata)
3. Plugin sends context + question to configured LLM
4. Response displayed in sidebar with copy button

### Future Enhancement
"Smart mode" for capable models (Claude, GPT-4) that can call MCP tools themselves, adapting to question type.

## Key Files
| File | Role |
|------|------|
| `src/main.ts` | Plugin entry point — lifecycle, view registration, MCP startup |
| `src/types.ts` | All shared interfaces and defaults |
| `src/settings.ts` | Settings tab UI |
| `src/mcp-server.ts` | Spawns/kills the `zotero-mcp` child process |
| `src/mcp-client.ts` | JSON-RPC 2.0 client for MCP over HTTP |
| `src/orchestrator.ts` | search → metadata → LLM pipeline |
| `src/chat-view.ts` | Sidebar `ItemView` with chat UI |
| `src/llm/index.ts` | Factory that creates the right LLM provider |
| `src/llm/llm-provider.ts` | `LLMProvider` interface |
| `src/llm/ollama.ts` | Ollama via OpenAI-compatible endpoint |
| `src/llm/openrouter.ts` | OpenRouter provider |
| `src/llm/anthropic.ts` | Anthropic Messages API provider |

## Key Dependencies
- [zotero-mcp](https://github.com/54yyyu/zotero-mcp) — handles vectorization and exposes Zotero library via MCP protocol
- Obsidian Plugin API (TypeScript)

## UI Reference
Modeled after the Obsidian Copilot plugin: sidebar panel, markdown-formatted responses, copy functionality, model switching in UI.

## Reference Documents
- Implementation plan: `Agent Configuration/changelogs/IMPLEMENTATION_PLAN_v0.1.0.md`
- Changelogs: `Agent Configuration/changelogs/2026-02-23.md`, `2026-02-24.md`, `2026-02-25.md`
