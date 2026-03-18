#!/bin/bash
# sensitive-path-guard.sh
# PreToolUse hook for Edit|Write events
#
# Blocks writes to sensitive files: .env, credentials, keys, secrets, PEM certs,
# SSH private keys, and the claude-hooks settings file itself.
#
# Claude Code passes JSON via stdin. We extract tool_input.file_path
# and check it against blocked patterns using grep (POSIX, no jq needed).
#
# Exit 2 = block (Claude Code spec), Exit 0 = allow

# Read all stdin into a variable (handles multi-line JSON)
INPUT=$(cat)

# Extract file_path from tool_input using grep/sed
# Claude Code sends: {"tool_input": {"file_path": "/path/to/file", ...}}
FILE_PATH=$(printf '%s' "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"file_path"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# If no file_path found (e.g. Write tool may use different field), try path field
if [ -z "$FILE_PATH" ]; then
  FILE_PATH=$(printf '%s' "$INPUT" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"path"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')
fi

# If still no path found, allow (can't determine what's being written)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Extract just the filename (basename) for pattern matching
BASENAME=$(basename "$FILE_PATH")

# --- Blocked patterns ---
# Each pattern is explained inline.

# Block .env files (exact match and prefixed variants like .env.local, .env.production)
# These contain API keys, database URLs, and other secrets.
case "$BASENAME" in
  .env|.env.*|env)
    printf 'BLOCKED: Writing to env file "%s" is not allowed. Move secrets to a vault or use environment variables.\n' "$FILE_PATH" >&2
    exit 2
    ;;
esac

# Block files with "credentials" in the name — cloud provider credential files
# e.g. ~/.aws/credentials, gcloud credentials.json
if printf '%s' "$BASENAME" | grep -qi "credential"; then
  printf 'BLOCKED: Writing to credentials file "%s" is not allowed.\n' "$FILE_PATH" >&2
  exit 2
fi

# Block files with "secret" in the name — generic secret storage
if printf '%s' "$BASENAME" | grep -qi "secret"; then
  printf 'BLOCKED: Writing to secrets file "%s" is not allowed.\n' "$FILE_PATH" >&2
  exit 2
fi

# Block private key files (.key, .pem, .p12, .pfx)
# These are TLS/SSL private keys and certificate bundles
case "$BASENAME" in
  *.key|*.pem|*.p12|*.pfx)
    printf 'BLOCKED: Writing to private key/certificate file "%s" is not allowed.\n' "$FILE_PATH" >&2
    exit 2
    ;;
esac

# Block SSH private keys by conventional name
# OpenSSH default key names
case "$BASENAME" in
  id_rsa|id_ed25519|id_ecdsa|id_dsa)
    printf 'BLOCKED: Writing to SSH private key file "%s" is not allowed.\n' "$FILE_PATH" >&2
    exit 2
    ;;
esac

# Block the claude-hooks settings file itself to prevent hooks from modifying
# their own configuration (self-modification guard)
case "$BASENAME" in
  settings.json)
    # Only block if it's inside a .claude directory
    if printf '%s' "$FILE_PATH" | grep -q '\.claude'; then
      printf 'BLOCKED: Writing to Claude settings file "%s" is not allowed from within a hook.\n' "$FILE_PATH" >&2
      exit 2
    fi
    ;;
esac

# Block .htpasswd files — Apache password files
case "$BASENAME" in
  .htpasswd)
    printf 'BLOCKED: Writing to password file "%s" is not allowed.\n' "$FILE_PATH" >&2
    exit 2
    ;;
esac

# Block keychain/keystore files
if printf '%s' "$BASENAME" | grep -qi "keystore\|keychain"; then
  printf 'BLOCKED: Writing to keystore/keychain file "%s" is not allowed.\n' "$FILE_PATH" >&2
  exit 2
fi

# Allow everything else
exit 0
