#!/usr/bin/env node
// agentcast persona guard (PostToolUse on Write|Edit|MultiEdit).
// After an agent writes a sub-agent persona (.claude/agents/*.md, or a file in agentcast's library/), validate it
// against what Claude Code reads and tell the agent what is wrong. On PostToolUse, exit code 2 shows stderr to the
// agent: the file is already written, so this is feedback to act on, not a veto. Any other file: exit 0, silently.
// Plain Node with no build step, so it works the same from a clone and from an installed plugin.
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { validateFile } from "../validator/validate.mjs";
import { logRun } from "../observability/run-log.mjs";

let file = "";
try {
  file = JSON.parse(readFileSync(0, "utf8") || "{}")?.tool_input?.file_path ?? "";
} catch {
  process.exit(0); // not a tool event; nothing to check
}
const norm = file.replace(/\\/g, "/");
const isPersona = /\/\.claude\/agents\/.+\.md$/.test(norm) || /\/library\/[^/]+\.md$/.test(norm);
if (!isPersona || !existsSync(file)) process.exit(0);

const errors = validateFile(file);
logRun("persona-guard", { file: basename(file), errors: errors.length });
if (errors.length > 0) {
  process.stderr.write(
    `agentcast: ${errors.length} problem(s) in ${file}:\n- ${errors.join("\n- ")}\n` +
      `Fix them, then check again: npx -y -p github:naman10parikh/agentcast agentcast validate --file ${file}\n`,
  );
  process.exit(2);
}
