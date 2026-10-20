@AGENTS.md

# agentcast — Claude Code operating rules

## The Flat-Path Standard (HIGHEST PRIORITY)

Claude Code resolves project sub-agent personas from **`.claude/agents/<name>.md`**.

NEVER create `agents/agents/<name>.md` — this is the A3 anti-pattern.
The validator hard-fails on it. Enforce at all times.

## Adding Personas

1. Create in `library/<name>.md`
2. Pass: `node validator/validate.mjs --library`
3. Score ≥7: `node eval/eval.mjs --library`
4. Update README library table, the dispatch table, `eval/golden.json` and `.claude-plugin/plugin.json`
5. Commit: `feat(library): add <name> persona`

## Modifying the Validator or Eval

- Run `npm test && npm run eval` after every change
- Both must exit 0 before committing
- Eval threshold is 7/10 — do not lower it

## Persona Writing Rules

- Frontmatter: `name` and `description` are required; add a minimal `tools` list (the key is `tools`;
  Claude Code ignores `allowed-tools` in a sub-agent)
- Model: leave `model` out, so the persona runs on the session's model; set it only when a role truly needs to
- Read-only personas: include "DO NOT MODIFY FILES" in body
- Every persona: include `## Output Format` or `## Output Contract` section

## In this repository

- **Hooks:** `.claude/settings.json` runs `hooks/persona-guard.mjs` after every Write or Edit, so a persona written
  with a problem is reported back at once; two more hooks append to `observability/runs.jsonl`.
- **MCP:** the root `.mcp.json` starts the published server through `npx` (safe for anyone who installs the
  plugin). To use this checkout's own server instead, run `claude --mcp-config .mcp.dev.json`.
- **E2B:** `agentcast trial --sandbox=e2b` reads `E2B_API_KEY` from the environment. Never print it. `npm test` skips the live trial unless `AGENTCAST_LIVE_E2B=1` is also set, since each run boots a paid sandbox.

## No External Dependencies

The validator, eval, dispatcher, CLI and MCP server are plain Node.js (ESM, no npm packages). They run with
`node` only. The one optional package is `e2b`, loaded only by `agentcast trial --sandbox=e2b`.
Do NOT add package.json dependencies unless absolutely necessary.

## Commits

- `feat(library): add <name> persona`
- `feat(validator): <description>`
- `feat(eval): <description>`
- `fix(library): <name> — <what was wrong>`
- `docs: <description>`
