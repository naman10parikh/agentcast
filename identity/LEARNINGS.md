# agentcast — Learnings

Corrections that became rules. Newest first. Each line: what went wrong, the rule now, and where it is enforced.

## 2026-10-19

- **`allowed-tools` is ignored in a sub-agent.** Every June persona used `allowed-tools`, the skills key, so each
  one silently had every tool. Rule: the allowlist key is `tools`; the validator fails `allowed-tools`
  (`validator/validate.mjs`) and the eval scores a persona with no `tools` 0 on minimalism.
- **Only `name` and `description` are required.** The June validator also required `model` and `allowed-tools`.
  Rule: required keys follow the documented frontmatter table; `scripts/field-drift.mjs` compares the validator's
  19 fields with the docs every night and opens an issue on drift.
- **Leave the model to the session.** Pinned models freeze and family aliases override the session's choice.
  Rule: library personas carry no `model` line; the eval scores no model (or `inherit`) 2, an alias 1, a full ID 0.
- **A persona can carry commands.** `hooks` and inline `mcpServers` in its frontmatter run shell commands while it
  works. Rule: `agentcast trial` lists them before install, and runs them in an E2B microVM with `--sandbox=e2b`.
- **Hooks read the event from stdin.** The June hooks passed `$CLAUDE_TOOL_INPUT_COMMAND`, which does not exist,
  so the run log recorded nothing. Rule: `observability/run-log.mjs` reads `tool_input` from stdin.
- **Absolute paths break for everyone else.** Commands pointed at one machine's home folder. Rule: use
  `npx -y -p github:naman10parikh/agentcast agentcast ...`, `"$CLAUDE_PROJECT_DIR"` or `"${CLAUDE_PLUGIN_ROOT}"`.
