import { Command } from 'commander';

const program = new Command()
  .name('claude-hooks')
  .description('Hook manager for Claude Code — install, manage, test, and share hooks')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize claude-hooks in your project')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .option('--dry-run', 'Preview changes without writing')
  .addHelpText('after', `
Examples:
  $ claude-hooks init
  $ claude-hooks init --scope user
  $ claude-hooks init --dry-run`)
  .action(async (opts: { scope: string; dryRun?: boolean }) => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand(opts);
  });

program
  .command('restore')
  .description('Restore settings.json from the last backup')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .addHelpText('after', `
Examples:
  $ claude-hooks restore
  $ claude-hooks restore --scope user`)
  .action(async (opts: { scope: string }) => {
    const { restoreCommand } = await import('./commands/restore.js');
    await restoreCommand(opts);
  });

program
  .command('add <name>')
  .description('Install a hook from the registry into your project')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .option('--dry-run', 'Preview changes without writing')
  .addHelpText('after', `
Examples:
  $ claude-hooks add sensitive-path-guard
  $ claude-hooks add security-pack
  $ claude-hooks add cost-tracker --scope user
  $ claude-hooks add post-edit-lint --dry-run`)
  .action(async (name: string, opts: { scope: string; dryRun?: boolean }) => {
    const { addCommand } = await import('./commands/add.js');
    await addCommand({ ...opts, hookName: name });
  });

program
  .command('remove <name>')
  .description('Remove an installed hook from your project')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .option('--dry-run', 'Preview changes without writing')
  .addHelpText('after', `
Examples:
  $ claude-hooks remove sensitive-path-guard
  $ claude-hooks remove post-edit-lint --scope user
  $ claude-hooks remove web-budget-gate --dry-run`)
  .action(async (name: string, opts: { scope: string; dryRun?: boolean }) => {
    const { removeCommand } = await import('./commands/remove.js');
    await removeCommand({ ...opts, hookName: name });
  });

program
  .command('list')
  .description('List all available hooks with installed status')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .addHelpText('after', `
Examples:
  $ claude-hooks list
  $ claude-hooks list --scope user`)
  .action(async (opts: { scope: string }) => {
    const { listCommand } = await import('./commands/list.js');
    await listCommand(opts);
  });

program
  .command('doctor')
  .description('Validate hook installation health')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .addHelpText('after', `
Examples:
  $ claude-hooks doctor
  $ claude-hooks doctor --scope user
  $ claude-hooks doctor --scope project`)
  .action(async (opts: { scope: string }) => {
    const { doctorCommand } = await import('./commands/doctor.js');
    await doctorCommand(opts);
  });

program
  .command('test [hook]')
  .description('Test hooks with fixture data')
  .option('--all', 'Test all installed hooks')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .addHelpText('after', `
Examples:
  $ claude-hooks test sensitive-path-guard
  $ claude-hooks test --all`)
  .action(async (hook: string | undefined, opts: { all?: boolean; scope: string }) => {
    const { testCommand } = await import('./commands/test.js');
    await testCommand({ hookName: hook, ...opts });
  });

program
  .command('create <name>')
  .description('Scaffold a new custom hook from a template')
  .requiredOption('--event <type>', 'Hook event type (PreToolUse, PostToolUse, SessionStart, Stop)')
  .option('--matcher <pattern>', 'Tool matcher pattern (e.g., "Bash", "Edit|Write")')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .addHelpText('after', `
Examples:
  $ claude-hooks create my-guard --event PreToolUse --matcher Bash
  $ claude-hooks create session-logger --event SessionStart
  $ claude-hooks create cleanup --event Stop`)
  .action(async (name: string, opts: { event: string; matcher?: string; scope: string }) => {
    const { createCommand } = await import('./commands/create.js');
    await createCommand({ name, ...opts });
  });

program
  .command('info <hook>')
  .description('Show details for a hook: description, event, matcher, pack, and examples')
  .addHelpText('after', `
Examples:
  $ claude-hooks info sensitive-path-guard
  $ claude-hooks info web-budget-gate
  $ claude-hooks info error-advisor`)
  .action(async (hook: string) => {
    const { infoCommand } = await import('./commands/info.js');
    await infoCommand({ hookName: hook });
  });

program.parse();
