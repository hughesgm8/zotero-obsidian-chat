# Architectural Decisions

## Decision: Deterministic orchestration instead of LLM tool-calling

### Why This Matters
The plugin works reliably with local models (DeepSeek via Ollama) that can't do tool-calling, making it accessible to users without paid API access.

### Options We Considered
1. **Deterministic pipeline (search → metadata → LLM)**: Good for reliability with any model, bad for flexibility — the LLM can't decide to search differently
2. **Let the LLM call MCP tools**: Good for smart models that can adapt their search strategy, bad for local models that fail at tool-calling

### Why We Chose This
- Local model support is a first-class concern, not an afterthought
- Fixed pipeline is predictable and debuggable
- MVP doesn't need adaptive search — semantic search + metadata is sufficient

### What Could Change
If we add "Smart mode" for capable models (Claude, GPT-4), we'd let those models call tools directly while keeping the deterministic pipeline as the default.

---

## Decision: Custom MCP client instead of the MCP TypeScript SDK

### Why This Matters
The plugin actually works inside Obsidian's Electron renderer, which has restrictions on Node.js HTTP modules.

### Options We Considered
1. **Custom JSON-RPC client using Obsidian's `requestUrl`**: Good for guaranteed compatibility, bad for missing SDK features (reconnection, schema validation)
2. **MCP TypeScript SDK**: Good for full protocol support, bad because it depends on Node.js `http`/`https` modules that don't work in Electron's renderer process

### Why We Chose This
- MCP over streamable-http is just JSON-RPC POSTs — simple enough to implement in ~120 lines
- `requestUrl` is Obsidian's built-in HTTP that bypasses CORS restrictions
- No external dependencies to manage or break

### What Could Change
If the MCP SDK adds browser/Electron support, switching to it would give us automatic protocol upgrades and better error handling.

---

## Decision: Plugin spawns zotero-mcp as a child process

### Why This Matters
Users don't need to manually start a server in a terminal before using the plugin — it just works.

### Options We Considered
1. **Auto-spawn on plugin load**: Good for UX (zero setup), bad if the user wants to manage the server themselves
2. **Require manual server start**: Good for control, bad for accessibility — adds a step most users won't understand
3. **Connect to an already-running server**: Good for advanced users, bad for the default experience

### Why We Chose This
- "It just works" matters for a plugin aimed at researchers, not developers
- The process is killed cleanly on plugin unload
- Settings still let users point to a custom executable path if needed

### What Could Change
If users want to share a single zotero-mcp instance across apps (e.g., Claude Desktop + Obsidian), we'd add a "connect to existing server" mode alongside the auto-spawn default.
