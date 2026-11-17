export type ShortcutCategory = 'navigation' | 'messaging' | 'editing' | 'search' | 'calls' | 'general';

export type KeyboardShortcut = {
  id: string;
  label: string;
  category: ShortcutCategory;
  macKeys: string;
  winKeys: string;
};

type ClientPlatform = 'mac' | 'win' | 'other';

export function detectClientPlatform(): ClientPlatform {
  if (typeof navigator === 'undefined') {
    return 'other';
  }

  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const uaPlatform = userAgentData?.platform?.toLowerCase();

  if (uaPlatform === 'macos') {
    return 'mac';
  }

  if (uaPlatform === 'windows') {
    return 'win';
  }

  const navPlatform = navigator.platform ?? '';

  if (/Mac|iPhone|iPod|iPad/i.test(navPlatform)) {
    return 'mac';
  }

  if (/Win/i.test(navPlatform)) {
    return 'win';
  }

  const ua = navigator.userAgent ?? '';

  if (/Windows/i.test(ua)) {
    return 'win';
  }

  if (/Macintosh|Mac OS X/i.test(ua)) {
    return 'mac';
  }

  return 'other';
}

export function isMacPlatform(): boolean {
  return detectClientPlatform() === 'mac';
}

export function isWindowsPlatform(): boolean {
  return detectClientPlatform() === 'win';
}

export function platformDisplayName(): string {
  const platform = detectClientPlatform();

  if (platform === 'mac') {
    return 'macOS';
  }

  if (platform === 'win') {
    return 'Windows';
  }

  return 'your platform';
}

export function metaKeyName(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}

export function formatShortcut(shortcut: KeyboardShortcut): string {
  return isMacPlatform() ? shortcut.macKeys : shortcut.winKeys;
}

export function isModKeyPressed(event: KeyboardEvent): boolean {
  return isMacPlatform() ? event.metaKey : event.ctrlKey;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();

  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest('[contenteditable="true"]'));
}

export function shouldIgnoreGlobalShortcut(event: KeyboardEvent): boolean {
  if (event.isComposing || event.keyCode === 229) {
    return true;
  }

  const target = event.target;

  if (isEditableTarget(target) && !event.metaKey && !event.ctrlKey && event.key !== 'Escape') {
    const tag = target instanceof HTMLElement ? target.tagName.toLowerCase() : '';

    if (tag === 'textarea' || tag === 'input') {
      return true;
    }
  }

  return false;
}

export const CHAT_KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { id: 'nav-activity', label: 'Open Activity', category: 'navigation', macKeys: '⌘⇧1', winKeys: 'Ctrl+Shift+1' },
  { id: 'nav-calls', label: 'Open Calls', category: 'navigation', macKeys: '⌘⇧2', winKeys: 'Ctrl+Shift+2' },
  { id: 'nav-saved', label: 'Open Saved', category: 'navigation', macKeys: '⌘⇧3', winKeys: 'Ctrl+Shift+3' },
  { id: 'nav-calendar', label: 'Open Calendar', category: 'navigation', macKeys: '⌘⇧4', winKeys: 'Ctrl+Shift+4' },
  { id: 'nav-profile', label: 'Open Profile settings', category: 'navigation', macKeys: '⌘,', winKeys: 'Ctrl+,' },
  { id: 'nav-chat', label: 'Return to chats', category: 'navigation', macKeys: '⌘⇧0', winKeys: 'Ctrl+Shift+0' },
  { id: 'quick-switcher', label: 'Quick chat switcher (search sidebar)', category: 'navigation', macKeys: '⌘K', winKeys: 'Ctrl+K' },
  { id: 'search-conversation', label: 'Search in conversation', category: 'search', macKeys: '⌘F', winKeys: 'Ctrl+F' },
  { id: 'send-message', label: 'Send message', category: 'messaging', macKeys: 'Enter', winKeys: 'Enter' },
  { id: 'newline', label: 'New line in composer', category: 'messaging', macKeys: '⇧Enter', winKeys: 'Shift+Enter' },
  { id: 'edit-last', label: 'Edit last sent message (empty composer)', category: 'editing', macKeys: '↑', winKeys: '↑' },
  { id: 'cancel', label: 'Cancel edit / close panel', category: 'editing', macKeys: 'Esc', winKeys: 'Esc' },
  { id: 'message-menu', label: 'Open message menu', category: 'messaging', macKeys: '⇧F10', winKeys: 'Shift+F10' },
];