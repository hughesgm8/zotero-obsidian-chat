# STARTING_INSTRUCTIONS.md — Project Bootstrap Protocol

## Purpose
Run this protocol **exactly once**, at the start of a new project, before any code is written. Your goal is to populate `memory/USER_INSIGHTS.md` and `memory/PROJECT_MAP.md` with enough context to make every future session productive. Once both files are populated and the user has reviewed them, you no longer need to reference this file.

---

## The Bootstrapping Conversation

This session should feel like getting to know someone — not an intake form. You're trying to understand two things simultaneously: **what they want to build** and **how they work best**. Weave both naturally through a single conversation rather than running them as separate interviews.

### Vision Track → `memory/PROJECT_MAP.md`

Use these as seeds, not a checklist. Let answers to some naturally surface others, and follow the conversation where it goes.

- What are you trying to build? *(Let them describe it in their own words. Don't offer frameworks or structure yet.)*
- Who will use it, and what will they actually do with it?
- What would it feel like for this to be working really well?
- What's the one thing that absolutely must be right?
- Is there anything like this that already exists — something you love, or something that almost does what you want but doesn't quite?

Pay close attention to the **metaphors they reach for** ("it's kind of like X, but for Y") — these reveal their mental model more reliably than direct answers. Notice what they're excited about versus what they seem uncertain or vague about. The uncertainty is often where the most important design work will happen.

### Collaboration Track → `memory/USER_INSIGHTS.md`

You're also learning how to work with this person. Most of this will surface naturally through conversation — don't turn it into a separate questionnaire. Ask directly only when something important seems unclear.

Things to listen for:
- Their technical comfort level — can they read code? Have they built things before, with or without AI tools?
- How much of an explanation they need behind the rationale for decisions made (this is based on their technical skill level)
- What's frustrated them before when trying to build things with AI tools
- How they like to work — long focused sessions, quick check-ins, or something in between

---

## Writing the Memory Files

Once you have a clear enough picture, pause and tell the user what you're about to write. You don't need to know everything before doing this — a sketch is the goal, not a specification.

Show them the content you plan to save — or at minimum, a plain-language summary — before writing anything. Invite them to correct or add to it:

> *"Before I save this, here's what I've captured about your project and how you like to work. Does this feel right, or is there anything you'd want to change?"*

After they confirm (or after any corrections), write to:
- `memory/PROJECT_MAP.md` — the vision sketch: what they're building, who it's for, and what success looks like to them
- `memory/USER_INSIGHTS.md` — the user profile: their background, working preferences, and communication style

Then let the user know where these files live and that they can check and edit them at any time. They belong to the user as much as to you.

---

## Repository Setup

Before any code is written, the project needs a home. Setting up version control now — rather than retrofitting it later — means the project has a complete history from day one. Explain this to the user simply before proceeding:

> *"Before we write any code, I'm going to set up version control for your project. Think of it as an undo button for the whole codebase — every change we make gets saved as a checkpoint, so if something breaks we can always roll back to when it was working."*

**Ask one question:** Do they want the project stored locally only, or also on GitHub so it's backed up online and shareable?

**Then automate the setup:**

- **Local only:** Run `git init` in the project folder, create a `.gitignore` appropriate to the project's likely tech stack, and make the initial commit.
- **GitHub:** Check whether the `gh` CLI is authenticated. If not, walk the user through `gh auth login` — it's a one-time browser flow. Once authenticated, create the remote ***private*** repo and push the initial commit.

**Create the session entry point:** Ask which tool the user is running — Claude Code or Gemini CLI. Then create the appropriate file in the project root:

- **Claude Code:** Create `CLAUDE.md` containing:
  ```
  @Agent Configuration/PERSISTENT_INSTRUCTIONS.md
  ```
- **Gemini CLI:** Create `GEMINI.md` containing:
  ```
  Before doing anything else, read `Agent Configuration/PERSISTENT_INSTRUCTIONS.md` and treat it as your complete operating instructions for this session.
  ```

Explain briefly what this does before creating it: *"This file tells [Claude Code / Gemini] to automatically load your project's instructions at the start of every future session — you won't need to set anything up manually again."*

**Make the first commit** with all config files from this folder and the new entry point file included. Use a clear, descriptive message:
```
Initial commit: project scaffolding and configuration
```

Confirm with the user once the repo is set up, and let them know they can always check the project's history using `git log`.

---

## Exit Condition

Bootstrapping is complete when both memory files have meaningful content, the user has confirmed what was written, the session entry point file (`CLAUDE.md` or `GEMINI.md`) has been created in the project root, and the git repository is initialised with an initial commit that includes all of the above. From this point forward, `PERSISTENT_INSTRUCTIONS.md` governs every session. You do not need to return to this file.
