# AGENTS.md — agentcast

> How any coding agent uses and works on agentcast. This is the one source; `CLAUDE.md` and `GEMINI.md` point here.

## What it does

agentcast owns the **sub-agents** part of an agent's harness. It keeps a library of six reusable personas
(researcher, code-reviewer, test-writer, security-reviewer, architect, qa-tester), installs them into a project's
`.claude/agents/`, and checks any persona against what Claude Code reads today: `name` and `description` required,
`tools` as the allowlist (never `allowed-tools`), valid model and permission values, and the flat path. It scores
personas on a 10-point rubric, routes a task to the right persona, and shows what an outside persona can do
before you install it, running any commands it carries inside an E2B microVM.

## Tools and how to call them

| Surface | Call | What it returns |
| ------- | ---- | --------------- |
| CLI | `npx -y -p github:naman10parikh/agentcast agentcast list` | The library: id, job and tools |
| CLI | `agentcast add <id> [--dir=.claude/agents] [--force]` | Copies a persona into the project and validates it |
| CLI | `agentcast validate [--dir <path> \| --file <path> \| --library]` | Every problem Claude Code would reject or ignore; exit 1 on errors |
| CLI | `agentcast score [--dir <path> \| --file <path> \| --library]` | The rubric score (0 to 10, pass at 7) with notes |
| CLI | `agentcast dispatch [--json] "<task>"` | The best persona for a task and the command that installs it |
| CLI | `agentcast trial <file\|id> [--sandbox=e2b]` | Tools, permission mode and the commands a persona carries; with E2B, what each command did |
| CLI | `agentcast recall "<query>"` | The best matching sections of agentcast's memory and library |
| MCP | `agentcast-mcp` tools `persona_dispatch`, `persona_get`, `persona_validate`, `persona_score` | The same over JSON-RPC on stdio |
| Skills | `skills/persona-validate`, `skills/persona-scaffold`, `skills/persona-cast` | Playbooks: check, write, cast |
| Sub-agents | `.claude/agents/persona-auditor.md`, `.claude/agents/persona-caster.md` | An auditor that reports; a caster that installs |
| Hook | `hooks/persona-guard.mjs` (PostToolUse on Write, Edit, MultiEdit) | Tells the agent when a persona it wrote has problems |

`--sandbox=e2b` needs `E2B_API_KEY` in the environment and the optional `e2b` package (installed with agentcast).

## Layout

```
library/         the six reusable personas (plain Markdown, ready for .claude/agents/)
bin/agentcast.mjs   the CLI          mcp/server.mjs   agentcast-mcp
validator/       validate.mjs: what Claude Code reads, checked
eval/            eval.mjs (the rubric), golden.mjs + golden.json (validator and routing cases)
dispatch/        dispatch.mjs: task → persona
lib/             trial.mjs (inspect, run in E2B), recall.mjs (memory search)
hooks/           persona-guard.mjs and hooks.json (the plugin's hooks)
observability/   run-log.mjs → runs.jsonl, one line per command, hook and MCP call
identity/        SOUL, BRAND, HEARTBEAT, MEMORY, LEARNINGS
skills/          the three skills       .claude/agents/   the two personas
scripts/         field-drift.mjs: the nightly check against Claude Code's docs
tests/           node:test suites
dsip.json        the self-improvement contract (honest level L2)
```

## Adding a persona to the library

1. Write `library/<name>.md` (the `persona-scaffold` skill has the template): `name`, `description`, a minimal
   `tools` list, no `model` line, an `## Output Format` section, and "DO NOT MODIFY FILES" if it is read-only.
2. `node validator/validate.mjs --library` must pass and `node eval/eval.mjs --library` must score it 7 or more.
3. Add a routing entry to `dispatch/dispatch.mjs` and a golden task to `eval/golden.json`.
4. Add it to the README table and to `agents` in `.claude-plugin/plugin.json`.
5. Commit with `feat(library): add <name> persona`.

## Working on agentcast

- `npm test` (node:test, no dependencies) and `npm run eval` must pass; CI runs both on every pull request.
- New sub-agent fields in Claude Code: update `KNOWN_FIELDS` and the value checks in `validator/validate.mjs`,
  add golden cases, and update `identity/MEMORY.md`. The nightly loop opens an issue when the docs change.

## What not to do

- Do not add `model` to library personas; they run on the session's model and upgrade with it.
- Do not use `allowed-tools` in a sub-agent; Claude Code ignores it there and the persona gets every tool.
- Do not nest personas (`agents/agents/`); keep one flat level.
- Do not run an outside persona's commands on this machine; trial them with `--sandbox=e2b`.
- Do not print or commit keys; E2B reads `E2B_API_KEY` from the environment only.
- Do not merge from the improvement loop; it opens issues, a person merges.
