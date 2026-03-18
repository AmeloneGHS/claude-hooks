#!/bin/bash
# ts-check.sh
# PostToolUse hook for Write|Edit events
#
# Runs TypeScript type checking (tsc --noEmit) after Claude edits a .ts or .tsx file.
# This gives Claude immediate feedback on type errors so it can self-correct.
#
# Only runs for .ts and .tsx files. Skips silently for all other file types.
# If tsc is not available (no TypeScript project), exits 0 silently.
#
# Output goes to stderr so Claude can see type errors in the hook output.
#
# Claude Code passes JSON via stdin. We extract tool_input.file_path.
#
# Exit 0 = always allow (informational PostToolUse hook)

# Read all stdin into a variable
INPUT=$(cat)

# Extract file_path from tool_input using grep/sed
FILE_PATH=$(printf '%s' "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"file_path"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# If no file_path found, try path field
if [ -z "$FILE_PATH" ]; then
  FILE_PATH=$(printf '%s' "$INPUT" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"path"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')
fi

# If no file path found, nothing to check
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Get the file extension (lowercase)
EXTENSION=$(printf '%s' "$FILE_PATH" | sed 's/.*\.//' | tr '[:upper:]' '[:lower:]')

# Only run on TypeScript files
case "$EXTENSION" in
  ts|tsx)
    # TypeScript file — proceed with type check
    ;;
  *)
    # Not a TypeScript file — skip silently
    exit 0
    ;;
esac

# Check if npx is available (needed to run tsc from node_modules)
if ! command -v npx > /dev/null 2>&1; then
  exit 0
fi

# Find the tsconfig.json by walking up from the file's directory
# This handles monorepos and nested TypeScript projects
FILE_DIR=$(dirname "$FILE_PATH")
TSCONFIG=""
SEARCH_DIR="$FILE_DIR"

# Walk up directory tree looking for tsconfig.json (max 10 levels to avoid infinite loop)
i=0
while [ $i -lt 10 ]; do
  if [ -f "$SEARCH_DIR/tsconfig.json" ]; then
    TSCONFIG="$SEARCH_DIR/tsconfig.json"
    break
  fi
  PARENT=$(dirname "$SEARCH_DIR")
  # Stop if we've reached the filesystem root
  if [ "$PARENT" = "$SEARCH_DIR" ]; then
    break
  fi
  SEARCH_DIR="$PARENT"
  i=$((i + 1))
done

# If no tsconfig.json found, this isn't a TypeScript project — skip
if [ -z "$TSCONFIG" ]; then
  exit 0
fi

# Get the project root (directory containing tsconfig.json)
PROJECT_ROOT=$(dirname "$TSCONFIG")

printf '[ts-check] Running tsc --noEmit in %s\n' "$PROJECT_ROOT" >&2

# Run tsc --noEmit from the project root directory
# --pretty enables colored output for readability
# Capture output and send to stderr for Claude to see
TSC_OUTPUT=$(cd "$PROJECT_ROOT" && npx tsc --noEmit --pretty 2>&1)
TSC_EXIT=$?

if [ $TSC_EXIT -ne 0 ]; then
  printf '[ts-check] TypeScript errors found:\n' >&2
  printf '%s\n' "$TSC_OUTPUT" >&2
else
  printf '[ts-check] No TypeScript errors.\n' >&2
fi

# Always exit 0 — this hook informs, it does not block
exit 0
