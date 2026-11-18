#!/usr/bin/env node
/**
 * Static verification: Windows taskbar badge (setOverlayIcon) wiring.
 * Run: npm run verify:windows-taskbar-badge
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

function read(relPath) {
  return fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Missing ${label}: expected to find ${JSON.stringify(needle)}`);
  }
}

function main() {
  const appBadge = read('src/main/appBadge.ts');
  const ipc = read('src/main/ipc/registerAllIpc.ts');
  const preload = read('src/preload.ts');
  const renderer = read('src/renderer/desktopAppBadge.ts');
  const chatPage = read('src/renderer/ChatPage.tsx');
  const mainTs = read('src/main.ts');

  assertIncludes(appBadge, "process.platform === 'darwin'", 'macOS dock badge branch');
  assertIncludes(appBadge, 'setOverlayIcon', 'Windows overlay API');
  assertIncludes(appBadge, 'createWindowsOverlayImage', 'Windows overlay image builder');
  assertIncludes(read('src/main/windowsTaskbarBadgeBitmap.ts'), 'createFromBuffer', 'Windows RGBA bitmap badge');
  assertIncludes(appBadge, 'setBadgeHostWindow', 'badge host window registration');
  assertIncludes(ipc, "'desktop:set-app-badge'", 'IPC channel desktop:set-app-badge');
  assertIncludes(ipc, 'updateApplicationBadge', 'IPC calls updateApplicationBadge');
  assertIncludes(preload, 'desktop:set-app-badge', 'preload exposes setAppBadge');
  assertIncludes(renderer, 'syncDesktopAppBadge', 'renderer badge sync helper');
  assertIncludes(renderer, 'window.electronAPI.setAppBadge', 'renderer invokes setAppBadge');
  assertIncludes(chatPage, 'pushDesktopAppBadge', 'ChatPage syncs badge');
  assertIncludes(chatPage, 'onRequestBadgeSync', 'main can request badge resync');
  assertIncludes(mainTs, 'setBadgeHostWindow(mainWindow)', 'main registers badge host on window create');
  assertIncludes(mainTs, 'desktop:request-badge-sync', 'main requests badge sync after load');

  console.log('[FlexHubs] Windows taskbar badge wiring check passed.');
  console.log('[FlexHubs] On Windows: unread count should show a red overlay on the taskbar icon.');
  console.log('[FlexHubs] Note: Windows hides overlays when taskbar uses "Use small taskbar buttons".');
}

try {
  main();
} catch (error) {
  console.error('[FlexHubs] Windows taskbar badge wiring check failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}