# agentcast — Claude Code Harness

## What This Repo Owns

agentcast is the **sub-agents component** of the Energy meta-harness stack. It maintains:

1. The library of reusable agent persona `.md` files (`library/`)
2. The flat-path standard validator (`validator/validate.mjs`)
3. The persona quality eval (`eval/eval.mjs`)

## Operating Rules

### The Flat-Path Standard (HIGHEST PRIORITY)

Claude Code resolves sub-agent personas from **`.claude/agents/<name>.md`** — flat.

NEVER create `agents/agents/<name>.md` — this is the A3 anti-pattern.
The validator hard-fails on it. Enforce at all times.

### Adding Personas

1. Create in `library/<name>.md`
2. Pass: `node validator/validate.mjs --library`
3. Score ≥7: `node eval/eval.mjs --library`
4. Update README library table
5. Commit: `feat(library): add <name> persona`

### Modifying the Validator or Eval

- Run with `--library` after every change
- Both must exit 0 before committing
- Eval threshold is 7/10 — do not lower it

### Persona Writing Rules

- Frontmatter: `name`, `description`, `model`, `allowed-tools` — ALL required
- Model: `haiku` for read-only research; `sonnet` for complex review/write; `opus` only if genuinely needed
- `allowed-tools`: minimal — only what the persona actually uses
- Read-only personas: include "DO NOT MODIFY FILES" in body
- Every persona: include `## Output Format` or `## Output Contract` section

## No External Dependencies

The validator and eval are pure Node.js (ESM, no npm packages). They run with `node` only.
Do NOT add package.json dependencies unless absolutely necessary.

## Commits

- `feat(library): add <name> persona`
- `feat(validator): <description>`
- `feat(eval): <description>`
- `fix(library): <name> — <what was wrong>`
- `docs: <description>`

Trailer: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
