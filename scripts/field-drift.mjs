#!/usr/bin/env node
// agentcast's improvement signal: compare the sub-agent frontmatter fields the validator knows with the fields
// in Claude Code's own documentation (the Markdown version of the sub-agents page). A documented field the
// validator lacks means agentcast cannot check it, so it becomes a proposal.
//   node scripts/field-drift.mjs [--out proposal.md]
// Exit 0: no drift. Exit 3: drift found (proposal written). Exit 1: the check itself failed.
import { writeFileSync } from "node:fs";
import { KNOWN_FIELDS } from "../validator/validate.mjs";

const DOCS = "https://code.claude.com/docs/en/sub-agents.md";
const res = await fetch(DOCS);
if (!res.ok) {
  console.error(`field-drift: ${DOCS} answered ${res.status}`);
  process.exit(1);
}
const lines = (await res.text()).split("\n");
const header = lines.findIndex((l) => /^\|\s*Field\s*\|\s*Required\s*\|/.test(l));
if (header < 0) {
  console.error("field-drift: no '| Field | Required |' table on the page; its shape changed, so read it by hand");
  process.exit(1);
}
const documented = [];
for (const l of lines.slice(header + 2)) {
  const m = l.match(/^\|\s*`([A-Za-z]+)`\s*\|/);
  if (!m) break;
  documented.push(m[1]);
}
const missing = documented.filter((f) => !KNOWN_FIELDS.includes(f));
const gone = KNOWN_FIELDS.filter((f) => !documented.includes(f));
console.log(`field-drift: docs ${documented.length} fields, validator ${KNOWN_FIELDS.length}; new ${missing.join(", ") || "none"}; no longer documented ${gone.join(", ") || "none"}`);
if (missing.length === 0 && gone.length === 0) process.exit(0);

const proposal = [
  "Claude Code's sub-agent documentation and agentcast's validator disagree on the frontmatter fields.",
  "",
  ...(missing.length ? ["Documented, but unknown to `KNOWN_FIELDS` in `validator/validate.mjs`:", "", ...missing.map((f) => `- \`${f}\``), ""] : []),
  ...(gone.length ? ["In `KNOWN_FIELDS`, but no longer documented:", "", ...gone.map((f) => `- \`${f}\``), ""] : []),
  "Proposed change: update `KNOWN_FIELDS`, add a value check where the docs list allowed values, add a golden",
  "case per field in `eval/golden.json`, and update `identity/MEMORY.md`.",
  "",
  `Source: ${DOCS}. Opened by the nightly improvement loop (.github/workflows/improve.yml); a person merges.`,
].join("\n");
const out = process.argv.indexOf("--out");
if (out > 0 && process.argv[out + 1]) writeFileSync(process.argv[out + 1], proposal + "\n");
else console.log(proposal);
process.exit(3);
