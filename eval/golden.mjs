#!/usr/bin/env node
/**
 * agentcast golden eval — the cases agentcast must keep getting right (eval/golden.json):
 *   1. validator verdicts on known-good and known-bad personas (every case must match)
 *   2. routing: plain-language tasks to the persona that should take them (accuracy ≥ routing_threshold)
 * Runs in under a second, calls no model. Exit 0 = pass. `--json` prints the scores.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { validateContent } from "../validator/validate.mjs";
import { dispatch } from "../dispatch/dispatch.mjs";

const golden = JSON.parse(readFileSync(new URL("./golden.json", import.meta.url), "utf8"));
const failures = [];

for (const c of golden.validator) {
  const errors = validateContent(c.content, resolve("/golden", c.path));
  const valid = errors.length === 0;
  const ok = valid === c.valid && (!c.error || errors.some((e) => e.includes(c.error)));
  if (!ok) failures.push(`validator: ${c.case} → ${valid ? "valid" : errors.join("; ")}`);
}

let routed = 0;
for (const r of golden.routing) {
  const got = dispatch(r.task)?.id ?? "none";
  if (got === r.expect) routed++;
  else failures.push(`routing: "${r.task}" → ${got} (expected ${r.expect})`);
}
const accuracy = routed / golden.routing.length;
const validatorOk = !failures.some((f) => f.startsWith("validator:"));
const pass = validatorOk && accuracy >= golden.routing_threshold;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ pass, validator: { cases: golden.validator.length, ok: validatorOk }, routing: { cases: golden.routing.length, accuracy } }));
} else {
  console.log(`agentcast golden eval: validator ${golden.validator.length} cases ${validatorOk ? "all match" : "MISMATCH"}; ` +
    `routing ${routed}/${golden.routing.length} (${Math.round(accuracy * 100)}%, needs ${Math.round(golden.routing_threshold * 100)}%)`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(pass ? "PASS" : "FAIL");
}
process.exit(pass ? 0 : 1);
