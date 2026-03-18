import { describe, it, expect } from 'vitest';
import { mergeHooks } from '../../src/config/merger.js';
import type { ClaudeSettings, HookEntry } from '../../src/types/settings.js';

describe('mergeHooks', () => {
  it('adds hooks to empty settings', () => {
    const existing: ClaudeSettings = {};
    const result = mergeHooks({
      existing,
      newHooks: [{ event: 'PreToolUse', matcher: 'Edit', hook: { type: 'command', command: '/hooks/guard.sh' } }],
    });

    expect(result.settings.hooks).toBeDefined();
    expect(result.settings.hooks!['PreToolUse']).toHaveLength(1);
    expect(result.settings.hooks!['PreToolUse'][0].matcher).toBe('Edit');
    expect(result.settings.hooks!['PreToolUse'][0].hooks[0].command).toBe('/hooks/guard.sh');
    expect(result.added).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('preserves env, mcpServers, enabledPlugins, statusLine, and unknown keys', () => {
    const existing: ClaudeSettings = {
      env: { FOO: 'bar' },
      mcpServers: { myServer: { command: 'npx', args: ['server'] } },
      enabledPlugins: { myPlugin: true },
      statusLine: { type: 'command', command: 'node status.js' },
      someUnknownKey: 'preserve me',
    };

    const result = mergeHooks({
      existing,
      newHooks: [{ event: 'PostToolUse', hook: { type: 'command', command: '/hooks/post.sh' } }],
    });

    expect(result.settings.env).toEqual({ FOO: 'bar' });
    expect(result.settings.mcpServers).toEqual({ myServer: { command: 'npx', args: ['server'] } });
    expect(result.settings.enabledPlugins).toEqual({ myPlugin: true });
    expect(result.settings.statusLine).toEqual({ type: 'command', command: 'node status.js' });
    expect(result.settings.someUnknownKey).toBe('preserve me');
  });

  it('appends hooks for a new event alongside existing events', () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: '/existing.sh' }] }],
      },
    };

    const result = mergeHooks({
      existing,
      newHooks: [{ event: 'PostToolUse', hook: { type: 'command', command: '/new-post.sh' } }],
    });

    expect(result.settings.hooks!['PreToolUse']).toHaveLength(1);
    expect(result.settings.hooks!['PostToolUse']).toHaveLength(1);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].event).toBe('PostToolUse');
  });

  it('appends new hook when same event has different matcher', () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    };

    const result = mergeHooks({
      existing,
      newHooks: [{ event: 'PreToolUse', matcher: 'Bash', hook: { type: 'command', command: '/bash-guard.sh' } }],
    });

    expect(result.settings.hooks!['PreToolUse']).toHaveLength(2);
    expect(result.added).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('skips exact duplicate hook (same event+matcher+command)', () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    };

    const result = mergeHooks({
      existing,
      newHooks: [{ event: 'PreToolUse', matcher: 'Edit', hook: { type: 'command', command: '/guard.sh' } }],
    });

    expect(result.settings.hooks!['PreToolUse']).toHaveLength(1);
    expect(result.added).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('Already exists');
  });

  it('adds hook when same event+matcher but different command (not a conflict)', () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    };

    const result = mergeHooks({
      existing,
      newHooks: [{ event: 'PreToolUse', matcher: 'Edit', hook: { type: 'command', command: '/other-guard.sh' } }],
    });

    expect(result.settings.hooks!['PreToolUse']).toHaveLength(2);
    expect(result.added).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('does not mutate the input object (pure function)', () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    };
    const originalHookCount = existing.hooks!['PreToolUse'].length;

    mergeHooks({
      existing,
      newHooks: [{ event: 'PreToolUse', matcher: 'Bash', hook: { type: 'command', command: '/new.sh' } }],
    });

    // Input should be unchanged
    expect(existing.hooks!['PreToolUse']).toHaveLength(originalHookCount);
  });

  it('returns identical settings with empty added/skipped when newHooks is empty', () => {
    const existing: ClaudeSettings = {
      env: { FOO: 'bar' },
      hooks: {
        PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    };

    const result = mergeHooks({ existing, newHooks: [] });

    expect(result.settings).toEqual(existing);
    expect(result.added).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('handles hooks without matcher (matcher-less hook groups)', () => {
    const existing: ClaudeSettings = {
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: '/session-start.sh' }] }],
      },
    };

    const result = mergeHooks({
      existing,
      newHooks: [{ event: 'SessionStart', hook: { type: 'command', command: '/session-start.sh' } }],
    });

    // Same event, no matcher, same command -> duplicate -> skip
    expect(result.skipped).toHaveLength(1);
    expect(result.added).toHaveLength(0);
  });
});
