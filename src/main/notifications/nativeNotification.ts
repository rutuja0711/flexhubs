import { Notification } from 'electron';

const activeNotifications = new Set<Notification>();

export function showNativeDesktopNotification(
  title: string,
  body: string,
  onClick?: () => void,
): boolean {
  if (!Notification.isSupported()) {
    return false;
  }

  const options: Electron.NotificationConstructorOptions = {
    title: title.trim() || 'FlexHubs',
    body: body.trim() || 'New activity',
    silent: false,
  };

  if (process.platform === 'darwin') {
    options.timeoutType = 'never';
  } else if (process.platform === 'win32') {
    (
      options as Electron.NotificationConstructorOptions & { requireInteraction?: boolean }
    ).requireInteraction = true;
  }

  const notification = new Notification(options);

  activeNotifications.add(notification);

  notification.on('click', () => {
    onClick?.();
  });

  notification.on('close', () => {
    activeNotifications.delete(notification);
  });

  notification.on('failed', () => {
    activeNotifications.delete(notification);
  });

  notification.show();
  return true;
}
