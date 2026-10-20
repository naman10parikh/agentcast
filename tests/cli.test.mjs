import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = (args, opts = {}) => spawnSync("node", [join(root, "bin/agentcast.mjs"), ...args], { encoding: "utf8", ...opts });

test("cli: --version and --help", () => {
  assert.equal(cli(["--version"]).stdout.trim(), JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version);
  assert.match(cli(["--help"]).stdout, /agentcast add <id>/);
});

test("cli: add installs a valid persona and will not overwrite it", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentcast-add-"));
  const first = cli(["add", "code-reviewer"], { cwd: dir });
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.match(readFileSync(join(dir, ".claude/agents/code-reviewer.md"), "utf8"), /name: code-reviewer/);
  assert.equal(cli(["add", "code-reviewer"], { cwd: dir }).status, 1);
  assert.equal(cli(["add", "code-reviewer", "--force"], { cwd: dir }).status, 0);
});

test("cli: validate fails a persona with allowed-tools", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentcast-val-"));
  mkdirSync(join(dir, ".claude/agents"), { recursive: true });
  writeFileSync(join(dir, ".claude/agents/bad.md"), "---\nname: bad\ndescription: d\nallowed-tools: Read\n---\nx\n");
  const r = cli(["validate", "--dir", join(dir, ".claude/agents")]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /allowed-tools/);
});

test("hook: the persona guard reports a broken persona (exit 2) and ignores other files", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentcast-guard-"));
  mkdirSync(join(dir, ".claude/agents"), { recursive: true });
  const bad = join(dir, ".claude/agents/bad.md");
  writeFileSync(bad, "---\nname: bad\n---\nx\n");
  const guard = (file) => spawnSync("node", [join(root, "hooks/persona-guard.mjs")], { input: JSON.stringify({ tool_input: { file_path: file } }), encoding: "utf8" });
  const r = guard(bad);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /missing required key 'description'/);
  assert.equal(guard(join(dir, "README.md")).status, 0);
});

test("mcp: agentcast-mcp lists 4 tools and validates over stdio", () => {
  const calls = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "persona_validate", arguments: { content: "---\nname: x\ndescription: d\ntools: Read\n---\nok" } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "persona_dispatch", arguments: { task: "write unit tests" } } },
  ];
  const r = spawnSync("node", [join(root, "mcp/server.mjs")], { input: calls.map((c) => JSON.stringify(c)).join("\n") + "\n", encoding: "utf8" });
  const replies = new Map(r.stdout.trim().split("\n").map((l) => JSON.parse(l)).map((m) => [m.id, m]));
  assert.deepEqual(replies.get(2).result.tools.map((t) => t.name), ["persona_dispatch", "persona_get", "persona_validate", "persona_score"]);
  assert.equal(JSON.parse(replies.get(3).result.content[0].text).valid, true);
  assert.equal(JSON.parse(replies.get(4).result.content[0].text).match.id, "test-writer");
});
