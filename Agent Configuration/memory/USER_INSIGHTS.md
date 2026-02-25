# User Insights

## Background
- Avid Obsidian user with many plugins installed; familiar with what good plugins look like (Copilot as primary reference)
- First time building an Obsidian plugin
- Comfortable experimenting with local LLMs (Ollama, primarily DeepSeek models)
- Has the Zotero MCP server already set up and working with Claude Desktop

## Testing Environment
- Uses `deepseek-v3.1:671b-cloud` via Ollama for personal testing — cloud-backed model via Ollama interface (M1 Mac can't run 671B locally at useful speed)
- Wants fully local model support (e.g. deepseek-r1:8b) as a first-class use case for other users

## Working Style
- Prefers explanations of *why* behind decisions, not just what to do
- Will push back when something doesn't make sense — wants clarity over false agreement
- Thinks about accessibility from the start — wants the plugin to work for people without paid API access
- Thinks strategically about dependencies — considers forking third-party packages when upstream priorities diverge from his use case

## Communication Preferences
- Appreciates when complexity is broken down clearly
- Uses existing tools (like Copilot) as reference points for UX expectations
- Comfortable with technical discussion but benefits from context on new concepts
- Not a CLI expert — avoid sending him down complex terminal command rabbit holes; prefer Finder-level instructions or single clear commands when possible

## Notes for Future Sessions
- Reference Obsidian Copilot when discussing UI patterns — it's the mental model
- When proposing architecture, explain tradeoffs rather than just recommending
- Keep accessibility (free/local model support) as a first-class concern, not an afterthought
- Don't over-diagnose or speculate without evidence — Gabriel will call it out
