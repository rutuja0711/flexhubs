import type { ApiResult } from '../shared/api';
import type { SuperAdminOrganizationsPage, SuperAdminStats } from '../shared/superadmin';
import { getStoredToken } from './authApi';

function unavailable<T>(): ApiResult<T> {
  return { ok: false, error: 'Desktop API is not available.' };
}

async function withToken<T>(
  runner: (token: string) => Promise<ApiResult<T>>,
): Promise<ApiResult<T>> {
  const token = getStoredToken();

  if (!token) {
    return { ok: false, error: 'Not authenticated.', status: 401 };
  }

  return runner(token);
}

export async function loadSuperAdminStats(): Promise<ApiResult<SuperAdminStats>> {
  if (!window.electronAPI?.getSuperAdminStats) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getSuperAdminStats(token));
}

export async function loadSuperAdminOrganizations(
  page: number,
  pageSize = 10,
): Promise<ApiResult<SuperAdminOrganizationsPage>> {
  if (!window.electronAPI?.getSuperAdminOrganizations) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getSuperAdminOrganizations(token, page, pageSize));
}

export async function suspendSuperAdminOrganization(
  organizationId: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.suspendSuperAdminOrganization) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.suspendSuperAdminOrganization(token, organizationId));
}
