import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = resolve(__dirname, '../../registry/hooks');

// Temp files to clean up after each test
const tempFiles: string[] = [];

afterEach(() => {
  for (const f of tempFiles) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }
  tempFiles.length = 0;
});

/**
 * Run a hook script with a JSON payload on stdin.
 * Returns { exitCode, stdout, stderr }.
 */
function runHook(scriptName: string, json: object, env?: Record<string, string>) {
  const scriptPath = resolve(HOOKS_DIR, scriptName);
  const input = JSON.stringify(json);
  const result = spawnSync('bash', [scriptPath], {
    input,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// ─── sensitive-path-guard.sh ───────────────────────────────────────────────

describe('sensitive-path-guard.sh', () => {
  it('blocks .env (exit 2)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: '.env' } });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/BLOCKED/i);
  });

  it('blocks .env.local (exit 2)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: '/project/.env.local' } });
    expect(r.exitCode).toBe(2);
  });

  it('blocks .env.production (exit 2)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: '.env.production' } });
    expect(r.exitCode).toBe(2);
  });

  it('blocks credentials.json (exit 2)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: 'config/credentials.json' } });
    expect(r.exitCode).toBe(2);
  });

  it('blocks aws-credentials (exit 2)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: '/home/user/.aws/credentials' } });
    expect(r.exitCode).toBe(2);
  });

  it('blocks server.pem (exit 2)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: 'certs/server.pem' } });
    expect(r.exitCode).toBe(2);
  });

  it('blocks id_rsa (exit 2)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: '/home/user/.ssh/id_rsa' } });
    expect(r.exitCode).toBe(2);
  });

  it('blocks id_ed25519 (exit 2)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: 'id_ed25519' } });
    expect(r.exitCode).toBe(2);
  });

  it('blocks .claude/settings.json (exit 2)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: '/project/.claude/settings.json' } });
    expect(r.exitCode).toBe(2);
  });

  it('allows src/app.ts (exit 0)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: 'src/app.ts' } });
    expect(r.exitCode).toBe(0);
  });

  it('allows package.json (exit 0)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: 'package.json' } });
    expect(r.exitCode).toBe(0);
  });

  it('allows README.md (exit 0)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: { file_path: 'README.md' } });
    expect(r.exitCode).toBe(0);
  });

  it('allows when no file_path provided (exit 0)', () => {
    const r = runHook('sensitive-path-guard.sh', { tool_input: {} });
    expect(r.exitCode).toBe(0);
  });
});

// ─── exit-code-enforcer.sh ─────────────────────────────────────────────────

describe('exit-code-enforcer.sh', () => {
  it('blocks "rm -rf /" (exit 2)', () => {
    const r = runHook('exit-code-enforcer.sh', { tool_input: { command: 'rm -rf /' } });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/BLOCKED/i);
  });

  it('blocks "rm -rf ~" (exit 2)', () => {
    const r = runHook('exit-code-enforcer.sh', { tool_input: { command: 'rm -rf ~' } });
    expect(r.exitCode).toBe(2);
  });

  it('blocks "rm -rf $HOME" (exit 2)', () => {
    const r = runHook('exit-code-enforcer.sh', { tool_input: { command: 'rm -rf $HOME' } });
    expect(r.exitCode).toBe(2);
  });

  it('blocks "dd if=/dev/zero of=/dev/sda" (exit 2)', () => {
    const r = runHook('exit-code-enforcer.sh', { tool_input: { command: 'dd if=/dev/zero of=/dev/sda' } });
    expect(r.exitCode).toBe(2);
  });

  it('allows "npm test" (exit 0)', () => {
    const r = runHook('exit-code-enforcer.sh', { tool_input: { command: 'npm test' } });
    expect(r.exitCode).toBe(0);
  });

  it('allows "ls -la" (exit 0)', () => {
    const r = runHook('exit-code-enforcer.sh', { tool_input: { command: 'ls -la' } });
    expect(r.exitCode).toBe(0);
  });

  it('allows "git status" (exit 0)', () => {
    const r = runHook('exit-code-enforcer.sh', { tool_input: { command: 'git status' } });
    expect(r.exitCode).toBe(0);
  });

  it('allows when no command provided (exit 0)', () => {
    const r = runHook('exit-code-enforcer.sh', { tool_input: {} });
    expect(r.exitCode).toBe(0);
  });
});

// ─── post-edit-lint.sh ─────────────────────────────────────────────────────

describe('post-edit-lint.sh', () => {
  it('always exits 0 for .ts file', () => {
    const r = runHook('post-edit-lint.sh', { tool_input: { file_path: 'src/app.ts' } });
    expect(r.exitCode).toBe(0);
  });

  it('always exits 0 for .py file', () => {
    const r = runHook('post-edit-lint.sh', { tool_input: { file_path: 'app.py' } });
    expect(r.exitCode).toBe(0);
  });

  it('always exits 0 for .sh file', () => {
    const r = runHook('post-edit-lint.sh', { tool_input: { file_path: 'script.sh' } });
    expect(r.exitCode).toBe(0);
  });

  it('always exits 0 for unknown extension', () => {
    const r = runHook('post-edit-lint.sh', { tool_input: { file_path: 'file.xyz' } });
    expect(r.exitCode).toBe(0);
  });

  it('always exits 0 when no file_path', () => {
    const r = runHook('post-edit-lint.sh', { tool_input: {} });
    expect(r.exitCode).toBe(0);
  });
});

// ─── ts-check.sh ───────────────────────────────────────────────────────────

describe('ts-check.sh', () => {
  it('always exits 0 for .ts file', () => {
    const r = runHook('ts-check.sh', { tool_input: { file_path: 'src/app.ts' } });
    expect(r.exitCode).toBe(0);
  });

  it('always exits 0 for non-TS file', () => {
    const r = runHook('ts-check.sh', { tool_input: { file_path: 'src/app.py' } });
    expect(r.exitCode).toBe(0);
  });

  it('always exits 0 when no file_path', () => {
    const r = runHook('ts-check.sh', { tool_input: {} });
    expect(r.exitCode).toBe(0);
  });
});

// ─── web-budget-gate.sh ────────────────────────────────────────────────────

describe('web-budget-gate.sh', () => {
  it('allows calls within budget', () => {
    const sessionId = `test-web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const counterFile = `/tmp/claude-hooks-web-count-${sessionId}`;
    tempFiles.push(counterFile);

    for (let i = 1; i <= 3; i++) {
      const r = runHook('web-budget-gate.sh', { session_id: sessionId }, { CLAUDE_HOOKS_WEB_LIMIT: '5' });
      expect(r.exitCode, `call ${i} should be allowed`).toBe(0);
    }
  });

  it('blocks after limit exceeded (exit 2)', () => {
    const sessionId = `test-web-over-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const counterFile = `/tmp/claude-hooks-web-count-${sessionId}`;
    tempFiles.push(counterFile);

    // Use up the entire budget (limit=3)
    for (let i = 0; i < 3; i++) {
      runHook('web-budget-gate.sh', { session_id: sessionId }, { CLAUDE_HOOKS_WEB_LIMIT: '3' });
    }

    // 4th call should be blocked
    const r = runHook('web-budget-gate.sh', { session_id: sessionId }, { CLAUDE_HOOKS_WEB_LIMIT: '3' });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/Web budget exceeded/i);
  });

  it('uses default limit of 10 when CLAUDE_HOOKS_WEB_LIMIT not set', () => {
    const sessionId = `test-web-default-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const counterFile = `/tmp/claude-hooks-web-count-${sessionId}`;
    tempFiles.push(counterFile);

    // First call should be allowed
    const r = runHook('web-budget-gate.sh', { session_id: sessionId });
    expect(r.exitCode).toBe(0);
  });

  it('tracks per-session independently', () => {
    const sessionA = `test-web-a-${Date.now()}`;
    const sessionB = `test-web-b-${Date.now()}`;
    tempFiles.push(`/tmp/claude-hooks-web-count-${sessionA}`);
    tempFiles.push(`/tmp/claude-hooks-web-count-${sessionB}`);

    // Exhaust session A
    for (let i = 0; i < 2; i++) {
      runHook('web-budget-gate.sh', { session_id: sessionA }, { CLAUDE_HOOKS_WEB_LIMIT: '2' });
    }

    // Session B should still be allowed
    const r = runHook('web-budget-gate.sh', { session_id: sessionB }, { CLAUDE_HOOKS_WEB_LIMIT: '2' });
    expect(r.exitCode).toBe(0);
  });
});

// ─── cost-tracker.sh ───────────────────────────────────────────────────────

describe('cost-tracker.sh', () => {
  it('always exits 0', () => {
    const sessionId = `test-cost-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const logFile = `/tmp/claude-hooks-cost-${sessionId}.log`;
    tempFiles.push(logFile);

    const r = runHook('cost-tracker.sh', { session_id: sessionId, tool_name: 'Bash' });
    expect(r.exitCode).toBe(0);
  });

  it('creates log file with timestamp|tool_name entry', () => {
    const sessionId = `test-cost-log-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const logFile = `/tmp/claude-hooks-cost-${sessionId}.log`;
    tempFiles.push(logFile);

    runHook('cost-tracker.sh', { session_id: sessionId, tool_name: 'Bash' });

    expect(existsSync(logFile)).toBe(true);
    const contents = readFileSync(logFile, 'utf8');
    // Should have format: ISO_TIMESTAMP|ToolName
    expect(contents).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\|Bash\n$/);
  });

  it('appends multiple entries to log', () => {
    const sessionId = `test-cost-append-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const logFile = `/tmp/claude-hooks-cost-${sessionId}.log`;
    tempFiles.push(logFile);

    runHook('cost-tracker.sh', { session_id: sessionId, tool_name: 'Bash' });
    runHook('cost-tracker.sh', { session_id: sessionId, tool_name: 'Read' });
    runHook('cost-tracker.sh', { session_id: sessionId, tool_name: 'Write' });

    const contents = readFileSync(logFile, 'utf8');
    const lines = contents.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Bash');
    expect(lines[1]).toContain('Read');
    expect(lines[2]).toContain('Write');
  });

  it('always exits 0 even with no session_id', () => {
    const r = runHook('cost-tracker.sh', { tool_name: 'Bash' });
    expect(r.exitCode).toBe(0);
    tempFiles.push('/tmp/claude-hooks-cost-default.log');
  });
});

// ─── error-advisor.sh ──────────────────────────────────────────────────────

describe('error-advisor.sh', () => {
  it('always exits 0', () => {
    const r = runHook('error-advisor.sh', { tool_name: 'Bash', tool_response: '' });
    expect(r.exitCode).toBe(0);
  });

  it('outputs ENOENT advice to stderr', () => {
    const r = runHook('error-advisor.sh', {
      tool_name: 'Bash',
      tool_response: 'ENOENT: no such file or directory',
    });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toMatch(/error-advisor/i);
    expect(r.stderr).toMatch(/not found|ENOENT/i);
  });

  it('outputs EADDRINUSE advice to stderr', () => {
    const r = runHook('error-advisor.sh', {
      tool_name: 'Bash',
      tool_response: 'Error: listen EADDRINUSE :::3000',
    });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toMatch(/port|in use/i);
  });

  it('outputs MODULE_NOT_FOUND advice to stderr', () => {
    const r = runHook('error-advisor.sh', {
      tool_name: 'Bash',
      tool_response: "Error: Cannot find module 'express'",
    });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toMatch(/npm install/i);
  });

  it('outputs permission denied advice to stderr', () => {
    const r = runHook('error-advisor.sh', {
      tool_name: 'Bash',
      tool_response: 'permission denied: ./start.sh',
    });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toMatch(/chmod|permission/i);
  });

  it('exits 0 silently for non-Bash tools', () => {
    const r = runHook('error-advisor.sh', {
      tool_name: 'Read',
      tool_response: 'ENOENT: file not found',
    });
    expect(r.exitCode).toBe(0);
    // Should not produce any advisory output for non-Bash tools
    expect(r.stderr).toBe('');
  });

  it('exits 0 silently when no output', () => {
    const r = runHook('error-advisor.sh', { tool_name: 'Bash' });
    expect(r.exitCode).toBe(0);
  });
});
