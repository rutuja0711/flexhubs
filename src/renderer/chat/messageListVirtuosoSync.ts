/** Optional hook for chat media to nudge Virtuoso after layout-changing loads (Phase 3). */

type LayoutSyncHandler = () => void;

let layoutSyncHandler: LayoutSyncHandler | null = null;

export function registerMessageListVirtuosoLayoutSync(handler: LayoutSyncHandler | null): void {
  layoutSyncHandler = handler;
}

export function notifyMessageListVirtuosoLayoutSync(): void {
  layoutSyncHandler?.();
}
