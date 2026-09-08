function formatCallDebugMessage(message: string, details?: unknown): string {
  if (details === undefined) {
    return message;
  }

  if (typeof details === 'string') {
    return `${message} ${details}`;
  }

  try {
    return `${message} ${JSON.stringify(details)}`;
  } catch {
    return `${message} [unserializable details]`;
  }
}

export function logCallDebug(message: string, details?: unknown): void {
  const formatted = formatCallDebugMessage(message, details);

  console.log(formatted);
  void window.electronAPI.logRendererDebug(formatted).catch(() => undefined);
}
