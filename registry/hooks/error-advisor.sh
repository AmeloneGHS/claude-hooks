#!/bin/bash
# error-advisor.sh
# PostToolUse hook for Bash events
#
# Analyzes the output of failed Bash commands and suggests contextual fixes.
# When Claude runs a command that fails, this hook examines the error output
# and prints actionable fix suggestions to stderr.
#
# Known error patterns and suggestions:
#   EADDRINUSE         -> Port already in use
#   ENOENT             -> File not found
#   permission denied  -> chmod/ownership issue
#   MODULE_NOT_FOUND   -> npm install needed
#   ENOMEM             -> Out of memory
#   command not found  -> Tool not installed
#   ECONNREFUSED       -> Service not running
#   ETIMEDOUT          -> Network timeout
#   error TS[0-9]{4}   -> TypeScript compilation error
#
# Claude Code PostToolUse JSON includes tool_response with command output.
# JSON is parsed with grep/sed (no jq or python3 required, bash 3.2+ compatible).
#
# Exit codes:
#   0  - always allow (advisory PostToolUse hook)

INPUT=$(cat)

# Extract tool_name to confirm this is a Bash tool call
TOOL_NAME=$(printf '%s' "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"tool_name"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# Only provide advice for Bash tool calls
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

# Extract tool output / response (where error messages appear)
# Claude Code PostToolUse includes tool_response as a JSON field
TOOL_RESPONSE=$(printf '%s' "$INPUT" | grep -o '"tool_response"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"tool_response"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# Also check stdout/stderr fields
STDOUT=$(printf '%s' "$INPUT" | grep -o '"stdout"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"stdout"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')
STDERR_VAL=$(printf '%s' "$INPUT" | grep -o '"stderr"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"stderr"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# Combine all output for pattern matching
ALL_OUTPUT="${TOOL_RESPONSE} ${STDOUT} ${STDERR_VAL}"

# If no output at all, nothing to advise on
if [ -z "$(printf '%s' "$ALL_OUTPUT" | tr -d '[:space:]')" ]; then
  exit 0
fi

# --- Error pattern detection and advice ---
# Each pattern uses case-insensitive grep for robustness

# EADDRINUSE: Port already in use
# Common when starting a dev server when another process holds the port
if printf '%s' "$ALL_OUTPUT" | grep -qi "EADDRINUSE"; then
  PORT=$(printf '%s' "$ALL_OUTPUT" | grep -o 'EADDRINUSE.*[0-9][0-9][0-9][0-9]' | grep -o '[0-9][0-9][0-9][0-9]*' | head -1)
  if [ -n "$PORT" ]; then
    printf '[error-advisor] Port %s is already in use. Fix:\n  lsof -ti:%s | xargs kill -9\n' "$PORT" "$PORT" >&2
  else
    printf '[error-advisor] A port is already in use. Fix:\n  lsof -ti:<port> | xargs kill -9\n' >&2
  fi
fi

# ENOENT: No such file or directory
# Common when referencing a path that doesn't exist yet
if printf '%s' "$ALL_OUTPUT" | grep -qi "ENOENT\|No such file or directory"; then
  printf '[error-advisor] File or directory not found. Fix:\n  Check the path exists: ls -la <path>\n  Create missing directories: mkdir -p <dir>\n' >&2
fi

# Permission denied: file permission issue
# Common when a script is not executable or user lacks write access
if printf '%s' "$ALL_OUTPUT" | grep -qi "permission denied\|EACCES"; then
  printf '[error-advisor] Permission denied. Fix:\n  Make executable: chmod +x <file>\n  Check ownership: ls -la <file>\n' >&2
fi

# MODULE_NOT_FOUND: Node.js module missing
# Common after checkout or when dependencies haven't been installed
if printf '%s' "$ALL_OUTPUT" | grep -qi "MODULE_NOT_FOUND\|Cannot find module"; then
  printf '[error-advisor] Node.js module not found. Fix:\n  npm install\n  # or: npm ci (for clean installs)\n' >&2
fi

# ENOMEM: Out of memory
# Node.js heap exhaustion or system memory pressure
if printf '%s' "$ALL_OUTPUT" | grep -qi "ENOMEM\|out of memory\|JavaScript heap out of memory"; then
  printf '[error-advisor] Out of memory. Fix:\n  NODE_OPTIONS="--max-old-space-size=4096" <command>\n  Close other applications to free memory\n' >&2
fi

# command not found: tool not installed
# Common when a CLI tool needs to be installed first
if printf '%s' "$ALL_OUTPUT" | grep -qi "command not found"; then
  printf '[error-advisor] A required command was not found. Install the missing tool via package manager.\n' >&2
fi

# ECONNREFUSED: Service not running
# Common when trying to connect to a server that hasn't started
if printf '%s' "$ALL_OUTPUT" | grep -qi "ECONNREFUSED\|Connection refused"; then
  printf '[error-advisor] Connection refused — the target service is not running. Fix:\n  Check if service is running: ps aux | grep <service>\n  Start the service first, then retry\n' >&2
fi

# ETIMEDOUT: Network timeout
# Common on slow networks or when a service is unreachable
if printf '%s' "$ALL_OUTPUT" | grep -qi "ETIMEDOUT\|timed out\|timeout"; then
  printf '[error-advisor] Network timeout. Fix:\n  Check network connectivity: ping <host>\n  The service may be temporarily unavailable — retry in a moment\n' >&2
fi

# TypeScript compilation errors
if printf '%s' "$ALL_OUTPUT" | grep -qi "error TS[0-9]"; then
  printf '[error-advisor] TypeScript compilation error detected. Fix:\n  Run: npx tsc --noEmit to see all errors\n  Check type annotations and interface definitions\n' >&2
fi

# Always exit 0 — this hook advises, it does not block
exit 0
