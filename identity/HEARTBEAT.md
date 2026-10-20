# agentcast — Heartbeat

## Schedule

| Check | Frequency | Action on anomaly |
|-------|-----------|-------------------|
| Tests, validator and evals over the library | Every pull request (`test.yml`) | Red check blocks the merge |
| Tests and evals again | Nightly (`improve.yml`) | The run fails red; fix before anything else |
| Frontmatter fields vs Claude Code's docs | Nightly (`improve.yml`) | `scripts/field-drift.mjs` opens an issue with the change |
| Persona written by an agent | On every Write or Edit (`hooks/persona-guard.mjs`) | The agent is told what to fix |

## Health indicators

- **Healthy:** last nightly run green, every library persona valid and at 7 or more, routing goldens at 100%
- **Warning:** an open drift issue, or a library persona below 9
- **Critical:** the validator or the eval fails on the library, or a routing golden misses

## Recovery

1. Read the failed step of the last `improve.yml` or `test.yml` run, and the last lines of `observability/runs.jsonl`
2. If Claude Code changed its sub-agent fields: update `KNOWN_FIELDS` and the checks in `validator/validate.mjs`
3. If a persona fails: fix it in `library/`, then `npm run eval`
4. If unfixable: open a GitHub issue naming the persona or field
