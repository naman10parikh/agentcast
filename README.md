# agentcast

> Cast the right agent for every role.

agentcast is the **sub-agents component** of the Energy meta-harness stack. It owns:

1. **Library** (`library/`) — reusable `.claude/agents`-compatible persona `.md` files
2. **Validator** (`validator/validate.mjs`) — asserts flat path + valid frontmatter
3. **Eval** (`eval/eval.mjs`) — static rubric scoring for persona quality (0–10)

## The Flat-Path Standard

Claude Code resolves sub-agent personas from **`.claude/agents/<name>.md`** — flat, no subdirectories.

The anti-pattern this repo fixes: `agents/agents/<name>.md` (A3 double-nesting — Claude Code
does NOT resolve this correctly). The validator hard-fails on any double-nesting.

## Quick Start

```bash
# Validate your project's .claude/agents/ dir
node /path/to/agentcast/validator/validate.mjs --dir ./.claude/agents

# Validate agentcast's own library
node validator/validate.mjs --library

# Score library personas against the quality rubric
node eval/eval.mjs --library

# Validate a single file
node validator/validate.mjs --file .claude/agents/my-agent.md
```

## Library Personas

| File | Role | Model |
|------|------|-------|
| `researcher.md` | Multi-source web + codebase research | sonnet |
| `code-reviewer.md` | TypeScript/security/arch code review | sonnet |
| `test-writer.md` | Vitest unit + integration test generation | sonnet |
| `security-reviewer.md` | Injection / auth / CORS / secrets audit | sonnet |
| `architect.md` | Trade-off analysis + system design | sonnet |
| `qa-tester.md` | User-perspective E2E QA + bug reports | sonnet |

## Dropping a Persona Into a Project

```bash
# Copy a persona into a project's .claude/agents/
cp /path/to/agentcast/library/researcher.md ./.claude/agents/researcher.md

# Validate the drop is correct
node /path/to/agentcast/validator/validate.mjs --file ./.claude/agents/researcher.md
```

## Validator Rules

1. **PATH** — file must be under `.claude/agents/` (not `agents/agents/`)
2. **FRONTMATTER** — must contain `name`, `description`, `model`, `allowed-tools`
3. **MODEL** — must be one of `opus`, `sonnet`, `haiku`, or versioned variants

## Eval Rubric (5 dimensions, 0–2 each = max 10)

| Dimension | What it checks |
|-----------|----------------|
| Frontmatter completeness | All 4 required keys present |
| Model appropriateness | Model matches task complexity |
| Tool minimalism | ≤6 tools (principle of least privilege) |
| Output contract | Explicit output format section |
| DO NOT MODIFY guard | Read-only personas remind themselves not to write |

Passing threshold: **7/10**.

## Provisional Name

"agentcast" is provisional — pending chairman confirmation or rename. The repo-create
and final naming are in `TODOS.md`.

## See Also

- **agentgrid** — orchestration layer that consumes agentcast personas
- **armory** — catalog of all tools (personas are a subset)
- **agentdial** — model settings dial per task
