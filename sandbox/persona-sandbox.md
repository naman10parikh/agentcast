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
cp ~/agentcast/library/<name>.md /tmp/agentcast-sandbox/.claude/agents/<name>.md

# 2. Validate it (must pass)
node ~/agentcast/validator/validate.mjs \
  --file /tmp/agentcast-sandbox/.claude/agents/<name>.md

# 3. Eval it (must score ≥7)
node ~/agentcast/eval/eval.mjs \
  --file /tmp/agentcast-sandbox/.claude/agents/<name>.md

# 4. (Optional) Dispatch smoke test — does the persona get routed correctly?
node ~/agentcast/dispatch/dispatch.mjs "<describe a task this persona should handle>"
```

## Smoke Checklist

Before promoting a new persona from sandbox to `library/`:

- [ ] Validator exits 0
- [ ] Eval score ≥7/10
- [ ] `dispatch.mjs` routes a representative task to this persona (not another)
- [ ] Persona file is ≤100 lines
- [ ] `allowed-tools` list contains only what the persona genuinely uses
- [ ] Read-only personas: `DO NOT MODIFY FILES` present in body
- [ ] `## Output Format` section present and concrete

## Cleanup

```bash
rm -rf /tmp/agentcast-sandbox
```

## CI Integration (optional)

Add to `.github/workflows/ci.yml`:

```yaml
- name: Validate agentcast library
  run: node validator/validate.mjs --library

- name: Eval agentcast library
  run: node eval/eval.mjs --library
```

Both must exit 0 for the PR to merge.
