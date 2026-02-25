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

---

## Decision: Edit installed zotero-mcp package directly (not fork — yet)

### Why This Matters
zotero-mcp has a bug in `chroma_client.py` where `create_collection()` is called in an `except` block instead of `get_or_create_collection()`. When Claude Desktop's zotero-mcp instances are running alongside the plugin's instance, they share the same `~/.config/zotero-mcp/chroma_db` directory. The second instance to call the tool always fails with "Collection [zotero_library] already exists".

### Options We Considered
1. **Edit installed package**: Quick fix, works immediately, but silently overwritten on `pip upgrade`
2. **Fork and maintain zotero-mcp**: Full control, permanent fix, slightly more setup. Updates from upstream are optional and cherry-picked. Only real reason to pull upstream is if Zotero's API changes.
3. **Contribute fix upstream**: Correct long-term move but not guaranteed to be merged quickly; upstream appears primarily maintained for Claude Desktop (stdio transport), not HTTP transport

### Why We Chose This (for now)
Edit the installed package to unblock immediately. Gabriel is considering forking zotero-mcp for longer-term maintenance — the project's priorities aren't fully aligned with our plugin's usage (HTTP transport, multi-instance scenarios).

### What Could Change
Gabriel forks zotero-mcp and installs it with `pip install -e /path/to/fork`. This makes the fix permanent and gives full control over future changes without depending on upstream.

---

## Decision: zotero-mcp HTTP transport is our primary concern; Claude Desktop uses stdio

### Why This Matters
The plugin spawns zotero-mcp with `--transport streamable-http`. Claude Desktop uses stdio. Both point at the same `~/.config/zotero-mcp/chroma_db`. When both apps run simultaneously, they race on ChromaDB collection creation — a bug masked in Claude Desktop's usage because stdio sessions are isolated.

### Implication
Bugs in zotero-mcp's HTTP transport path are unlikely to be caught or fixed by the upstream maintainer. We should treat zotero-mcp as a dependency we may need to patch or fork.
