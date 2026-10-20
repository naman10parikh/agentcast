#!/usr/bin/env node
/**
 * agentcast — cast the right sub-agent for every role.
 *
 *   agentcast list | show <id> | add <id> | validate | score | dispatch "<task>" | trial <file|id> | recall "<q>"
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { LIBRARY_DIR, collectMarkdownFiles, parseFrontmatter, validateFile, main as validateMain } from "../validator/validate.mjs";
import { main as scoreMain } from "../eval/eval.mjs";
import { main as dispatchMain } from "../dispatch/dispatch.mjs";
import { inspectPersona, trialInE2B } from "../lib/trial.mjs";
import { recall } from "../lib/recall.mjs";
import { logRun } from "../observability/run-log.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const positional = rest.filter((a) => !a.startsWith("--"));

const HELP = `agentcast ${VERSION} — reusable sub-agent personas for Claude Code, validated and scored

Usage:
  agentcast list                          the library: id, what it does, its tools
  agentcast show <id>                     print a library persona
  agentcast add <id> [--dir=.claude/agents] [--force]
                                          copy a persona into a project, then validate it
  agentcast validate [--dir <path> | --file <path> | --library]
                                          check personas against what Claude Code reads
  agentcast score [--dir <path> | --file <path> | --library]
                                          score personas on a 10-point rubric (pass at 7)
  agentcast dispatch [--json] "<task>"    pick the best persona for a task
  agentcast trial <file|id> [--sandbox=e2b] [--json]
                                          list what a persona can do; with E2B, run the commands it carries
  agentcast recall "<query>"              search agentcast's own memory and library
  agentcast --version | --help

MCP server: agentcast-mcp (persona_dispatch, persona_get, persona_validate, persona_score)`;

function libraryPersonas() {
  return collectMarkdownFiles(LIBRARY_DIR).map((file) => {
    const fm = parseFrontmatter(readFileSync(file, "utf8"));
    return { id: basename(file, ".md"), file, description: String(fm.description ?? ""), tools: fm.tools };
  });
}

function personaPath(idOrFile) {
  if (idOrFile && existsSync(idOrFile)) return resolve(idOrFile);
  const lib = join(LIBRARY_DIR, `${idOrFile}.md`);
  return existsSync(lib) ? lib : null;
}

async function run() {
  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    console.log(HELP);
    return 0;
  }
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return 0;
  }
  if (cmd === "list") {
    const all = libraryPersonas();
    for (const p of all) {
      const tools = Array.isArray(p.tools) ? p.tools.join(", ") : p.tools ?? "every tool";
      console.log(`${p.id.padEnd(20)} ${p.description === "(block)" ? "" : p.description}`.trimEnd());
      console.log(`${"".padEnd(20)} tools: ${tools}`);
    }
    logRun("list", { personas: all.length });
    return 0;
  }
  if (cmd === "show") {
    const path = personaPath(positional[0]);
    if (!path) {
      console.error(`agentcast: no persona '${positional[0] ?? ""}'. Run: agentcast list`);
      return 1;
    }
    process.stdout.write(readFileSync(path, "utf8"));
    return 0;
  }
  if (cmd === "add") {
    const id = positional[0];
    const src = id ? join(LIBRARY_DIR, `${id}.md`) : "";
    if (!id || !existsSync(src)) {
      console.error(`agentcast: no library persona '${id ?? ""}'. Run: agentcast list`);
      return 1;
    }
    const dir = resolve(flag("dir") ?? ".claude/agents");
    const dest = join(dir, `${id}.md`);
    if (existsSync(dest) && !rest.includes("--force")) {
      console.error(`agentcast: ${dest} exists; pass --force to replace it`);
      return 1;
    }
    mkdirSync(dir, { recursive: true });
    copyFileSync(src, dest);
    const errors = validateFile(dest);
    logRun("add", { id, errors: errors.length });
    console.log(`added ${id} → ${dest}`);
    for (const e of errors) console.log(`  → ${e}`);
    if (errors.length === 0) console.log("  valid: Claude Code will offer it as a sub-agent in this project");
    return errors.length === 0 ? 0 : 1;
  }
  if (cmd === "validate") {
    const code = validateMain(rest);
    logRun("validate", { args: rest.join(" "), exit: code });
    return code;
  }
  if (cmd === "score" || cmd === "eval") {
    const code = scoreMain(rest);
    logRun("score", { args: rest.join(" "), exit: code });
    return code;
  }
  if (cmd === "dispatch") {
    const code = dispatchMain(rest);
    logRun("dispatch", { matched: code === 0 });
    return code;
  }
  if (cmd === "trial") {
    const path = personaPath(positional[0]);
    if (!path) {
      console.error(`agentcast: no persona '${positional[0] ?? ""}' (a file path or a library id)`);
      return 1;
    }
    const content = readFileSync(path, "utf8");
    const info = inspectPersona(content);
    const sandbox = flag("sandbox") === "e2b";
    const trial = sandbox ? await trialInE2B(content) : null;
    logRun("trial", { persona: info.name, commands: info.commands.length, sandbox: sandbox ? "e2b" : "none", ...(trial?.coldStartMs ? { coldStartMs: trial.coldStartMs } : {}) });
    if (rest.includes("--json")) {
      console.log(JSON.stringify({ ...info, ...(trial ? { trial } : {}) }, null, 2));
      return trial && !trial.ok ? 1 : 0;
    }
    if (info.error) {
      console.error(`agentcast trial: ${info.error}`);
      return 1;
    }
    console.log(`${info.name}`);
    console.log(`  tools: ${info.tools ? info.tools.join(", ") : "every tool"}`);
    console.log(`  permission mode: ${info.permissionMode} · model: ${info.model}`);
    console.log(`  commands it carries: ${info.commands.length}`);
    for (const c of info.commands) console.log(`    [${c.from}] ${c.command}`);
    for (const n of info.notes) console.log(`  note: ${n}`);
    if (!sandbox) {
      if (info.commands.length) console.log("  run them in a microVM, not here: agentcast trial <file> --sandbox=e2b");
      return 0;
    }
    if (!trial.ok) {
      console.log(`  e2b: ${trial.error}`);
      return 1;
    }
    if (trial.note) console.log(`  e2b: ${trial.note}`);
    else console.log(`  e2b: microVM up in ${trial.coldStartMs} ms`);
    for (const r of trial.results) {
      const out = (r.stderr || r.stdout || r.error || "").trim().split("\n")[0];
      console.log(`    [${r.from}] exit=${r.exitCode ?? "none"} (${r.ms} ms) ${r.command}${out ? `\n      ${out}` : ""}`);
    }
    return 0;
  }
  if (cmd === "recall") {
    const query = positional.join(" ");
    if (!query) {
      console.error('usage: agentcast recall "<query>"');
      return 2;
    }
    const hits = recall(query);
    for (const h of hits) console.log(`### ${h.heading}  (${h.file})\n${h.snippet}\n`);
    if (hits.length === 0) console.log("no match");
    logRun("recall", { hits: hits.length });
    return 0;
  }
  console.error(`agentcast: unknown command '${cmd}'\n\n${HELP}`);
  return 2;
}

run().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`agentcast: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
