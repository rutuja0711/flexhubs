import { spawn } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';

function spawnUpdate(args: string[]): void {
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');

  spawn(updateExe, args, {
    detached: true,
    stdio: 'ignore',
  }).on('close', () => {
    app.quit();
  });
}

export function handleSquirrelStartup(): boolean {
  if (process.platform !== 'win32' || process.argv.length <= 1) {
    return false;
  }

  const squirrelCommand = process.argv[1];
  const exeName = path.basename(process.execPath);
  const shortcutArgs = [
    `--createShortcut=${exeName}`,
    '--shortcut-locations=Desktop,StartMenu',
  ];

  switch (squirrelCommand) {
    case '--squirrel-install':
    case '--squirrel-updated':
      spawnUpdate(shortcutArgs);
      return true;
    case '--squirrel-uninstall':
      spawnUpdate([`--removeShortcut=${exeName}`, '--shortcut-locations=Desktop,StartMenu']);
      return true;
    case '--squirrel-obsolete':
      app.quit();
      return true;
    default:
      return false;
  }
}
