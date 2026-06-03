#!/usr/bin/env node
/**
 * agentcast eval
 *
 * Measures persona quality against a rubric. Does NOT call an LLM —
 * it is a static structural eval that runs in <1s and costs $0.
 *
 * Rubric (5 dimensions, each 0–2 points):
 *   1. Frontmatter completeness  — all 4 required keys present + non-empty
 *   2. Model appropriateness     — model matches task complexity
 *   3. Tool minimalism           — allowed-tools list is minimal (≤6 tools)
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

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, basename, dirname } from "path";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const REQUIRED_KEYS = ["name", "description", "model", "allowed-tools"];
const PASS_THRESHOLD = 7;

// Tools that should NOT be in read-only personas
const WRITE_TOOLS = ["Write", "Edit", "Bash", "MultiEdit"];

// Models by tier
const READ_ONLY_MODELS = ["haiku"]; // cheap, fast — good for research
const COMPLEX_MODELS = ["opus"]; // expensive — only for architecture

function parseFrontmatter(content) {
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

function evalFile(filePath) {
  const content = readFileSync(resolve(filePath), "utf8");
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

  // ── Dimension 2: Model appropriateness (0–2) ─────────────────────────────
  const model = fm?.model ?? "";
  const tools = fm?.["allowed-tools"] ?? [];
  const toolList = Array.isArray(tools) ? tools : [tools];

  const isReadOnly = !toolList.some((t) => WRITE_TOOLS.includes(t));
  const usesOpus = COMPLEX_MODELS.some((m) => model.includes(m));
  if (usesOpus && isReadOnly) {
    scores.push(1);
    notes.push("MODEL: opus on read-only task — consider sonnet to save budget");
  } else if (model.includes("haiku") && !isReadOnly) {
    scores.push(1);
    notes.push("MODEL: haiku on write task — consider sonnet for better quality");
  } else if (model) {
    scores.push(2);
    notes.push(`MODEL: ${model} appropriate for task ✓`);
  } else {
    scores.push(0);
    notes.push("MODEL: missing");
  }

  // ── Dimension 3: Tool minimalism (0–2) ───────────────────────────────────
  const toolCount = toolList.length;
  if (toolCount <= 3) {
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
const args = process.argv.slice(2);
let files = [];

if (args.includes("--library")) {
  const libDir = resolve(dirname(new URL(import.meta.url).pathname), "../library");
  files = collectMarkdownFiles(libDir);
} else if (args.includes("--file")) {
  files = [args[args.indexOf("--file") + 1]];
} else if (args.includes("--dir")) {
  files = collectMarkdownFiles(args[args.indexOf("--dir") + 1]);
} else {
  console.error("Usage: node eval/eval.mjs [--library] [--file <path>] [--dir <path>]");
  process.exit(1);
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

if (failed > 0) {
  process.exit(1);
}
