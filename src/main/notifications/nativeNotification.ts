import { Notification } from 'electron';
import { WINDOWS_NOTIFICATION_DISPLAY_NAME } from '../../shared/desktopAppId';
import { resolveNotificationIconImage, resolveAppIconPngPath } from '../appBrandAssets';
import fs from 'node:fs';

type TrackedNotification = {
  notification: Notification;
  conversationId?: string | null;
};

const activeNotifications = new Set<Notification>();
const activeByTag = new Map<string, TrackedNotification>();
const activeByConversation = new Map<string, Set<string>>();

function trackConversationTag(conversationId: string | null | undefined, tag: string): void {
  if (!conversationId) {
    return;
  }

  const tags = activeByConversation.get(conversationId) ?? new Set<string>();
  tags.add(tag);
  activeByConversation.set(conversationId, tags);
}

function untrackConversationTag(conversationId: string | null | undefined, tag: string): void {
  if (!conversationId) {
    return;
  }

  const tags = activeByConversation.get(conversationId);
  if (!tags) {
    return;
  }

  tags.delete(tag);
  if (tags.size === 0) {
    activeByConversation.delete(conversationId);
  }
}

function detachNotification(tag: string | undefined, tracked: TrackedNotification): void {
  activeNotifications.delete(tracked.notification);
  if (tag) {
    activeByTag.delete(tag);
    untrackConversationTag(tracked.conversationId, tag);
  }
}

export function closeDesktopNotificationByTag(tag: string): void {
  const tracked = activeByTag.get(tag);
  if (!tracked) {
    return;
  }

  tracked.notification.close();
  detachNotification(tag, tracked);
}

export function closeDesktopNotificationsForConversation(conversationId: string): void {
  const tags = activeByConversation.get(conversationId);
  if (!tags) {
    return;
  }

  for (const tag of [...tags]) {
    closeDesktopNotificationByTag(tag);
  }
}

function formatNativeNotificationCopy(
  title: string,
  body: string,
): { title: string; body: string } {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();

  if (process.platform === 'win32') {
    const appName = WINDOWS_NOTIFICATION_DISPLAY_NAME;

    if (
      trimmedTitle &&
      trimmedTitle !== appName &&
      trimmedTitle !== trimmedBody &&
      !trimmedBody.startsWith(`${trimmedTitle}:`)
    ) {
      return {
        title: appName,
        body: trimmedBody ? `${trimmedTitle}\n${trimmedBody}` : trimmedTitle,
      };
    }

    return {
      title: appName,
      body: trimmedBody || trimmedTitle || 'New activity',
    };
  }

  return {
    title: trimmedTitle || WINDOWS_NOTIFICATION_DISPLAY_NAME,
    body: trimmedBody || 'New activity',
  };
}

export function showNativeDesktopNotification(
  title: string,
  body: string,
  onClick?: () => void,
  options?: {
    tag?: string;
    conversationId?: string | null;
  },
): boolean {
  if (!Notification.isSupported()) {
    return false;
  }

  const tag = options?.tag?.trim();
  if (tag) {
    closeDesktopNotificationByTag(tag);
  }

  const copy = formatNativeNotificationCopy(title, body);

  const constructorOptions: Electron.NotificationConstructorOptions = {
    title: copy.title,
    body: copy.body,
    // Windows: renderer plays FlexHubs chime; macOS keeps system alert (1.0.32 behavior).
    silent: process.platform === 'win32',
  };

  if (tag) {
    (constructorOptions as Electron.NotificationConstructorOptions & { tag?: string }).tag = tag;
  }

  if (process.platform === 'darwin') {
    constructorOptions.timeoutType = 'never';
  }

  // macOS: `icon` becomes the large image on the *right*; the app tile on the left comes from the bundle.
  if (process.platform !== 'darwin') {
    const iconImage = resolveNotificationIconImage();
    const iconPath = resolveAppIconPngPath();

    if (iconImage && !iconImage.isEmpty()) {
      constructorOptions.icon = iconImage;
    } else if (fs.existsSync(iconPath)) {
      constructorOptions.icon = iconPath;
    }
  }

  const notification = new Notification(constructorOptions);
  const tracked: TrackedNotification = {
    notification,
    conversationId: options?.conversationId ?? null,
  };

  activeNotifications.add(notification);
  if (tag) {
    activeByTag.set(tag, tracked);
    trackConversationTag(tracked.conversationId, tag);
  }

  notification.on('click', () => {
    onClick?.();
  });

  notification.on('close', () => {
    detachNotification(tag, tracked);
  });

  notification.on('failed', () => {
    console.warn(
      '[FlexHubs] Native notification failed (system blocked or missing shell registration).',
      tag ? `tag=${tag}` : '',
      process.platform,
    );
    detachNotification(tag, tracked);
  });

  try {
    notification.show();
  } catch (error) {
    console.warn('[FlexHubs] notification.show() threw:', error);
    detachNotification(tag, tracked);
    return false;
  }

  return true;
}