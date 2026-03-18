#!/bin/bash
# post-edit-lint.sh
# PostToolUse hook for Write|Edit events
#
# Runs the appropriate linter on the file that Claude just edited,
# providing immediate feedback on code quality issues.
#
# Linter routing by file extension:
#   .ts/.tsx   -> ESLint (eslint) or Biome (biome check)
#   .py        -> Ruff (ruff check)
#   .sh/.bash  -> ShellCheck (shellcheck)
#
# If the linter for a file type is not installed, we skip silently.
# This hook is purely informational — it always exits 0 to avoid blocking.
#
# Claude Code passes JSON via stdin. We extract tool_input.file_path.
#
# Exit 0 = always allow (informational PostToolUse hook)

# Read all stdin into a variable
INPUT=$(cat)

# Extract file_path from tool_input using grep/sed
FILE_PATH=$(printf '%s' "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"file_path"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# If no file_path found, try path field (some tools use different field names)
if [ -z "$FILE_PATH" ]; then
  FILE_PATH=$(printf '%s' "$INPUT" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"path"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')
fi

# If no file path found, nothing to lint
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Check the file still exists (it might be a delete operation)
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Get the file extension (lowercase for case-insensitive matching)
EXTENSION=$(printf '%s' "$FILE_PATH" | sed 's/.*\.//' | tr '[:upper:]' '[:lower:]')

case "$EXTENSION" in
  ts|tsx|js|jsx|mjs|cjs)
    # TypeScript/JavaScript: try ESLint first, then Biome
    if command -v eslint > /dev/null 2>&1; then
      printf '[post-edit-lint] Running ESLint on %s\n' "$FILE_PATH" >&2
      eslint --no-eslintrc --rule "{}" "$FILE_PATH" 2>&1 >&2 || true
    elif command -v biome > /dev/null 2>&1; then
      printf '[post-edit-lint] Running Biome check on %s\n' "$FILE_PATH" >&2
      biome check "$FILE_PATH" 2>&1 >&2 || true
    else
      # No linter found — skip silently (don't block for missing tools)
      :
    fi
    ;;

  py)
    # Python: use Ruff (fast, modern Python linter)
    if command -v ruff > /dev/null 2>&1; then
      printf '[post-edit-lint] Running Ruff on %s\n' "$FILE_PATH" >&2
      ruff check "$FILE_PATH" 2>&1 >&2 || true
    fi
    ;;

  sh|bash)
    # Shell scripts: use ShellCheck for static analysis
    if command -v shellcheck > /dev/null 2>&1; then
      printf '[post-edit-lint] Running ShellCheck on %s\n' "$FILE_PATH" >&2
      shellcheck "$FILE_PATH" 2>&1 >&2 || true
    fi
    ;;

  *)
    # Unknown file type — no linter available, skip silently
    :
    ;;
esac

# Always exit 0 — this hook informs, it does not block
exit 0
