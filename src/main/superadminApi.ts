import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import {
  normalizeSuperAdminOrganizations,
  normalizeSuperAdminStats,
  type SuperAdminOrganizationsPage,
  type SuperAdminStats,
} from '../shared/superadmin';
import { apiGet, apiPost } from './apiRequest';

export async function fetchSuperAdminStats(token: string): Promise<ApiResult<SuperAdminStats>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/superadmin/stats`,
    token,
    'Superadmin Stats API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeSuperAdminStats(result.data) };
}

export async function fetchSuperAdminOrganizations(
  token: string,
  page: number,
  pageSize = 10,
): Promise<ApiResult<SuperAdminOrganizationsPage>> {
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    limit: String(Math.max(1, pageSize)),
  });

  const result = await apiGet<unknown>(
    `${API_BASE_URL}/superadmin/organizations?${params.toString()}`,
    token,
    'Superadmin Organizations API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeSuperAdminOrganizations(result.data) };
}

export async function suspendSuperAdminOrganization(
  token: string,
  organizationId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/superadmin/organizations/suspend`,
    token,
    'Superadmin Suspend Organization API',
    { organizationId, id: organizationId },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}
