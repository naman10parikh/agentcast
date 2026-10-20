#!/usr/bin/env node
/**
 * agentcast run-log
 *
 * Zero-dependency, zero-noise append-only JSONL run log.
 * Appends one line per invocation to observability/runs.jsonl
 *
 * Usage (from hooks or CLI):
 *   node observability/run-log.mjs <event> [detail]
 *   As a hook, it also reads the event JSON Claude Code sends on stdin and records the tool's
 *   command or file path (first 200 characters).
 *
 * Usage (code):
 *   import { logRun } from "./observability/run-log.mjs"; logRun("validate", { files: 3, errors: 0 })
 *
 * Events:
 *   PostToolUse:Bash       — a Bash tool call completed
 *   PreToolUse:Write       — a Write/Edit tool call is about to fire
 *   validate, score, dispatch, add, trial, recall, mcp:<tool> — agentcast's own commands
 *   persona-guard          — the hook checked a persona an agent just wrote
 *
 * Output file: observability/runs.jsonl (one JSON object per line)
 */

import { appendFileSync, mkdirSync, readFileSync, realpathSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, "runs.jsonl");

/** Append one line to the run log. Never throws: logging must not break the caller. */
export function logRun(event, fields = {}) {
  try {
    mkdirSync(__dirname, { recursive: true });
    appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), event, ...fields }) + "\n", "utf8");
  } catch (e) {
    process.stderr.write(`[run-log] write failed: ${e.message}\n`);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(__filename())) {
  const event = process.argv[2] ?? "unknown";
  let detail = process.argv.slice(3).join(" ") || undefined;
  if (!process.stdin.isTTY) {
    try {
      const input = JSON.parse(readFileSync(0, "utf8") || "{}");
      const tool = input.tool_input ?? {};
      detail = String(tool.command ?? tool.file_path ?? detail ?? "").slice(0, 200) || undefined;
    } catch {
      // Intentionally silent: no JSON on stdin means a manual call; keep the argv detail.
    }
  }
  logRun(event, detail ? { detail } : {});
  // Always exit 0 — this tool must never block the caller
  process.exit(0);
}

function __filename() {
  return fileURLToPath(import.meta.url);
}
