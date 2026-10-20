# agentcast

<!-- fleet:header:start -->
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE) [![Agent-native](https://img.shields.io/badge/agent--native-yes-2f5d8a?style=flat-square)](AGENTS.md) [![MCP server](https://img.shields.io/badge/MCP-server-1e3f60?style=flat-square)](#use-it-from-any-coding-agent) [![Skills](https://img.shields.io/badge/skills-3-2f6b4f?style=flat-square)](skills/)

**A library of reusable sub-agent personas, validated and scored.**

AgentCast is an agent employee, a packaged specialist agent with its own skills, memory and tests. It owns one job: sub-agents. Coding agents use it through its skills, its MCP server and its command line. A scheduled job runs its evals and proposes fixes. A person makes every change.

_AgentCast is part of an agent-native play for agent-native systems that can eventually be recursively self-improving and evolving, operated by agent employees._

[AGENTS.md](AGENTS.md) · [llms.txt](llms.txt) · [Skills](skills/) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [All projects](https://github.com/naman10parikh)
<!-- fleet:header:end -->

> Cast the right agent for every role.

agentcast keeps six reusable sub-agent personas (researcher, code reviewer, test writer, security reviewer,
architect, QA tester) that you install into a project's `.claude/agents/` with one command. It checks any persona
against what Claude Code actually reads, scores it, and picks the right one for a task. It is for anyone who gives
a coding agent specialist helpers, including helpers someone else wrote: agentcast shows what such a persona can do
and runs any commands it carries inside an E2B microVM before you install it.

<!-- fleet:use:start -->
## Use it from any coding agent

**Claude Code**: the plugin brings the skills, sub-agents, hooks and MCP server.

```
/plugin marketplace add naman10parikh/agentcast
/plugin install agentcast@agentcast
```

<details><summary>Its MCP server, Codex, Cursor, Gemini CLI, one skill and the command line</summary>

**Its MCP server**, in any MCP client:

```bash
claude mcp add --transport stdio agentcast -- npx -y -p github:naman10parikh/agentcast agentcast-mcp
codex mcp add agentcast -- npx -y -p github:naman10parikh/agentcast agentcast-mcp
```

Cursor (`.cursor/mcp.json`), Gemini CLI (`.gemini/settings.json`) and most other clients take the same command as JSON:

```json
{
  "mcpServers": {
    "agentcast": {
      "command": "npx",
      "args": [
        "-y",
        "-p",
        "github:naman10parikh/agentcast",
        "agentcast-mcp"
      ]
    }
  }
}
```

**Gemini CLI**: the extension brings the context and the MCP server.

```bash
gemini extensions install https://github.com/naman10parikh/agentcast
```

**One skill** (3 in all, in [skills/](skills/)), in any agent that reads Agent Skills:

```bash
gemini skills install https://github.com/naman10parikh/agentcast --path skills/persona-validate
git clone --depth 1 https://github.com/naman10parikh/agentcast /tmp/agentcast && cp -r /tmp/agentcast/skills/persona-validate ~/.claude/skills/
```

**The command line:**

```bash
npx -y -p github:naman10parikh/agentcast agentcast --help
```

</details>

Codex, Cursor, OpenCode, GitHub Copilot and other agents read [AGENTS.md](AGENTS.md); Claude Code reads [CLAUDE.md](CLAUDE.md) and Gemini CLI reads [GEMINI.md](GEMINI.md), which import it. [llms.txt](llms.txt) maps every surface for agents that read first.
<!-- fleet:use:end -->

## Quick start

It installs from GitHub; nothing is published to npm. In any project:

```bash
npx -y -p github:naman10parikh/agentcast agentcast dispatch "audit the login endpoint for injection and leaked secrets"
# → security-reviewer
npx -y -p github:naman10parikh/agentcast agentcast add security-reviewer
# added security-reviewer → .claude/agents/security-reviewer.md  (valid)
npx -y -p github:naman10parikh/agentcast agentcast score --dir .claude/agents
# ✓ security-reviewer.md  10/10
```

Before installing a persona someone else wrote, see what it can do, and run the commands it carries in a microVM
(needs `E2B_API_KEY`):

```bash
npx -y -p github:naman10parikh/agentcast agentcast trial ./their-persona.md --sandbox=e2b
# commands it carries: 1
#   [hooks] exit=2 (80 ms) echo checked-by-persona-hook; exit 2
```

Working on agentcast itself:

```bash
git clone https://github.com/naman10parikh/agentcast && cd agentcast
npm test && npm run eval        # node:test suites, then the rubric and the golden cases
node validator/validate.mjs --library
```

## How it works

### The library

| File | Role | Tools |
|------|------|-------|
| `researcher.md` | Multi-source web + codebase research | Read, Glob, Grep, WebSearch, WebFetch, Bash |
| `code-reviewer.md` | TypeScript/security/arch code review | Read, Glob, Grep |
| `test-writer.md` | Vitest unit + integration test generation | Read, Glob, Grep, Write, Edit |
| `security-reviewer.md` | Injection / auth / CORS / secrets audit | Read, Glob, Grep |
| `architect.md` | Trade-off analysis + system design | Read, Glob, Grep, WebSearch, WebFetch |
| `qa-tester.md` | User-perspective E2E QA + bug reports | Read, Glob, Grep, Bash, WebFetch |

No persona sets a model, so each one runs on the session's model and upgrades with it. The Claude Code plugin
ships all six, plus agentcast's own auditor and caster.

### Validator rules

Checked against Claude Code's sub-agent documentation (19 frontmatter fields, read 2026-10-19):

1. **PATH**: project personas live under `.claude/agents/`, one flat level (no `agents/agents/`)
2. **FRONTMATTER**: `name` and `description` are required; a name has no `:`, no leading `-`, at most 256 characters
3. **TOOLS**: the allowlist key is `tools`. Claude Code ignores `allowed-tools` in a sub-agent (it is the skills
   key), so a persona using it silently gets every tool
4. **VALUES**: `model` is optional (`inherit`, `sonnet`, `opus`, `haiku`, `fable` or a full ID), and
   `permissionMode`, `memory`, `effort`, `isolation`, `color` and `background` hold values Claude Code accepts

### The flat-path standard

Claude Code reads project personas from `.claude/agents/` and knows each one by its `name`. The standard keeps one
flat level, `.claude/agents/<name>.md`, so every persona is easy to find. The validator fails `agents/agents/`
nesting (the A3 mistake): outside `.claude/agents/`, Claude Code never loads those files.

### Eval rubric (5 dimensions, 0–2 each = max 10)

| Dimension | What it checks |
|-----------|----------------|
| Frontmatter completeness | `name`, `description` and a `tools` allowlist present |
| Model left to the session | No `model` line (or `inherit`) scores 2; a family alias 1; a pinned ID 0 |
| Tool minimalism | 3 tools or fewer scores 2, up to 6 scores 1; no `tools` (every tool) scores 0 |
| Output contract | Explicit output format section |
| DO NOT MODIFY guard | Read-only personas remind themselves not to write |

Passing threshold: **7/10**. Beside the rubric, `eval/golden.json` holds 12 validator verdicts that must all match
and 12 plain-language routing tasks that must land on the right persona (90% or better; 100% today).

### Dispatch, trial and memory

- `agentcast dispatch "<task>"` routes by keywords, with no model call, and prints the install command.
- `agentcast trial <file>` lists a persona's tools, permission mode and every command in its `hooks` or inline
  `mcpServers`. With `--sandbox=e2b` it writes the persona into a project inside a fresh E2B Firecracker VM, runs
  each command with a synthetic event on stdin, reports exit code and output, and kills the VM.
- `agentcast recall "<query>"` searches its memory (`identity/`), the library and the skills.
- Every command, hook and MCP call appends one line to `observability/runs.jsonl`.

Every night `.github/workflows/improve.yml` runs the tests and evals and compares the validator's fields with Claude
Code's sub-agent docs. When the docs gain or drop a field, it opens an issue with the change to make; a person
reviews and merges it.

## See Also

- **[agentgrid](https://github.com/naman10parikh/agentgrid)**: orchestration layer that consumes agentcast personas
- **[armory](https://github.com/naman10parikh/armory)**: catalog of all tools (personas are a subset)
- **[agentdial](https://github.com/naman10parikh/agentdial)**: model settings dial per task

<!-- fleet:anatomy:start -->
## What it is made of

Every project in this fleet is graded on the same 11 harness components and on self-improvement. Each mark is backed by a file you can open.

| Component | Grade | Where |
| --- | --- | --- |
| Identity | ✅ | identity/SOUL.md:3 |
| Memory | ✅ | identity/LEARNINGS.md:1 · lib/recall.mjs:48 (recall) |
| Skills | ✅ | skills/ (3 own skills) |
| Tools/CLIs | ✅ | package.json:11-12 (agentcast, agentcast-mcp) |
| Hooks | ✅ | .claude/settings.json:9 · hooks/persona-guard.mjs:1 |
| Sub-agents | ✅ | .claude/agents/persona-auditor.md:2 · persona-caster.md:2 |
| MCPs | ✅ | mcp/server.mjs:20 (4 tools) |
| Dispatch | ✅ | dispatch/dispatch.mjs:112 · .github/workflows/improve.yml:7 |
| Evals | ✅ | eval/golden.mjs:1 · .github/workflows/test.yml:18 |
| Observability | ✅ | observability/run-log.mjs:33 (run log) |
| Sandbox/Infra | ✅ | lib/trial.mjs:67 (E2B microVM) |
| Self-improvement | ✅ | dsip.json:2 · scripts/field-drift.mjs:1 (honest L2) |

✅ real and tested · 🟡 partial, with the reason in the row · ❌ absent
<!-- fleet:anatomy:end -->

<!-- fleet:footer:start -->
## How it improves itself

It carries its own evals and a self-improvement contract, [`dsip.json`](dsip.json), which says what it may change and how a change is judged. A scheduled job runs its evals and proposes fixes. A person makes every change. Lessons it learns are kept as rules in its memory files.

## Part of a fleet

One of the projects by [Naman Parikh](https://github.com/naman10parikh). Each owns one part of an agent's harness, or of the product around an agent, and all of them follow one standard.

Siblings: [agentdial](https://github.com/naman10parikh/agentdial) (identity) · [wikimem](https://github.com/naman10parikh/wikimem) (memory) · [skillsmith](https://github.com/naman10parikh/skillsmith) (skills) · [agent-booster](https://github.com/naman10parikh/agent-booster) (tools / CLIs) · [armory](https://github.com/naman10parikh/armory) (MCPs and the component registry) · [agentgrid](https://github.com/naman10parikh/agentgrid) (dispatch) · [agentswarm](https://github.com/naman10parikh/agentswarm) (dispatch) · [agentbench](https://github.com/naman10parikh/agentbench) (evals) · [agentmoney](https://github.com/naman10parikh/agentmoney) (observability) · [claude-harness](https://github.com/naman10parikh/claude-harness) (the whole harness, as a template).

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md). AI-assisted pull requests are welcome. Report a vulnerability privately, as [SECURITY.md](SECURITY.md) explains.

## License

MIT, © 2026 Naman Parikh. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
<!-- fleet:footer:end -->
