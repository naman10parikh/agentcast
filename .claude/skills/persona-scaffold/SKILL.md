---
name: persona-scaffold
trigger: "scaffold persona|create persona|new persona|add persona|generate agent persona"
model: sonnet
effort: low
---

# Skill: persona-scaffold

Generate a new agentcast-compliant persona `.md` file for a given role. Produces a file
that passes the validator and scores ≥7/10 on the eval rubric.

## When to Use

- Adding a new role to `library/` (e.g. `data-analyst`, `doc-writer`, `perf-analyzer`)
- Dropping a persona into a project's `.claude/agents/` for a task-specific agent

## Steps

1. **Identify role** — clarify: role name, task type (read-only vs write), complexity
2. **Choose model tier**
   - read-only + simple → `haiku`
   - analysis / review → `sonnet`
   - complex architecture reasoning → `sonnet` (not opus — budget)
3. **Choose tools** — minimal; read-only personas: `["Read", "Glob", "Grep", "WebSearch"]`; write personas add `"Write"` or `"Edit"` only if genuinely needed
4. **Write the persona file** using the template below
5. **Run validate + eval** to confirm it passes
   ```bash
   node ~/agentcast/validator/validate.mjs --file <path>
   node ~/agentcast/eval/eval.mjs --file <path>
   ```
6. **If target is library** — move to `library/<name>.md` and update README table

## Template

```markdown
---
name: <role-name>
description: >
  One sentence: what this agent does and when to use it.
model: sonnet
allowed-tools: ["Read", "Glob", "Grep"]
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

## Output Format

Emit the complete persona file content, then the validate + eval results.
