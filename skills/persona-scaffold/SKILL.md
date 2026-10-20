---
name: persona-scaffold
description: Write a new sub-agent persona for a role that passes agentcast's validator and scores at least 7 of 10. Use when a project needs an agent role the library lacks (for example data-analyst or doc-writer), or when adding a new persona to the library.
---

# Skill: persona-scaffold

Generate a new agentcast-compliant persona `.md` file for a given role. Produces a file
that passes the validator and scores ≥7/10 on the eval rubric.

## When to Use

- Adding a new role to `library/` (e.g. `data-analyst`, `doc-writer`, `perf-analyzer`)
- Dropping a persona into a project's `.claude/agents/` for a task-specific agent

## Steps

1. **Identify role** — clarify: role name, task type (read-only vs write), complexity
2. **Leave the model out** — the persona then runs on the session's model and upgrades with it. Set
   `model` only when the role truly needs a different one.
3. **Choose tools** (the key is `tools`; Claude Code ignores `allowed-tools` in a sub-agent) — minimal; read-only personas: `["Read", "Glob", "Grep", "WebSearch"]`; write personas add `"Write"` or `"Edit"` only if genuinely needed
4. **Write the persona file** using the template below
5. **Run validate + eval** to confirm it passes
   ```bash
   npx -y -p github:naman10parikh/agentcast agentcast validate --file <path>
   npx -y -p github:naman10parikh/agentcast agentcast score --file <path>
   ```
6. **If target is library** — move to `library/<name>.md` and update README table

## Template

```markdown
---
name: <role-name>
description: >
  One sentence: what this agent does and when to use it.
tools: Read, Glob, Grep
---

You are a <role> agent. <One-line mission statement>.

## Protocol

1. **Step 1** — what to do first
2. **Step 2** — ...
3. **Step 3** — ...

## Output Format

\`\`\`
## <Role>: {topic}

### Key findings
- ...

### Recommendation
- ...
\`\`\`

## Constraints

- DO NOT MODIFY FILES. <Role> and report only.
- ≤N tool calls per invocation
```

## Output

Emit the complete persona file content, then the validate + eval results.
