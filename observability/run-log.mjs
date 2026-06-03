#!/usr/bin/env node
/**
 * agentcast run-log
 *
 * Zero-dependency, zero-noise append-only JSONL run log.
 * Appends one line per invocation to observability/runs.jsonl
 *
 * Usage (from hooks or CLI):
 *   node observability/run-log.mjs <event> [detail]
 *
 * Events:
 *   PostToolUse:Bash       — a Bash tool call completed
 *   PreToolUse:Write       — a Write/Edit tool call is about to fire
 *   validate:pass          — validate.mjs reported all pass
 *   validate:fail          — validate.mjs reported failures
 *   eval:pass              — eval.mjs all scored ≥7
 *   eval:fail              — eval.mjs one or more below threshold
 *   dispatch:match         — dispatch found a persona
 *   dispatch:nomatch       — dispatch found no match
 *
 * Output file: observability/runs.jsonl (one JSON object per line)
 */

import { appendFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, "runs.jsonl");

// Ensure the directory exists (in case run before first git clone)
try { mkdirSync(__dirname, { recursive: true }); } catch {}

const event = process.argv[2] ?? "unknown";
const detail = process.argv.slice(3).join(" ") || undefined;

const entry = {
  ts: new Date().toISOString(),
  event,
  ...(detail ? { detail } : {}),
};

try {
  appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
} catch (e) {
  // Silent on write failure — hooks must not block Claude Code
  process.stderr.write(`[run-log] write failed: ${e.message}\n`);
}

// Always exit 0 — this tool must never block the caller
process.exit(0);
