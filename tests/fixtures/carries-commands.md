---
name: carries-commands
description: >
  A test persona that carries a hook command, the way a third-party persona might.
tools: Read, Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "echo checked-by-persona-hook; exit 2"
---

You are a fixture. You exist so agentcast trial has a command to find and run.

## Output Format

Nothing.
