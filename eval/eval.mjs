#!/usr/bin/env node
/**
 * agentcast eval
 *
 * Measures persona quality against a rubric. Does NOT call an LLM —
 * it is a static structural eval that runs in <1s and costs $0.
 *
 * Rubric (5 dimensions, each 0–2 points):
 *   1. Frontmatter completeness  — name, description and a `tools` allowlist present + non-empty
 *   2. Model left to the session — no `model` (or `inherit`) scores 2; a family alias 1; a pinned ID 0
 *   3. Tool minimalism           — the `tools` list is minimal (≤3 best, ≤6 fine; none = every tool)
 *   4. Output contract           — file defines an explicit output format
 *   5. DO NOT MODIFY guard       — read-only personas say "DO NOT MODIFY"
 *
 * Score: 0–10. Passing threshold: ≥7
 *
 * Usage:
 *   node eval/eval.mjs --library          # eval all library personas
 *   node eval/eval.mjs --file <path>      # eval a single file
 *   node eval/eval.mjs --dir <path>       # eval all .md files in a dir
 */

import { readFileSync, readdirSync, realpathSync, statSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const REQUIRED_KEYS = ["name", "description", "tools"];
export const PASS_THRESHOLD = 7;

// Tools that should NOT be in read-only personas
const WRITE_TOOLS = ["Write", "Edit", "Bash", "MultiEdit"];

// Family aliases follow the session's model within their family; a full ID is pinned and never upgrades
const MODEL_ALIASES = ["sonnet", "opus", "haiku", "fable"];

export function parseFrontmatter(content) {
  const lines = content.split("\n");
  if (lines[0].trim() !== "---") return null;
  const closeIdx = lines.slice(1).findIndex((l) => l.trim() === "---");
  if (closeIdx === -1) return null;
  const fmLines = lines.slice(1, closeIdx + 1);
  const result = {};
  for (const line of fmLines) {
    const match = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, key, rawVal] = match;
    const arrMatch = rawVal.trim().match(/^\[(.+)\]$/);
    if (arrMatch) {
      result[key] = arrMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    } else {
      result[key] = rawVal.trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

export function evalFile(filePath) {
  return evalContent(readFileSync(resolve(filePath), "utf8"));
}

/** Score persona text against the rubric. */
export function evalContent(content) {
  const fm = parseFrontmatter(content);
  const scores = [];
  const notes = [];

  // ── Dimension 1: Frontmatter completeness (0–2) ──────────────────────────
  if (!fm) {
    scores.push(0);
    notes.push("FM: no valid frontmatter");
  } else {
    const missing = REQUIRED_KEYS.filter((k) => !fm[k] || fm[k].length === 0);
    if (missing.length === 0) {
      scores.push(2);
      notes.push("FM: all required keys present ✓");
    } else if (missing.length <= 1) {
      scores.push(1);
      notes.push(`FM: missing key '${missing[0]}'`);
    } else {
      scores.push(0);
      notes.push(`FM: missing keys ${missing.join(", ")}`);
    }
  }

  // ── Dimension 2: Model left to the session (0–2) ─────────────────────────
  const model = fm?.model ?? "";
  const tools = fm?.tools ?? [];
  const toolList = (Array.isArray(tools) ? tools : String(tools).split(",")).map((t) => t.trim()).filter(Boolean);

  if (!model || model === "inherit") {
    scores.push(2);
    notes.push("MODEL: left to the session (upgrades with it) ✓");
  } else if (MODEL_ALIASES.includes(model)) {
    scores.push(1);
    notes.push(`MODEL: '${model}' overrides the session's choice — leave it out unless the role needs it`);
  } else {
    scores.push(0);
    notes.push(`MODEL: '${model}' is pinned and never upgrades — leave it out`);
  }

  // ── Dimension 3: Tool minimalism (0–2) ───────────────────────────────────
  const toolCount = toolList.length;
  if (toolCount === 0) {
    scores.push(0);
    notes.push("TOOLS: no 'tools' allowlist, so the persona inherits every tool — list only what it uses");
  } else if (toolCount <= 3) {
    scores.push(2);
    notes.push(`TOOLS: minimal (${toolCount} tools) ✓`);
  } else if (toolCount <= 6) {
    scores.push(1);
    notes.push(`TOOLS: acceptable (${toolCount} tools)`);
  } else {
    scores.push(0);
    notes.push(`TOOLS: too many (${toolCount} > 6) — trim to principle of least privilege`);
  }

  // ── Dimension 4: Output contract (0–2) ───────────────────────────────────
  const hasOutputFormat =
    content.includes("## Output") ||
    content.includes("## Output Format") ||
    content.includes("Output Format") ||
    content.includes("```\n##") ||
    content.includes("Output contract");
  if (hasOutputFormat) {
    scores.push(2);
    notes.push("CONTRACT: output format defined ✓");
  } else {
    scores.push(0);
    notes.push("CONTRACT: no explicit output format — add '## Output Format' section");
  }

  // ── Dimension 5: DO NOT MODIFY guard for read-only personas (0–2) ────────
  const isReadOnlyPersona = !toolList.some((t) => WRITE_TOOLS.includes(t));
  if (isReadOnlyPersona) {
    if (content.includes("DO NOT MODIFY") || content.includes("Do NOT MODIFY")) {
      scores.push(2);
      notes.push("GUARD: DO NOT MODIFY present on read-only persona ✓");
    } else {
      scores.push(1);
      notes.push(
        "GUARD: read-only persona should include 'DO NOT MODIFY FILES' reminder"
      );
    }
  } else {
    // Write persona — no guard needed
    scores.push(2);
    notes.push("GUARD: write persona (guard not required) ✓");
  }

  const total = scores.reduce((a, b) => a + b, 0);
  return { total, max: 10, scores, notes, pass: total >= PASS_THRESHOLD };
}

function collectMarkdownFiles(dir) {
  const files = [];
  for (const entry of readdirSync(resolve(dir))) {
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...collectMarkdownFiles(full));
    else if (entry.endsWith(".md")) files.push(full);
  }
  return files;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
/** Run the eval CLI with `args`; returns the exit code. */
export function main(args = process.argv.slice(2)) {
  let files = [];

  if (args.includes("--library")) {
    const libDir = resolve(dirname(fileURLToPath(import.meta.url)), "../library");
    files = collectMarkdownFiles(libDir);
  } else if (args.includes("--file")) {
    files = [args[args.indexOf("--file") + 1]];
  } else if (args.includes("--dir")) {
    files = collectMarkdownFiles(args[args.indexOf("--dir") + 1]);
  } else {
    console.error("Usage: agentcast score [--library] [--file <path>] [--dir <path>]");
    return 1;
  }

  console.log(`\n${BOLD}agentcast eval${RESET} — rubric scoring (${files.length} file(s))\n`);
  console.log(`Passing threshold: ${PASS_THRESHOLD}/10\n`);

  let passed = 0;
  let failed = 0;
  const allScores = [];

  for (const f of files) {
    const result = evalFile(f);
    allScores.push(result.total);
    const label = basename(f);
    const colour = result.pass ? GREEN : RED;
    const symbol = result.pass ? "✓" : "✗";
    console.log(
      `  ${colour}${symbol}${RESET} ${BOLD}${label}${RESET}  ${colour}${result.total}/${result.max}${RESET}`
    );
    for (const note of result.notes) {
      const noteColour = note.includes("✓") ? "" : YELLOW;
      console.log(`      ${noteColour}${note}${RESET}`);
    }
    console.log();
    if (result.pass) passed++;
    else failed++;
  }

  const avg = allScores.length
    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : 0;

  console.log(`─────────────────────────────────`);
  console.log(`${BOLD}Results:${RESET} ${GREEN}${passed} pass${RESET} / ${RED}${failed} fail${RESET}  |  avg score ${CYAN}${avg}/10${RESET}\n`);

  return failed > 0 ? 1 : 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
