#!/bin/bash
# exit-code-enforcer.sh
# PreToolUse hook for Bash events
#
# Blocks execution of known-dangerous shell commands that could cause
# irreversible damage to the system (data destruction, privilege escalation,
# fork bombs, etc.)
#
# Claude Code passes JSON via stdin. We extract tool_input.command
# and check it against dangerous patterns using grep (POSIX, no jq needed).
#
# Exit 2 = block (Claude Code spec), Exit 0 = allow

# Read all stdin into a variable
INPUT=$(cat)

# Extract command from tool_input using grep/sed
COMMAND=$(printf '%s' "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"command"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# If no command found, allow (can't determine what's being run)
if [ -z "$COMMAND" ]; then
  exit 0
fi

# --- Dangerous command patterns ---
# Each pattern check is explained inline.

# Block recursive force-delete of root filesystem
# This would permanently destroy the entire OS installation
if printf '%s' "$COMMAND" | grep -qE 'rm[[:space:]].*-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*[[:space:]]+/[[:space:]]*$|rm[[:space:]].*-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*[[:space:]]+/[[:space:]]*$'; then
  printf 'BLOCKED: "rm -rf /" would delete the entire filesystem. Command: %s\n' "$COMMAND" >&2
  exit 2
fi

# Block rm -rf targeting home directory by path or variable
# These would delete all user files and configuration
if printf '%s' "$COMMAND" | grep -qE 'rm[[:space:]].*-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*[[:space:]].*(~|\$HOME)[[:space:]]*$|rm[[:space:]].*-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*[[:space:]].*(~|\$HOME)[[:space:]]*$'; then
  printf 'BLOCKED: "rm -rf ~" or "rm -rf $HOME" would delete your home directory. Command: %s\n' "$COMMAND" >&2
  exit 2
fi

# Block chmod 777 on system directories or broad paths
# World-writable permissions on directories create security vulnerabilities
if printf '%s' "$COMMAND" | grep -qE 'chmod[[:space:]]+(777|a\+rwx|ugo\+rwx)[[:space:]]+(/[^[:space:]]*)?$'; then
  printf 'BLOCKED: "chmod 777" on system paths creates severe security vulnerabilities. Command: %s\n' "$COMMAND" >&2
  exit 2
fi

# Block writing directly to raw disk devices
# This would corrupt the filesystem/OS partition table
if printf '%s' "$COMMAND" | grep -qE '>[[:space:]]*/dev/(sd[a-z]|hd[a-z]|nvme[0-9]|disk[0-9])[[:space:]]*$'; then
  printf 'BLOCKED: Writing directly to a block device would corrupt the filesystem. Command: %s\n' "$COMMAND" >&2
  exit 2
fi

# Block fork bombs — the classic ":(){:|:&};:" pattern and common variants
# These consume all system resources and require a hard reboot
if printf '%s' "$COMMAND" | grep -qE ':\(\)\{[[:space:]]*:\|:'; then
  printf 'BLOCKED: Fork bomb detected. This would consume all system resources. Command: %s\n' "$COMMAND" >&2
  exit 2
fi

# Block dd reading from /dev/zero or /dev/random and writing to disk devices
# dd if=/dev/zero of=/dev/sda would overwrite a disk with zeros, destroying all data
if printf '%s' "$COMMAND" | grep -qE 'dd[[:space:]].*of=/dev/(sd[a-z]|hd[a-z]|nvme[0-9]|disk[0-9])'; then
  printf 'BLOCKED: "dd" writing to a block device would destroy all data on that disk. Command: %s\n' "$COMMAND" >&2
  exit 2
fi

# Allow everything else
exit 0
