#!/usr/bin/env node
/**
 * agentcast validator
 *
 * Asserts two invariants for every Claude Code sub-agent persona file:
 *
 *   1. FLAT PATH — the file must live at `.claude/agents/<name>.md` (not `agents/agents/`)
 *   2. VALID FRONTMATTER — must contain `name`, `description`, `model`, `allowed-tools`
 *
 * Usage:
 *   node validator/validate.mjs [--dir <path>]        # validate a project's agents dir
 *   node validator/validate.mjs --library             # validate the agentcast library itself
 *   node validator/validate.mjs --file <path>         # validate a single file
 *
 * Exit codes:
 *   0  all checks pass
 *   1  one or more validation errors
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, basename, dirname, sep } from "path";

// ─── ANSI colours ────────────────────────────────────────────────────────────
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

// ─── Required frontmatter keys ────────────────────────────────────────────────
const REQUIRED_KEYS = ["name", "description", "model", "allowed-tools"];

/**
 * Parse YAML-ish frontmatter from a markdown file.
 * Handles the `---` delimited block at the top.
 * Returns a plain object of key → value (strings / arrays).
 */
function parseFrontmatter(content, filePath) {
  const lines = content.split("\n");
  if (lines[0].trim() !== "---") {
    return { error: "No opening '---' frontmatter delimiter" };
  }
  const closeIdx = lines.slice(1).findIndex((l) => l.trim() === "---");
  if (closeIdx === -1) {
    return { error: "No closing '---' frontmatter delimiter" };
  }
  const fmLines = lines.slice(1, closeIdx + 1);
  const result = {};
  for (const line of fmLines) {
    const match = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, key, rawVal] = match;
    // Handle inline array: ["a", "b"] or ['a', 'b']
    const arrMatch = rawVal.trim().match(/^\[(.+)\]$/);
    if (arrMatch) {
      result[key] = arrMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    } else {
      // Multiline value collapsed for now — we only need presence check
      result[key] = rawVal.trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

/**
 * Validate a single `.md` file.
 * Returns array of error strings (empty = pass).
 */
function validateFile(filePath) {
  const errors = [];
  const absPath = resolve(filePath);

  // ── 1. Flat-path check ──────────────────────────────────────────────────
  // Canonical: ends with  .claude/agents/<name>.md
  // Anti-pattern: agents/agents/ nesting (A3 bug)
  const normalised = absPath.replace(/\\/g, "/");
  if (normalised.includes("/agents/agents/")) {
    errors.push(
      `PATH: double-nesting detected '…/agents/agents/…'. ` +
        `Move to '.claude/agents/<name>.md' (flat path standard).`
    );
  }
  // Warn if the file isn't under any .claude/agents/ at all
  // (library files are exempt — they live in agentcast/library/)
  const isLibraryFile = normalised.includes("/agentcast/library/");
  const isAgentsDir = normalised.includes("/.claude/agents/");
  if (!isLibraryFile && !isAgentsDir) {
    errors.push(
      `PATH: file is not under '.claude/agents/'. ` +
        `Flat-path standard requires '.claude/agents/<name>.md'.`
    );
  }

  // ── 2. Frontmatter check ────────────────────────────────────────────────
  let content;
  try {
    content = readFileSync(absPath, "utf8");
  } catch (e) {
    errors.push(`FILE: cannot read — ${e.message}`);
    return errors;
  }

  const fm = parseFrontmatter(content, absPath);
  if (fm.error) {
    errors.push(`FRONTMATTER: ${fm.error}`);
    return errors;
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in fm) || !fm[key] || fm[key].length === 0) {
      errors.push(`FRONTMATTER: missing required key '${key}'`);
    }
  }

  // ── 3. Model allowlist (warn, not block) ─────────────────────────────────
  const KNOWN_MODELS = ["opus", "sonnet", "haiku", "claude-sonnet-4-6", "claude-opus-4-7"];
  if (fm.model && !KNOWN_MODELS.some((m) => fm.model.includes(m))) {
    errors.push(
      `FRONTMATTER: unrecognised model '${fm.model}'. ` +
        `Known values: ${KNOWN_MODELS.join(", ")}`
    );
  }

  return errors;
}

/**
 * Collect all .md files recursively under a directory.
 */
function collectMarkdownFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectMarkdownFiles(full));
    } else if (entry.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let filesToCheck = [];

if (args.includes("--library")) {
  const libDir = resolve(dirname(new URL(import.meta.url).pathname), "../library");
  filesToCheck = collectMarkdownFiles(libDir);
} else if (args.includes("--file")) {
  const idx = args.indexOf("--file");
  filesToCheck = [args[idx + 1]];
} else if (args.includes("--dir")) {
  const idx = args.indexOf("--dir");
  filesToCheck = collectMarkdownFiles(resolve(args[idx + 1]));
} else {
  // Default: look for .claude/agents/ relative to cwd
  const defaultDir = resolve(process.cwd(), ".claude/agents");
  try {
    statSync(defaultDir);
    filesToCheck = collectMarkdownFiles(defaultDir);
  } catch {
    console.error(`${YELLOW}No .claude/agents/ dir found in ${process.cwd()}${RESET}`);
    console.error(`Usage: node validator/validate.mjs [--dir <path>] [--library] [--file <path>]`);
    process.exit(1);
  }
}

if (filesToCheck.length === 0) {
  console.log(`${YELLOW}No .md files found to validate.${RESET}`);
  process.exit(0);
}

let totalErrors = 0;
let passed = 0;

console.log(`\n${BOLD}agentcast validator${RESET} — checking ${filesToCheck.length} file(s)\n`);

for (const f of filesToCheck) {
  const errors = validateFile(f);
  const label = basename(f);
  if (errors.length === 0) {
    console.log(`  ${GREEN}✓${RESET} ${label}`);
    passed++;
  } else {
    console.log(`  ${RED}✗${RESET} ${label}`);
    for (const err of errors) {
      console.log(`      ${RED}→ ${err}${RESET}`);
    }
    totalErrors += errors.length;
  }
}

console.log();
if (totalErrors === 0) {
  console.log(`${GREEN}${BOLD}All ${passed} file(s) passed.${RESET}\n`);
  process.exit(0);
} else {
  console.log(
    `${RED}${BOLD}${totalErrors} error(s) across ${filesToCheck.length - passed} file(s).${RESET}\n`
  );
  process.exit(1);
}
