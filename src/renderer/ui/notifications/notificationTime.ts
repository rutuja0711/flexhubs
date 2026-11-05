export function formatNotificationRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  if (Number.isNaN(date.getTime())) {
    return 'now';
  }

  const diffMs = Date.now() - date.getTime();

  if (diffMs < 45_000) {
    return 'now';
  }

  if (diffMs < 90_000) {
    return '1 min ago';
  }

  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `${mins} min ago`;
  }

  if (diffMs < 86_400_000) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
