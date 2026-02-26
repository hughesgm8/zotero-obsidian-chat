# Smart Import from Zotero — Implementation Plan (Saved 2026-02-26)

**Status:** Planning complete, not yet implemented. Gabriel paused this to address another issue.

## Context

Gabriel currently uses the Zotero Integration plugin to import references as notes, but it only imports highlighted/annotated text — not abstracts, summaries, or any AI analysis. His existing template (`04_Templates/source-notes.md` in the Obsidian vault) already has empty sections for Summary, Interesting Takeaways, Critique, and Relevance that he fills manually. This feature replaces that workflow: a command-palette-triggered import that uses zotero-mcp to fetch paper data and the LLM to auto-generate those sections.

## Gabriel's Template (for reference)

Located at: `/Users/gabrielmhughes/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Vault/04_Templates/source-notes.md`

Key structure:
- Frontmatter: Title, Year, Authors, Tags (array), Related, Aliases
- Nunjucks `{% persist %}` blocks for: Summary, Interesting Takeaways, Critique, Relevance, Other Notes
- In-text annotations section (highlights from Zotero PDFs)
- Templater move command to `/00_Inbox/Research Papers/Papers`

## What We're Building

A new command: **"Import paper from Zotero with AI summary"** — triggered from the command palette, opens a search modal, user picks a paper, and a fully-populated note is created in the vault.

## User Preferences (from planning discussion)

- **Trigger:** Command palette (separate from chat sidebar UI)
- **Selection:** Search-based (type query → see results → pick one)
- **Save location:** Configurable folder in settings
- **AI content:** Paper summary + Abstract + Key takeaways + Critique + Relevance to research
- **Research context:** Global description in settings + optional attached notes (both)
- **Scope:** Single paper for v1 (no batch)

## Files to Modify

| File | Change |
|---|---|
| `src/types.ts` | Add `importFolder` and `researchDescription` settings |
| `src/settings.ts` | Add "Smart Import" settings section |
| `src/main.ts` | Expose `mcpClient`, register new command |
| `styles.css` | Add import modal styles |

## Files to Create

| File | Purpose |
|---|---|
| `src/paper-importer.ts` | Core logic: search Zotero, fetch data, call LLM, create note |
| `src/import-modal.ts` | Search modal UI (plain `Modal`, not `SuggestModal` — our search is async) |

## Implementation Steps

### 1. Settings (`src/types.ts` + `src/settings.ts`)

Add to `ZoteroMCPSettings`:
- `importFolder: string` (default: `"Zotero Notes"`) — where imported notes go
- `researchDescription: string` (default: `""`) — persistent research interests for relevance analysis

Add a new "Smart Import" section in settings UI with:
- Text input for import folder path
- Textarea for research description (placeholder: "e.g., I study the effects of...")

### 2. Paper Importer (`src/paper-importer.ts`)

New class `PaperImporter` with two methods:

**`search(query: string): Promise<ZoteroSource[]>`**
- Calls `zotero_semantic_search` via existing `MCPClient`
- Extracts item keys and fetches metadata (duplicate logic from `orchestrator.ts` lines 117-216 — `extractItemKeys` + `parseMetadata`)

**`importPaper(source: ZoteroSource): Promise<{ filePath: string; title: string }>`**
1. Fetch full text via `zotero_get_item_fulltext` (no truncation — single paper, want max quality)
2. Build LLM prompt asking for structured output matching Gabriel's template sections:
   - **Summary** (2-3 paragraphs)
   - **Interesting Takeaways** (bullet points)
   - **Critique** (methodological strengths/weaknesses)
   - **Relevance** (only if `researchDescription` is set)
3. Call `llmProvider.chat(messages)`
4. Create markdown note matching Gabriel's existing template format
5. Ensure import folder exists, sanitize filename, handle collisions
6. Return file path

**Note template** (matches existing `source-notes.md` structure):
```markdown
---
Title: "{{title}}"
Year: {{year}}
Authors: {{authors}}
Tags:
  - {{tag1}}
  - literature
  - ai-imported
Related:
Aliases:
---

## Summary
{{LLM-generated summary}}

## Interesting Takeaways
{{LLM-generated bullet points}}

## Critique
{{LLM-generated critique}}

## Relevance
{{LLM-generated relevance — or "No research description configured." if empty}}

## Abstract
{{abstract from Zotero metadata}}

## Notes
> Your own notes go here.
```

### 3. Import Modal (`src/import-modal.ts`)

Plain `Modal` (not `SuggestModal` — `getSuggestions()` is synchronous but our search is async).

**UX flow:**
1. Opens with search input + placeholder "Search your Zotero library..."
2. User types → debounced 400ms → calls `PaperImporter.search()`
3. Results render as clickable rows: **Title** (bold) + Authors, Year (muted)
4. Click a result → modal closes → Notice: "Importing [title]... This may take 20-30 seconds."
5. On success → Notice + opens the new note
6. On error → Notice with error message

### 4. Wiring (`src/main.ts`)

- Add `getMCPClient(): MCPClient | null` accessor
- Register command `import-paper-from-zotero`
- Check `mcpClient` is available before opening modal
- Create `PaperImporter` with app, mcpClient, llmProvider, settings

### 5. Styles (`styles.css`)

Minimal CSS for the modal: search input, results list (scrollable), result items (hover highlight), status text.

## LLM Prompt Design

System: "You are a research assistant helping a researcher catalog and understand academic papers."

User message includes:
- Paper title, authors, year, abstract
- Full text (if available, untruncated)
- Research description (if configured)
- Explicit format instructions requesting the 4 sections with markdown headings

## Error Handling

| Scenario | Behavior |
|---|---|
| MCP server not running | Command aborts with Notice |
| Search fails | Status text in modal |
| No results | Status text: "No results found." |
| No full text | Proceed with abstract-only |
| LLM error | Notice: "Import failed: [message]" |

## Key Design Decisions

- **Note format matches existing template** — same frontmatter, same sections
- **`ai-imported` tag** distinguishes from Zotero Integration imports
- **Skips annotations** since this flow doesn't pull PDF highlights
- **Full text untruncated** (unlike chat's 4000 char cap) — one paper, max quality
- **Plain Modal** over SuggestModal for async compatibility

## Verification Plan

1. Build: `npm run build`
2. Reload Obsidian plugin
3. Command palette → "Import paper from Zotero with AI summary"
4. Search for known paper → select → verify note created with all sections
5. Test error cases: server stopped, paper with no full text
