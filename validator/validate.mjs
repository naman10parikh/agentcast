#!/usr/bin/env node
/**
 * agentcast validator
 *
 * Checks every Claude Code sub-agent persona file against what Claude Code reads today
 * (code.claude.com/docs/en/sub-agents, frontmatter table, read 2026-10-19):
 *
 *   1. PATH        — personas live at `.claude/agents/<name>.md` (one flat level; no `agents/agents/`)
 *   2. FRONTMATTER — `name` and `description` are required; `name` has no `:`, does not start with `-`,
 *                    and is at most 256 characters
 *   3. TOOLS       — the allowlist key is `tools`. Claude Code ignores `allowed-tools` in a sub-agent
 *                    (that key belongs to skills), so such a persona silently gets every tool
 *   4. VALUES      — `model`, `permissionMode`, `memory`, `effort`, `isolation`, `color` and `background`
 *                    hold values Claude Code accepts. `model` is optional: leave it out and the persona
 *                    runs on the session's model
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

import { readFileSync, readdirSync, realpathSync, statSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";

// ─── ANSI colours ────────────────────────────────────────────────────────────
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

export const LIBRARY_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../library");

// ─── What Claude Code reads ───────────────────────────────────────────────────
const REQUIRED_KEYS = ["name", "description"];

/** Every frontmatter field Claude Code documents for a sub-agent. Kept current by scripts/field-drift.mjs. */
export const KNOWN_FIELDS = [
  "name", "description", "tools", "disallowedTools", "model", "permissionMode", "maxTurns",
  "autoCompactWindow", "skills", "mcpServers", "hooks", "memory", "background", "omitClaudeMd",
  "effort", "isolation", "color", "initialPrompt", "experimental",
];

const ENUMS = {
  permissionMode: ["default", "acceptEdits", "auto", "dontAsk", "bypassPermissions", "plan", "manual"],
  memory: ["user", "project", "local"],
  effort: ["low", "medium", "high", "xhigh", "max"],
  isolation: ["worktree"],
  color: ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"],
  background: ["true", "false"],
};

const MODEL_ALIASES = ["inherit", "sonnet", "opus", "haiku", "fable"];

/**
 * Parse YAML-ish frontmatter from a markdown file.
 * Handles the `---` delimited block at the top; top-level keys only.
 * Returns a plain object of key → value (strings / arrays).
 */
export function parseFrontmatter(content) {
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
  for (let i = 0; i < fmLines.length; i++) {
    const match = fmLines[i].match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, key, rawVal] = match;
    // Block scalars (`>` folds lines, `|` keeps them): gather the indented lines that follow
    if (/^[>|][-+]?$/.test(rawVal.trim())) {
      const body = [];
      while (i + 1 < fmLines.length && /^\s+\S/.test(fmLines[i + 1])) body.push(fmLines[++i].trim());
      result[key] = body.join(rawVal.trim().startsWith(">") ? " " : "\n");
      continue;
    }
    // Block lists (`tools:` then `  - Read` lines)
    if (rawVal.trim() === "" && i + 1 < fmLines.length && /^\s+-\s+\S/.test(fmLines[i + 1])) {
      const items = [];
      while (i + 1 < fmLines.length && /^\s+-\s+\S/.test(fmLines[i + 1])) {
        items.push(fmLines[++i].replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, ""));
      }
      result[key] = items;
      continue;
    }
    // Handle inline array: ["a", "b"] or ['a', 'b']
    const arrMatch = rawVal.trim().match(/^\[(.+)\]$/);
    if (arrMatch) {
      result[key] = arrMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    } else {
      // Folded values (`>` or `|`) and nested maps count as present; only presence matters there
      result[key] = rawVal.trim().replace(/^["']|["']$/g, "") || "(block)";
    }
  }
  return result;
}

/**
 * Validate persona text. `filePath` is used for the path rules only.
 * Returns array of error strings (empty = pass).
 */
export function validateContent(content, filePath) {
  const errors = [];
  const normalised = resolve(filePath).replace(/\\/g, "/");

  // ── 1. Path ─────────────────────────────────────────────────────────────
  if (normalised.includes("/agents/agents/")) {
    errors.push(
      `PATH: nested '…/agents/agents/…'. The standard keeps one flat level: ` +
        `'.claude/agents/<name>.md' in a project, 'agents/<name>.md' in a plugin.`
    );
  }
  // Library files are exempt: they live in agentcast/library/ until someone installs them
  const isLibraryFile = normalised.startsWith(LIBRARY_DIR.replace(/\\/g, "/") + "/") || normalised.includes("/agentcast/library/");
  const isAgentsDir = normalised.includes("/.claude/agents/");
  if (!isLibraryFile && !isAgentsDir) {
    errors.push(
      `PATH: file is not under '.claude/agents/', where Claude Code looks for project sub-agents.`
    );
  }

  // ── 2. Frontmatter ──────────────────────────────────────────────────────
  const fm = parseFrontmatter(content);
  if (fm.error) {
    errors.push(`FRONTMATTER: ${fm.error}`);
    return errors;
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in fm) || !fm[key] || fm[key].length === 0) {
      errors.push(`FRONTMATTER: missing required key '${key}'`);
    }
  }
  if (typeof fm.name === "string" && fm.name) {
    if (fm.name.startsWith("-") || fm.name.includes(":") || fm.name.length > 256) {
      errors.push(`FRONTMATTER: invalid name '${fm.name}' (no ':', no leading '-', at most 256 characters)`);
    }
  }

  // ── 3. Tools ────────────────────────────────────────────────────────────
  for (const wrong of ["allowed-tools", "allowedTools", "allowed_tools"]) {
    if (wrong in fm) {
      errors.push(
        "tools" in fm
          ? `TOOLS: Claude Code ignores '${wrong}' in a sub-agent; only 'tools' counts. Remove '${wrong}'.`
          : `TOOLS: Claude Code ignores '${wrong}' in a sub-agent, so this persona gets every tool. ` +
              `Rename the key to 'tools'.`
      );
    }
  }

  // ── 4. Values ───────────────────────────────────────────────────────────
  if ("model" in fm) {
    const m = String(fm.model);
    if (!MODEL_ALIASES.includes(m) && !/^claude-[a-z0-9.-]+(\[1m\])?$/.test(m)) {
      errors.push(
        `FRONTMATTER: unrecognised model '${m}'. Use ${MODEL_ALIASES.join(", ")}, a full model ID, ` +
          `or leave 'model' out to use the session's model.`
      );
    }
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (key in fm && !allowed.includes(String(fm[key]))) {
      errors.push(`FRONTMATTER: '${key}: ${fm[key]}' is not one of ${allowed.join(", ")}`);
    }
  }

  return errors;
}

/**
 * Validate a single `.md` file.
 * Returns array of error strings (empty = pass).
 */
export function validateFile(filePath) {
  let content;
  try {
    content = readFileSync(resolve(filePath), "utf8");
  } catch (e) {
    return [`FILE: cannot read — ${e.message}`];
  }
  return validateContent(content, filePath);
}

/**
 * Collect all .md files recursively under a directory.
 */
export function collectMarkdownFiles(dir) {
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
/** Run the validator CLI with `args`; returns the exit code. */
export function main(args = process.argv.slice(2)) {
  let filesToCheck = [];

  if (args.includes("--library")) {
    filesToCheck = collectMarkdownFiles(LIBRARY_DIR);
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
      console.error(`Usage: agentcast validate [--dir <path>] [--library] [--file <path>]`);
      return 1;
    }
  }

  if (filesToCheck.length === 0) {
    console.log(`${YELLOW}No .md files found to validate.${RESET}`);
    return 0;
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
    return 0;
  }
  console.log(
    `${RED}${BOLD}${totalErrors} error(s) across ${filesToCheck.length - passed} file(s).${RESET}\n`
  );
  return 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
