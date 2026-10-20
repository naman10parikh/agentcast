/**
 * agentcast trial — see what a persona can do before you install it.
 *
 * A sub-agent file is more than a prompt: its frontmatter can grant every tool (no `tools` line), raise its
 * permission mode, and carry commands of its own (`hooks` and inline `mcpServers` run shell commands when the
 * persona runs). `inspectPersona` lists all of that from the text alone. `trialInE2B` goes further: it writes the
 * persona into a project inside a fresh E2B Firecracker microVM, runs each command it carries with a synthetic
 * event on stdin, records what happened, and kills the VM, so an untrusted persona never runs on your machine.
 * E2B needs E2B_API_KEY and the optional `e2b` package.
 */
import { parseFrontmatter } from "../validator/validate.mjs";

/** Read a persona's powers from its text: tools, permission mode, model and the commands it carries. */
export function inspectPersona(content) {
  const fm = parseFrontmatter(content);
  if (fm.error) return { error: fm.error, commands: [], notes: [] };
  const lines = content.split("\n");
  const end = lines.indexOf("---", 1);
  const front = lines.slice(1, end);
  const commands = [];
  let section = "";
  for (const line of front) {
    const top = line.match(/^([A-Za-z]+)\s*:/);
    if (top) section = top[1];
    const cmd = line.match(/^\s+(?:-\s+)?command\s*:\s*(.+)$/);
    if (cmd && (section === "hooks" || section === "mcpServers")) {
      commands.push({ from: section, command: cmd[1].trim().replace(/^["']|["']$/g, "") });
    }
  }
  const toList = (v) => (v === undefined ? null : (Array.isArray(v) ? v : String(v).split(",")).map((t) => t.trim()).filter(Boolean));
  const tools = toList(fm.tools);
  const notes = [];
  if (!tools) notes.push("no 'tools' allowlist: the persona inherits every tool the session has");
  if (fm.permissionMode === "bypassPermissions") notes.push("permissionMode bypassPermissions: it asks for nothing when the session allows that");
  if ("hooks" in fm) notes.push("carries hooks: their commands run while the persona works (ignored when it ships in a plugin)");
  if ("mcpServers" in fm) notes.push("carries MCP servers: inline ones start a process (ignored when it ships in a plugin)");
  if ("model" in fm && fm.model !== "inherit") notes.push(`pins model '${fm.model}' instead of using the session's`);
  return {
    name: fm.name ?? "",
    tools,
    disallowedTools: toList(fm.disallowedTools),
    permissionMode: fm.permissionMode ?? "inherits the session's",
    model: fm.model ?? "the session's",
    commands,
    notes,
  };
}

/** Run every command the persona carries inside one fresh E2B microVM. Never throws. */
export async function trialInE2B(content, { timeoutSec = 20 } = {}) {
  const info = inspectPersona(content);
  if (info.error) return { ok: false, error: info.error, results: [] };
  if (!process.env.E2B_API_KEY) return { ok: false, error: "E2B_API_KEY is not set", results: [] };
  if (info.commands.length === 0) return { ok: true, results: [], note: "the persona carries no commands; nothing to run" };
  let Sandbox;
  try {
    const pkg = "e2b"; // a variable, so nothing requires the optional package until it is used
    ({ Sandbox } = await import(pkg));
  } catch {
    return { ok: false, error: "the optional `e2b` package is not installed (npm install e2b)", results: [] };
  }
  const name = (info.name || "persona").replace(/[^a-zA-Z0-9_-]/g, "-");
  const event = { session_id: "agentcast-trial", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" }, cwd: "/home/user/project", agent_type: name };
  let sbx = null;
  const started = Date.now();
  try {
    sbx = await Sandbox.create({ timeoutMs: 120_000 });
    const coldStartMs = Date.now() - started;
    await sbx.files.write(`/home/user/project/.claude/agents/${name}.md`, content);
    await sbx.files.write("/home/user/event.json", JSON.stringify(event));
    const results = [];
    for (const c of info.commands) {
      const quoted = c.command.replace(/'/g, `'\\''`);
      const script = `cd /home/user/project && CLAUDE_PROJECT_DIR=/home/user/project sh -c '${quoted}' < /home/user/event.json`;
      const t0 = Date.now();
      try {
        const r = await sbx.commands.run(script, { timeoutMs: timeoutSec * 1000 });
        results.push({ ...c, exitCode: r.exitCode, stdout: r.stdout.slice(0, 500), stderr: r.stderr.slice(0, 500), ms: Date.now() - t0 });
      } catch (e) {
        // The SDK throws on a non-zero exit (the error carries the fields) and on a timeout (it does not)
        if (typeof e?.exitCode === "number") {
          results.push({ ...c, exitCode: e.exitCode, stdout: String(e.stdout ?? "").slice(0, 500), stderr: String(e.stderr ?? "").slice(0, 500), ms: Date.now() - t0 });
        } else {
          results.push({ ...c, exitCode: null, error: `did not finish in ${timeoutSec} s (a server waits for input)`, ms: Date.now() - t0 });
        }
      }
    }
    return { ok: true, coldStartMs, results };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), results: [] };
  } finally {
    await sbx?.kill().catch(() => undefined); // Intentionally silent: the VM also expires on its own timeout.
  }
}
