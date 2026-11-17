import { useEffect, useRef } from 'react';
import type { MainView } from '../../shared/nav';
import { isModKeyPressed, shouldIgnoreGlobalShortcut } from './keyboardShortcuts';

export type ChatKeyboardShortcutHandlers = {
  enabled: boolean;
  mainView: MainView;
  onNavigate: (view: MainView) => void;
  onOpenQuickSwitcher: () => void;
  onSearchInConversation: () => void;
  onFocusComposer: () => void;
};

export function useChatKeyboardShortcuts(handlers: ChatKeyboardShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = handlersRef.current;

      if (!active.enabled) {
        return;
      }

      if (event.key === 'Escape') {
        return;
      }

      if (!isModKeyPressed(event) && shouldIgnoreGlobalShortcut(event)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (isModKeyPressed(event) && !event.shiftKey && key === 'k') {
        event.preventDefault();
        active.onOpenQuickSwitcher();
        return;
      }

      if (isModKeyPressed(event) && !event.shiftKey && key === 'f' && active.mainView === 'chat') {
        event.preventDefault();
        active.onSearchInConversation();
        return;
      }

      if (isModKeyPressed(event) && !event.shiftKey && key === ',') {
        event.preventDefault();
        active.onNavigate('profile');
        return;
      }

      if (!isModKeyPressed(event) || !event.shiftKey) {
        return;
      }

      const viewByDigit: Record<string, MainView> = {
        '0': 'chat',
        '1': 'activity',
        '2': 'calls',
        '3': 'saved',
        '4': 'calendar',
      };

      const view = viewByDigit[key];

      if (view) {
        event.preventDefault();
        active.onNavigate(view);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });

    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);
}