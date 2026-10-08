import type { DragEvent } from 'react';
import { prepareChatFileDrag } from '../chatApi';

const dragPathByUrl = new Map<string, string>();
const prepareInFlight = new Map<string, Promise<string | null>>();

function cacheKey(url: string, fileName: string): string {
  return `${url.trim()}::${fileName.trim() || 'file'}`;
}

/** Hide the default HTML5 drag ghost (often picks up unrelated UI like the app logo). */
function suppressNativeDragPreview(event: DragEvent): void {
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    event.dataTransfer.setDragImage(target, 12, 12);
    return;
  }

  const ghost = document.createElement('div');
  ghost.style.width = '1px';
  ghost.style.height = '1px';
  ghost.style.opacity = '0';
  ghost.style.position = 'fixed';
  ghost.style.left = '-9999px';
  ghost.style.top = '0';
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, 0, 0);
  window.requestAnimationFrame(() => {
    ghost.remove();
  });
}

export async function warmChatFileDragPath(url: string, fileName: string): Promise<string | null> {
  if (!window.electronAPI?.prepareChatFileDrag || !url.trim()) {
    return null;
  }

  const key = cacheKey(url, fileName);
  const cached = dragPathByUrl.get(key);
  if (cached) {
    return cached;
  }

  const pending = prepareInFlight.get(key);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    const result = await prepareChatFileDrag(url, fileName || 'file');
    if (!result.ok) {
      return null;
    }

    dragPathByUrl.set(key, result.filePath);
    return result.filePath;
  })();

  prepareInFlight.set(key, task);
  try {
    return await task;
  } finally {
    prepareInFlight.delete(key);
  }
}

export function beginChatFileDrag(
  event: DragEvent,
  url: string,
  fileName: string,
  options?: { disabled?: boolean },
): void {
  if (options?.disabled || !url.trim()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  suppressNativeDragPreview(event);

  if (!window.electronAPI?.startChatFileDragFromPath) {
    return;
  }

  const key = cacheKey(url, fileName);
  const cachedPath = dragPathByUrl.get(key);
  if (cachedPath) {
    window.electronAPI.startChatFileDragFromPath(cachedPath);
    return;
  }

  void warmChatFileDragPath(url, fileName);
}
