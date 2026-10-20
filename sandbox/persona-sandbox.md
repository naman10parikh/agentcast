# agentcast Sandbox — Persona Testing Template

> How to test a new persona in isolation before dropping it into a live project.

## Why a Sandbox

A persona is code: it defines allowed tools, output format, and behavior constraints.
Testing it in a scratch directory before deploying prevents broken personas from
reaching a project's `.claude/agents/` directory.

## Setup (one-time)

```bash
mkdir -p /tmp/agentcast-sandbox/.claude/agents
```

## Test a Specific Persona

```bash
# 1. Drop the persona under test into the sandbox agents dir
cd /tmp/agentcast-sandbox
npx -y -p github:naman10parikh/agentcast agentcast add <name>      # a library persona
# or: cp ./my-persona.md .claude/agents/my-persona.md                 # your own

# 2. Validate it (must pass)
npx -y -p github:naman10parikh/agentcast agentcast validate --file .claude/agents/<name>.md

# 3. Score it (must score ≥7)
npx -y -p github:naman10parikh/agentcast agentcast score --file .claude/agents/<name>.md

# 4. (Optional) Dispatch smoke test — does the persona get routed correctly?
npx -y -p github:naman10parikh/agentcast agentcast dispatch "<describe a task this persona should handle>"
```

## Run a Persona's Own Commands in a MicroVM

A persona's frontmatter can carry `hooks` and inline `mcpServers`, which run shell commands. Before you install
one you did not write, list them, then run them inside a fresh E2B Firecracker VM instead of on your machine:

```bash
npx -y -p github:naman10parikh/agentcast agentcast trial ./their-persona.md                 # list only
npx -y -p github:naman10parikh/agentcast agentcast trial ./their-persona.md --sandbox=e2b   # needs E2B_API_KEY
```

The trial writes the persona into a project inside the VM, runs each command with a synthetic event on stdin,
prints its exit code and first line of output, and kills the VM.

## Smoke Checklist

Before promoting a new persona from sandbox to `library/`:

- [ ] Validator exits 0
- [ ] Eval score ≥7/10
- [ ] `dispatch.mjs` routes a representative task to this persona (not another)
- [ ] Persona file is ≤100 lines
- [ ] `tools` list contains only what the persona genuinely uses (not `allowed-tools`, which Claude Code ignores here)
- [ ] Read-only personas: `DO NOT MODIFY FILES` present in body
- [ ] `## Output Format` section present and concrete

## Cleanup

```bash
rm -rf /tmp/agentcast-sandbox
```

## CI Integration (optional)

This repository's `.github/workflows/test.yml` runs these on every push and pull request:

```yaml
- name: Validate agentcast library
  run: node validator/validate.mjs --library

- name: Run agentcast eval
  run: npm run eval
```

Both must exit 0 for the PR to merge.
