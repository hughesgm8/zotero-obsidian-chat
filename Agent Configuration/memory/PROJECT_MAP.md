# Purpose
Maintain a system map the user can understand. The project's status is updated regularly, while the project's specification is established in earlier vision-focused sessions and updated only when major decisions dictate changes should be made.

# Project Status

## ✅ Working Well
-

## 🚧 In Progress
- Initial project setup and bootstrapping

## 📋 Planned
- Core plugin architecture
- Sidebar UI for chat interface
- MCP server integration
- Multi-model support (Claude, OpenRouter, Ollama)

## ⚠️ Known Issues
-

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

## Key Dependencies
- [zotero-mcp](https://github.com/54yyyu/zotero-mcp) — handles vectorization and exposes Zotero library via MCP protocol
- Obsidian Plugin API (TypeScript)

## UI Reference
Modeled after the Obsidian Copilot plugin: sidebar panel, markdown-formatted responses, copy functionality, model switching in UI.
