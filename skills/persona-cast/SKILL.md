---
name: persona-cast
description: Cast the right sub-agent for a job, install it into a project's .claude/agents/, and prove it is valid, after first checking what an outside persona can do. Use when a task would go better with a specialist (a reviewer, a test writer, a researcher), when setting up a new project's sub-agents, or before installing a persona someone else wrote.
---

# Skill: persona-cast

## Trigger

Use when:
- A task needs a specialist sub-agent and the project has none for it
- A new project should start with a small, sound set of sub-agents
- Someone hands you a persona file and you want to know what it can do before you install it

## Steps

1. **Pick the persona for the job.** Describe the task in plain words:
   ```bash
   npx -y -p github:naman10parikh/agentcast agentcast dispatch "review this diff for injection and auth bugs"
   ```
   It names the best library persona (`security-reviewer` here) and the command that installs it. Run
   `agentcast list` to see the whole library with each persona's tools.

2. **Install it into the project.** From the project root:
   ```bash
   npx -y -p github:naman10parikh/agentcast agentcast add security-reviewer
   ```
   It copies `library/security-reviewer.md` to `.claude/agents/security-reviewer.md` and validates the copy.
   An existing file is kept unless you pass `--force`.

3. **Check a persona you did not write before installing it.**
   ```bash
   npx -y -p github:naman10parikh/agentcast agentcast trial ./their-persona.md
   ```
   It lists the tools the persona gets (no `tools` line means every tool), its permission mode, and every command
   it carries in `hooks` or `mcpServers`. If it carries commands, run them in a microVM instead of here:
   `agentcast trial ./their-persona.md --sandbox=e2b` (needs `E2B_API_KEY`).

4. **Score what you installed.**
   ```bash
   npx -y -p github:naman10parikh/agentcast agentcast score --dir .claude/agents
   ```
   Below 7 of 10: tighten `tools`, add an output section, or add the "DO NOT MODIFY" line to a read-only persona.

5. **Use it.** Claude Code offers project sub-agents from `.claude/agents/` in the next session, or ask for it by
   name: "use the security-reviewer sub-agent on this diff".

## Output

```
cast: security-reviewer → .claude/agents/security-reviewer.md
  valid: yes · score: 10/10 · tools: Read, Glob, Grep
  trial: no commands carried
```

## Notes

- Personas leave `model` out on purpose, so they run on the session's model and upgrade with it.
- The library is plain Markdown; `agentcast show <id>` prints one, and MCP clients get the same through the
  `persona_dispatch`, `persona_get`, `persona_validate` and `persona_score` tools of `agentcast-mcp`.
- Every command appends one line to agentcast's `observability/runs.jsonl`.
