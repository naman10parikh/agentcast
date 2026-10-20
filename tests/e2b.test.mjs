import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { trialInE2B } from "../lib/trial.mjs";

const fixture = readFileSync(new URL("./fixtures/carries-commands.md", import.meta.url), "utf8");

test("trial without E2B_API_KEY refuses cleanly", async () => {
  const saved = process.env.E2B_API_KEY;
  delete process.env.E2B_API_KEY;
  try {
    assert.match((await trialInE2B(fixture)).error, /E2B_API_KEY/);
  } finally {
    if (saved !== undefined) process.env.E2B_API_KEY = saved;
  }
});

test("trial runs a persona's hook command inside a live E2B microVM", { skip: !process.env.E2B_API_KEY && "no E2B_API_KEY" }, async () => {
  const r = await trialInE2B(fixture);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.results[0].exitCode, 2);
  assert.match(r.results[0].stdout, /checked-by-persona-hook/);
  assert.ok(r.coldStartMs > 0);
});
