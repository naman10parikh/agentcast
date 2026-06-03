#!/usr/bin/env node
/**
 * agentcast dispatch
 *
 * Tiny router that picks the best library persona for a given task description.
 * Uses keyword matching — zero LLM calls, zero external dependencies, <1ms.
 *
 * Usage:
 *   node dispatch/dispatch.mjs "review this TypeScript for security issues"
 *   node dispatch/dispatch.mjs --json "write unit tests for the auth module"
 *   node dispatch/dispatch.mjs --list
 *
 * Exit codes:
 *   0  match found
 *   1  no match (prints fallback suggestion)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

/**
 * Persona routing table.
 * Each entry: { id, file, description, keywords[] }
 * Keywords are matched case-insensitively against the task string.
 * First entry with the most keyword hits wins.
 */
const PERSONAS = [
  {
    id: "security-reviewer",
    file: "library/security-reviewer.md",
    description: "Injection / auth / CORS / secrets audit",
    keywords: [
      "security", "auth", "injection", "cors", "secrets", "xss", "csrf",
      "vulnerability", "exploit", "permission", "jwt", "oauth", "leak",
      "sanitize", "escape", "trusted", "malicious",
    ],
  },
  {
    id: "code-reviewer",
    file: "library/code-reviewer.md",
    description: "TypeScript / architecture code review",
    keywords: [
      "review", "code review", "pr review", "diff", "refactor", "typescript",
      "type error", "lint", "architecture", "pattern", "antipattern",
      "clean", "style", "naming", "readability",
    ],
  },
  {
    id: "test-writer",
    file: "library/test-writer.md",
    description: "Vitest unit + integration test generation",
    keywords: [
      "test", "tests", "unit test", "integration test", "vitest", "jest",
      "spec", "coverage", "mock", "stub", "fixture", "assertion",
      "describe", "it(", "expect(",
    ],
  },
  {
    id: "architect",
    file: "library/architect.md",
    description: "Trade-off analysis + system design",
    keywords: [
      "architect", "design", "trade-off", "tradeoff", "schema", "api design",
      "service boundary", "scalab", "latency", "throughput", "decision",
      "options", "compare", "versus", "vs ", "which approach",
    ],
  },
  {
    id: "researcher",
    file: "library/researcher.md",
    description: "Multi-source web + codebase research",
    keywords: [
      "research", "find", "search", "look up", "investigate", "how does",
      "what is", "document", "explore", "discover", "benchmark", "compare",
      "prior art", "existing", "available",
    ],
  },
  {
    id: "qa-tester",
    file: "library/qa-tester.md",
    description: "User-perspective E2E QA + bug reports",
    keywords: [
      "qa", "quality", "test as user", "end-to-end", "e2e", "bug", "regression",
      "user flow", "ux", "click", "screenshot", "verify", "broken", "broken feature",
      "does it work", "prod", "production",
    ],
  },
];

/**
 * Score a persona against a task description.
 * Returns { persona, hits } where hits is the count of matching keywords.
 */
function score(persona, task) {
  const lower = task.toLowerCase();
  const hits = persona.keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
  return { persona, hits };
}

/**
 * Route a task to the best-fit persona.
 * Returns the winning persona entry, or null if no hits.
 */
function dispatch(task) {
  const scored = PERSONAS.map((p) => score(p, task)).sort((a, b) => b.hits - a.hits);
  const best = scored[0];
  if (best.hits === 0) return null;
  return best.persona;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--list")) {
  console.log(`\n${BOLD}agentcast dispatch${RESET} — available personas\n`);
  for (const p of PERSONAS) {
    console.log(`  ${CYAN}${p.id.padEnd(20)}${RESET} ${p.description}`);
  }
  console.log();
  process.exit(0);
}

const jsonMode = args.includes("--json");
const taskArgs = args.filter((a) => a !== "--json");
const task = taskArgs.join(" ").trim();

if (!task) {
  console.error(`Usage: node dispatch/dispatch.mjs [--json] [--list] "<task description>"`);
  process.exit(1);
}

const match = dispatch(task);

if (!match) {
  if (jsonMode) {
    process.stdout.write(JSON.stringify({ match: null, fallback: "researcher" }) + "\n");
  } else {
    console.log(
      `${YELLOW}No strong match.${RESET} Falling back to ${BOLD}researcher${RESET} (general-purpose).`
    );
    console.log(`  Use: cp ~/agentcast/library/researcher.md ./.claude/agents/researcher.md\n`);
  }
  process.exit(1);
}

if (jsonMode) {
  const libPath = resolve(__dirname, "..", match.file);
  let content = "";
  try { content = readFileSync(libPath, "utf8"); } catch {}
  process.stdout.write(
    JSON.stringify({
      match: {
        id: match.id,
        file: match.file,
        description: match.description,
      },
      drop_command: `cp ~/agentcast/${match.file} ./.claude/agents/${match.id}.md`,
    }) + "\n"
  );
} else {
  console.log(`\n${BOLD}agentcast dispatch${RESET} — best match for: "${task}"\n`);
  console.log(`  ${GREEN}${BOLD}${match.id}${RESET}`);
  console.log(`  ${match.description}`);
  console.log(`  File: ${match.file}`);
  console.log();
  console.log(`  Drop into project:`);
  console.log(
    `  ${CYAN}cp ~/agentcast/${match.file} ./.claude/agents/${match.id}.md${RESET}`
  );
  console.log();
}

process.exit(0);
