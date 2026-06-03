---
name: persona-validate
trigger: "validate persona|validate agent|check persona|audit personas|validate .claude/agents"
model: haiku
effort: low
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
   node ~/agentcast/validator/validate.mjs --library
   # or
   node ~/agentcast/validator/validate.mjs --dir ./.claude/agents
   # or
   node ~/agentcast/validator/validate.mjs --file ./.claude/agents/<name>.md
   ```
3. **Run eval** (score must be ≥7/10)
   ```bash
   node ~/agentcast/eval/eval.mjs --library
   # or same --dir / --file variants
   ```
4. **Report results** — pass/fail per file, any errors, any scores below threshold
5. **If failures** — list exact fix for each: missing frontmatter key, wrong model, no output format, etc.

## Output Format

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
