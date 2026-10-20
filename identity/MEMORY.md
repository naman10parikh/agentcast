# agentcast — Memory

## Bootstrap (loaded every cycle)

- Job: keep a library of reusable sub-agent personas, and check any persona against what Claude Code reads
- Created: 2026-06-03. Brought to the fleet standard: 2026-10-19
- Search this memory, the library and the skills: `agentcast recall "<query>"`
- Corrections that became rules: `identity/LEARNINGS.md`
- Health: the nightly improve run, and `observability/runs.jsonl` (one line per command, hook and MCP call)

## What Claude Code reads in a sub-agent file (2026-10-19)

- Where: `.claude/agents/` in a project, `~/.claude/agents/` for a user, `agents/` in a plugin. Subfolders are
  scanned; the `name` field, not the file name, is the identity.
- Required: `name` (no `:`, no leading `-`, at most 256 characters) and `description` (when to delegate).
- Tools: `tools` is the allowlist, `disallowedTools` the denylist. No `tools` line means every tool.
  `allowed-tools` belongs to skills; in a sub-agent it is ignored.
- Model: optional. Left out, the persona runs on the session's model. Values: `inherit`, `sonnet`, `opus`,
  `haiku`, `fable` or a full model ID.
- 19 documented fields in all (`KNOWN_FIELDS` in `validator/validate.mjs`); `permissionMode`, `hooks`,
  `mcpServers` and `initialPrompt` are ignored when the persona ships inside a plugin.

## The library

| Persona | Job | Tools |
|---------|-----|-------|
| researcher | multi-source web and codebase research | Read, Glob, Grep, WebSearch, WebFetch, Bash |
| code-reviewer | correctness, security, TypeScript, architecture review | Read, Glob, Grep |
| test-writer | Vitest unit and integration tests | Read, Glob, Grep, Write, Edit |
| security-reviewer | injection, auth, CORS, secrets audit | Read, Glob, Grep |
| architect | trade-offs and system design | Read, Glob, Grep, WebSearch, WebFetch |
| qa-tester | user-perspective end-to-end QA and bug reports | Read, Glob, Grep, Bash, WebFetch |
