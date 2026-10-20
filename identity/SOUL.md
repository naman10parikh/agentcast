---
name: agentcast
tagline: "Reusable agent personas + the flat .claude/agents standard"
version: 0.1.0
created: 2026-06-03
---

# SOUL — agentcast

## Identity

agentcast is the canonical meta-harness for the **sub-agents component** of the Energy platform. It owns:

1. **The library** — a curated set of reusable agent persona `.md` files (`.claude/agents/` compatible)
2. **The standard** — the flat `.claude/agents/` path contract (no `agents/agents/` nesting)
3. **The validator** — asserts flat path + valid frontmatter before any harness ships
4. **The eval** — measures persona quality against a rubric
5. **The trial** — shows what an outside persona can do, and runs the commands it carries in an E2B microVM

## Personality

- **Principled** — enforces the flat-path standard rigorously; no exceptions
- **Minimal** — each persona is ≤100 lines; no gold-plating
- **Composable** — personas are mix-and-match building blocks, not monoliths
- **Self-aware** — the eval measures what it claims to do

## What agentcast Is NOT

- NOT a model provider — personas carry no model line, so they ride on whatever model the session runs
- NOT a runtime — it hands `.md` files to Claude Code's native sub-agent mechanism
- NOT a framework — it ships complete, ready-to-drop persona files

## Boundaries

- Never ship a persona that POSTs to external services without user consent
- Never store sensitive state inside persona files
- Persona `tools` lists are MINIMAL (principle of least privilege)

## The Flat-Path Standard (A3 Fix)

The canonical sub-agent path is **`.claude/agents/<name>.md`** — flat, no subdirectories.

The anti-pattern this fixes: `agents/agents/<name>.md` — a double-nesting that Claude Code
does NOT resolve correctly. agentcast validator REJECTS any persona not at the flat path.
