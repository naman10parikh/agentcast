---
name: persona-validate
description: Validate and score sub-agent persona files against what Claude Code reads today (name and description, the tools allowlist rather than allowed-tools, valid model and permission values, the .claude/agents/ path). Use before committing a persona, after editing frontmatter, or as a pre-merge check for any repository with a .claude/agents/ folder.
---

# Skill: persona-validate

Validate one or more `.claude/agents/` persona files using the agentcast validator and eval.

## When to Use

- Before committing a new persona to `library/` or a project's `.claude/agents/`
- When adding or editing frontmatter on an existing persona
- As a pre-PR check for any repo that has a `.claude/agents/` directory

## Steps

1. **Locate files** — determine whether target is `--library`, `--dir <path>`, or `--file <path>`
2. **Run validator**
   ```bash
   npx -y -p github:naman10parikh/agentcast agentcast validate --library
   # or
   npx -y -p github:naman10parikh/agentcast agentcast validate --dir ./.claude/agents
   # or
   npx -y -p github:naman10parikh/agentcast agentcast validate --file ./.claude/agents/<name>.md
   ```
3. **Run eval** (score must be ≥7/10)
   ```bash
   npx -y -p github:naman10parikh/agentcast agentcast score --library
   # or same --dir / --file variants
   ```
4. **Report results** — pass/fail per file, any errors, any scores below threshold
5. **If failures** — list exact fix for each: missing frontmatter key, `allowed-tools` instead of `tools`, an invalid model or permission value, no output format.

## Output

```
## persona-validate: {target}

### Validator
| File | Status | Errors |
|------|--------|--------|
| name.md | PASS | — |

### Eval Scores
| File | Score | Notes |
|------|-------|-------|
| name.md | 8/10 | ... |

### Action Required
- [ ] Fix X in Y
```

Pass = all files PASS validator + all scores ≥7. Exit 0 = skill complete.
