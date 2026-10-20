#!/usr/bin/env node
/**
 * agentcast-mcp — agentcast's tools over MCP (JSON-RPC 2.0 on stdio, no dependencies).
 *
 *   persona_dispatch  { task }                         → the best library persona for a task
 *   persona_get       { id }                           → a library persona's file, ready for .claude/agents/<id>.md
 *   persona_validate  { content | path, name? }        → what Claude Code would reject or ignore
 *   persona_score     { content | path }               → the 10-point rubric with notes
 */
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { createInterface } from "readline";
import { LIBRARY_DIR, validateContent } from "../validator/validate.mjs";
import { evalContent } from "../eval/eval.mjs";
import { dispatch } from "../dispatch/dispatch.mjs";
import { logRun } from "../observability/run-log.mjs";

const TOOLS = [
  {
    name: "persona_dispatch",
    description: "Pick the best reusable sub-agent persona for a task description. Returns its id, what it does and the command that installs it.",
    inputSchema: { type: "object", properties: { task: { type: "string", description: "What the sub-agent should do" } }, required: ["task"] },
  },
  {
    name: "persona_get",
    description: "Return a library persona's Markdown file, ready to save as .claude/agents/<id>.md in a project.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Library persona id, e.g. code-reviewer" } }, required: ["id"] },
  },
  {
    name: "persona_validate",
    description: "Check a sub-agent persona against what Claude Code reads today: required name and description, the 'tools' allowlist (not 'allowed-tools'), valid model and permission values, and the .claude/agents/ path.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The persona's Markdown text" },
        path: { type: "string", description: "Or a path to the persona file" },
        name: { type: "string", description: "File name to check the text as, under .claude/agents/ (default: from the frontmatter)" },
      },
    },
  },
  {
    name: "persona_score",
    description: "Score a persona on agentcast's 10-point rubric (frontmatter, model left to the session, tool minimalism, output contract, read-only guard). 7 passes.",
    inputSchema: { type: "object", properties: { content: { type: "string" }, path: { type: "string" } } },
  },
];

const text = (t) => ({ content: [{ type: "text", text: t }] });

function readPersona(args) {
  if (typeof args.content === "string") return { content: args.content, path: null };
  if (typeof args.path === "string" && existsSync(args.path)) return { content: readFileSync(args.path, "utf8"), path: resolve(args.path) };
  return null;
}

function callTool(name, args) {
  if (name === "persona_dispatch") {
    const match = dispatch(String(args.task ?? ""));
    const id = match ? match.id : "researcher";
    return text(JSON.stringify({ match: match ? { id: match.id, description: match.description } : null, fallback: match ? undefined : "researcher", add_command: `npx -y -p github:naman10parikh/agentcast agentcast add ${id}` }, null, 2));
  }
  if (name === "persona_get") {
    const id = String(args.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
    const file = join(LIBRARY_DIR, `${id}.md`);
    if (!id || !existsSync(file)) return text(`No library persona '${args.id ?? ""}'.`);
    return text(readFileSync(file, "utf8"));
  }
  if (name === "persona_validate" || name === "persona_score") {
    const p = readPersona(args);
    if (!p) return text("Pass the persona as `content`, or a readable `path`.");
    if (name === "persona_score") {
      const r = evalContent(p.content);
      return text(JSON.stringify({ score: r.total, max: r.max, pass: r.pass, notes: r.notes }, null, 2));
    }
    const fallback = (p.content.match(/^name:\s*(.+)$/m)?.[1] ?? "persona").trim().replace(/[^a-zA-Z0-9_-]/g, "-");
    const where = p.path ?? `/project/.claude/agents/${String(args.name ?? fallback).replace(/\.md$/, "")}.md`;
    const errors = validateContent(p.content, where);
    return text(JSON.stringify({ valid: errors.length === 0, errors }, null, 2));
  }
  return null;
}

const respond = (id, result) => JSON.stringify({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    process.stdout.write(fail(null, -32700, "Parse error") + "\n");
    return;
  }
  if (req.id === undefined || req.id === null) return; // a notification: nothing to answer
  if (req.method === "initialize") {
    process.stdout.write(respond(req.id, { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "agentcast", version: "0.1.0" } }) + "\n");
  } else if (req.method === "tools/list") {
    process.stdout.write(respond(req.id, { tools: TOOLS }) + "\n");
  } else if (req.method === "tools/call") {
    const name = req.params?.name;
    const result = callTool(name, req.params?.arguments ?? {});
    logRun(`mcp:${name}`, { ok: result !== null });
    process.stdout.write((result ? respond(req.id, result) : fail(req.id, -32601, `Unknown tool: ${name}`)) + "\n");
  } else if (req.method === "ping") {
    process.stdout.write(respond(req.id, {}) + "\n");
  } else {
    process.stdout.write(fail(req.id, -32601, `Method not found: ${req.method}`) + "\n");
  }
});
rl.on("close", () => process.exit(0));
