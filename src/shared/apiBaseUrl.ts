const DEFAULT_API_BASE_URL = 'https://flexhubs.in/api';

declare const __FLEXHUBS_API_BASE_URL__: string | undefined;

export function readConfiguredApiBaseUrl(): string {
  const injected =
    typeof __FLEXHUBS_API_BASE_URL__ !== 'undefined' ? __FLEXHUBS_API_BASE_URL__.trim() : '';

  if (injected) {
    return injected.replace(/\/$/, '');
  }

  return DEFAULT_API_BASE_URL;
}
