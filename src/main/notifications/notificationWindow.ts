/** Custom overlay notifications are disabled — native OS notifications only. */

export function isNotificationOverlayWebContents(_webContentsId: number): boolean {
  return false;
}

export function setNotificationHostWindowProvider(_provider: () => unknown): void {
  // no-op
}

export function closeNotificationWindow(): void {
  // no-op
}

export function destroyNotificationWindow(): void {
  // no-op
}

export function showCustomDesktopNotification(_payload: unknown, _onClickCallback?: () => void): boolean {
  return false;
}
