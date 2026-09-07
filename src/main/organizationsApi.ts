import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import {
  normalizeOrganizationInvites,
  normalizeOrganizationRoles,
  normalizeOrganizationSeats,
  normalizeOrgInvoices,
  type OrganizationInviteItem,
  type OrganizationRoleItem,
  type OrganizationSeatsInfo,
  type OrgInvoiceItem,
} from '../shared/organization';
import { normalizeOrganizationMembers, type OrganizationMemberItem } from '../shared/profile';
import { apiDelete, apiGet, apiPatch, apiPost } from './apiRequest';

export async function fetchOrganizationMembersAdmin(
  token: string,
): Promise<ApiResult<OrganizationMemberItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/organizations/members`,
    token,
    'Organization Members API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrganizationMembers(result.data) };
}

export async function removeOrganizationMember(
  token: string,
  userId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/organizations/members/${userId}`,
    token,
    'Remove Organization Member API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function leaveOrganization(token: string): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/organizations/leave`,
    token,
    'Leave Organization API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function fetchOrganizationRoles(
  token: string,
): Promise<ApiResult<OrganizationRoleItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/organizations/roles`,
    token,
    'Organization Roles API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrganizationRoles(result.data) };
}

export async function createOrganizationRole(
  token: string,
  name: string,
): Promise<ApiResult<OrganizationRoleItem[]>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/organizations/roles`,
    token,
    'Create Organization Role API',
    { name },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrganizationRoles(result.data) };
}

export async function updateOrganizationRole(
  token: string,
  roleId: string,
  name: string,
): Promise<ApiResult<OrganizationRoleItem[]>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/organizations/roles`,
    token,
    'Update Organization Role API',
    { id: roleId, name },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrganizationRoles(result.data) };
}

export async function deleteOrganizationRole(
  token: string,
  roleId: string,
): Promise<ApiResult<OrganizationRoleItem[]>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/organizations/roles/${roleId}`,
    token,
    'Delete Organization Role API',
  );

  if (!result.ok) {
    const fallback = await apiDelete<unknown>(
      `${API_BASE_URL}/organizations/roles?id=${encodeURIComponent(roleId)}`,
      token,
      'Delete Organization Role API (fallback)',
    );

    if (!fallback.ok) {
      return result;
    }

    return { ok: true, data: normalizeOrganizationRoles(fallback.data) };
  }

  return { ok: true, data: normalizeOrganizationRoles(result.data) };
}

export async function fetchOrganizationInvites(
  token: string,
): Promise<ApiResult<OrganizationInviteItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/organizations/invites`,
    token,
    'Organization Invites API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrganizationInvites(result.data) };
}

export async function sendOrganizationInvite(
  token: string,
  email: string,
  roleId?: string | null,
): Promise<ApiResult<OrganizationInviteItem[]>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/organizations/invites`,
    token,
    'Send Organization Invite API',
    { email, organizationRoleId: roleId ?? undefined },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrganizationInvites(result.data) };
}

export async function revokeOrganizationInvite(
  token: string,
  inviteId: string,
): Promise<ApiResult<OrganizationInviteItem[]>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/organizations/invites/${inviteId}`,
    token,
    'Revoke Organization Invite API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrganizationInvites(result.data) };
}

export async function fetchMyOrganizationInvites(
  token: string,
): Promise<ApiResult<OrganizationInviteItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/organizations/invites/me`,
    token,
    'My Organization Invites API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrganizationInvites(result.data) };
}

export async function acceptOrganizationInvite(
  token: string,
  inviteId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/organizations/invites/${inviteId}/accept`,
    token,
    'Accept Organization Invite API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function declineOrganizationInvite(
  token: string,
  inviteId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/organizations/invites/${inviteId}/decline`,
    token,
    'Decline Organization Invite API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function fetchOrganizationSeats(
  token: string,
): Promise<ApiResult<OrganizationSeatsInfo>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/organizations/seats`,
    token,
    'Organization Seats API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrganizationSeats(result.data) };
}

export async function fetchOrgInvoices(token: string): Promise<ApiResult<OrgInvoiceItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/payments/org-invoices`,
    token,
    'Organization Invoices API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrgInvoices(result.data) };
}

export async function fetchOrgInvoiceById(
  token: string,
  invoiceId: string,
): Promise<ApiResult<OrgInvoiceItem>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/payments/invoices/${invoiceId}`,
    token,
    'Organization Invoice API',
  );

  if (!result.ok) {
    return result;
  }

  const record = result.data as Record<string, unknown>;
  const invoices = normalizeOrgInvoices(result.data);
  const invoice = invoices[0] ?? {
    id: invoiceId,
    invoiceNumber: String(record.invoiceNumber ?? invoiceId),
    date: String(record.date ?? record.createdAt ?? ''),
    planLabel: String(record.planLabel ?? record.plan ?? 'Subscription'),
    amount: typeof record.amount === 'number' ? record.amount : 0,
    url:
      typeof record.url === 'string'
        ? record.url
        : typeof record.pdfUrl === 'string'
          ? record.pdfUrl
          : undefined,
  };

  return { ok: true, data: invoice };
}

export async function createOrganization(
  payload: Record<string, unknown>,
  token?: string | null,
): Promise<ApiResult<unknown>> {
  if (token) {
    return apiPost<unknown>(`${API_BASE_URL}/organizations`, token, 'Create Organization API', payload);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as unknown & { error?: string };

    if (!response.ok) {
      return {
        ok: false,
        error: typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Could not create organization.',
        status: response.status,
      };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Unable to reach the server.' };
  }
}
