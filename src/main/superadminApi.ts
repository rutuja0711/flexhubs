import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import {
  normalizeSuperAdminOrganizationMembers,
  normalizeSuperAdminOrganizations,
  normalizeSuperAdminStats,
  normalizeSuperAdminSuspendResult,
  type SuperAdminOrganizationMembersResponse,
  type SuperAdminOrganizationsListOptions,
  type SuperAdminOrganizationsPage,
  type SuperAdminStats,
  type SuperAdminSuspendOrganizationResult,
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
  options?: SuperAdminOrganizationsListOptions,
): Promise<ApiResult<SuperAdminOrganizationsPage>> {
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    limit: String(Math.max(1, Math.min(50, pageSize))),
  });

  const q = options?.q?.trim();
  if (q) {
    params.set('q', q);
  }
  if (options?.sort) {
    params.set('sort', options.sort);
  }
  const plan = options?.plan?.trim().toLowerCase();
  if (plan) {
    params.set('plan', plan);
  }

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

export async function fetchSuperAdminOrganizationMembers(
  token: string,
  organizationId: string,
): Promise<ApiResult<SuperAdminOrganizationMembersResponse>> {
  const encoded = encodeURIComponent(organizationId);
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/superadmin/organizations/${encoded}/members`,
    token,
    'Superadmin Organization Members API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeSuperAdminOrganizationMembers(result.data) };
}

export async function suspendSuperAdminOrganization(
  token: string,
  organizationId: string,
  suspend: boolean,
): Promise<ApiResult<SuperAdminSuspendOrganizationResult>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/superadmin/organizations/suspend`,
    token,
    'Superadmin Suspend Organization API',
    { organizationId, suspend },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeSuperAdminSuspendResult(result.data) };
}
