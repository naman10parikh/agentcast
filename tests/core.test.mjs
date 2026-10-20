import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KNOWN_FIELDS, parseFrontmatter, validateContent } from "../validator/validate.mjs";
import { evalContent, PASS_THRESHOLD } from "../eval/eval.mjs";
import { dispatch, PERSONAS } from "../dispatch/dispatch.mjs";
import { inspectPersona } from "../lib/trial.mjs";
import { recall } from "../lib/recall.mjs";

const at = "/project/.claude/agents/x.md";
const persona = (front, body = "## Output Format\n\nA table.\n") => `---\n${front}\n---\n\n${body}`;

test("validator: name and description are the only required keys", () => {
  assert.deepEqual(validateContent(persona("name: x\ndescription: d"), at), []);
  assert.match(validateContent(persona("name: x"), at).join(), /missing required key 'description'/);
});

test("validator: allowed-tools is ignored by Claude Code, so it is an error", () => {
  const errs = validateContent(persona("name: x\ndescription: d\nallowed-tools: Read"), at);
  assert.match(errs.join(), /ignores 'allowed-tools'.*every tool/);
});

test("validator: model is optional, and only real values pass", () => {
  for (const m of ["inherit", "sonnet", "opus", "haiku", "claude-opus-5-5"]) {
    assert.deepEqual(validateContent(persona(`name: x\ndescription: d\nmodel: ${m}`), at), [], m);
  }
  assert.match(validateContent(persona("name: x\ndescription: d\nmodel: gpt-4"), at).join(), /unrecognised model/);
});

test("validator: enumerated fields, names and paths", () => {
  assert.match(validateContent(persona("name: x\ndescription: d\npermissionMode: yolo"), at).join(), /permissionMode/);
  assert.match(validateContent(persona("name: a:b\ndescription: d"), at).join(), /invalid name/);
  assert.match(validateContent(persona("name: x\ndescription: d"), "/p/agents/agents/x.md").join(), /agents\/agents/);
  assert.match(validateContent(persona("name: x\ndescription: d"), "/p/docs/x.md").join(), /not under '.claude\/agents\/'/);
});

test("parser: folded descriptions and block lists", () => {
  const fm = parseFrontmatter(persona("name: x\ndescription: >\n  one\n  two\ntools:\n  - Read\n  - Grep"));
  assert.equal(fm.description, "one two");
  assert.deepEqual(fm.tools, ["Read", "Grep"]);
});

test("validator knows the 19 documented frontmatter fields", () => {
  assert.equal(KNOWN_FIELDS.length, 19);
});

test("eval: leaving the model to the session scores best; a pinned ID scores 0", () => {
  const base = "name: x\ndescription: d\ntools: Read, Grep";
  const score = (extra) => evalContent(persona(`${base}${extra}`, "## Output Format\nx\nDO NOT MODIFY FILES")).scores[1];
  assert.equal(score(""), 2);
  assert.equal(score("\nmodel: sonnet"), 1);
  assert.equal(score("\nmodel: claude-opus-5-5"), 0);
});

test("eval: no tools allowlist means every tool, which scores 0 on minimalism", () => {
  const r = evalContent(persona("name: x\ndescription: d"));
  assert.equal(r.scores[2], 0);
});

test("eval: every library persona passes", () => {
  for (const p of PERSONAS) {
    const r = evalContent(readFileSync(new URL(`../${p.file}`, import.meta.url), "utf8"));
    assert.ok(r.total >= PASS_THRESHOLD, `${p.id} scored ${r.total}`);
  }
});

test("dispatch routes plain-language tasks to the right persona", () => {
  assert.equal(dispatch("write vitest unit tests for the parser").id, "test-writer");
  assert.equal(dispatch("audit this endpoint for injection and leaked secrets").id, "security-reviewer");
  assert.equal(dispatch("zzzz qqqq"), null);
});

test("trial: inspect lists the commands a persona carries and the tools it gets", () => {
  const info = inspectPersona(readFileSync(new URL("./fixtures/carries-commands.md", import.meta.url), "utf8"));
  assert.equal(info.commands.length, 1);
  assert.equal(info.commands[0].from, "hooks");
  assert.deepEqual(info.tools, ["Read", "Bash"]);
  assert.match(inspectPersona(persona("name: x\ndescription: d")).notes.join(), /every tool/);
});

test("recall finds the lesson about allowed-tools", () => {
  const hits = recall("allowed-tools ignored");
  assert.ok(hits.some((h) => h.file === "identity/LEARNINGS.md"), JSON.stringify(hits.map((h) => h.file)));
});
