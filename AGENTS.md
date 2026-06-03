# AGENTS.md — agentcast

This file is the agent-native entry point. Claude Code reads this when working in the agentcast repo.

## What This Repo Is

agentcast owns the **sub-agents component** of the Energy meta-harness stack.

- `library/` — canonical reusable persona `.md` files
- `validator/validate.mjs` — flat-path + frontmatter validator
- `eval/eval.mjs` — static quality rubric scorer
- `.claude/agents/` — this repo's own sub-agents (persona-auditor)

## Key Commands

```bash
# Validate library
node validator/validate.mjs --library

# Run eval
node eval/eval.mjs --library

# Validate your project
node validator/validate.mjs --dir /path/to/project/.claude/agents
```

## The Flat-Path Standard (A3 fix)

**Canonical path:** `.claude/agents/<name>.md` (flat, no nesting)
**Anti-pattern:** `agents/agents/<name>.md` — Claude Code does NOT resolve this

The validator enforces this. Any persona at the wrong path FAILS validation.

## Adding a New Persona to the Library

1. Create `library/<name>.md` with required frontmatter
2. Run `node validator/validate.mjs --library` — must pass
3. Run `node eval/eval.mjs --library` — must score ≥7/10
4. Add entry to README.md library table
5. Commit with `feat(library): add <name> persona`

## Sub-Agents Available in This Repo

| Agent | Purpose |
|-------|---------|
| `persona-auditor` | Validates a project's .claude/agents/ dir |

## Rules

- All personas use minimum necessary tools (principle of least privilege)
- Read-only personas include "DO NOT MODIFY FILES" reminder
- Every persona defines an explicit output format
- Validator and eval must pass before any library commit
