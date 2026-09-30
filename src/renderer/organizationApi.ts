import type { ApiResult } from '../shared/api';
import type {
  OrganizationInviteItem,
  OrganizationRoleItem,
  OrganizationSeatsInfo,
  OrgInvoiceItem,
} from '../shared/organization';
import type {
  OrgSubscriptionInfo,
  PaymentPlanItem,
  PlanComplianceInfo,
} from '../shared/payments';
import { normalizeOrganizationMembers, type OrganizationMemberItem } from '../shared/profile';
import type {
  CreateOrgOrderInput,
  OrgOrderResult,
  VerifySignupInput,
  WorkspaceBillingPeriod,
  WorkspaceCreationResult,
  WorkspacePlanId,
  WorkspaceTeamSetup,
} from '../shared/workspace';
import {
  buildCreateOrganizationPayload,
  buildVerifySignupBody,
  normalizeWorkspaceCreationResult,
} from '../shared/workspace';
import { getStoredToken, login } from './authApi';

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

export async function loadPaymentPlans(): Promise<ApiResult<PaymentPlanItem[]>> {
  if (!window.electronAPI?.getPaymentPlans) {
    return unavailable();
  }

  return window.electronAPI.getPaymentPlans(getStoredToken());
}

export async function loadOrgSubscription(): Promise<ApiResult<OrgSubscriptionInfo | null>> {
  return withToken((token) => window.electronAPI.getOrgSubscription(token));
}

export async function loadPlanCompliance(
  planId: string,
  teamSize: number,
): Promise<ApiResult<PlanComplianceInfo>> {
  return withToken((token) => window.electronAPI.getPlanCompliance(token, planId, teamSize));
}

export async function loadSignupPlanCompliance(
  planId: string,
  teamSize: number,
): Promise<ApiResult<PlanComplianceInfo>> {
  if (!window.electronAPI?.getPlanCompliance) {
    return unavailable();
  }

  return window.electronAPI.getPlanCompliance(null, planId, teamSize);
}

export async function createWorkspaceOrder(
  input: CreateOrgOrderInput,
): Promise<ApiResult<OrgOrderResult>> {
  if (!window.electronAPI?.createOrgOrder) {
    return unavailable();
  }

  return window.electronAPI.createOrgOrder(null, JSON.stringify(input));
}

export async function createUpgradeOrder(
  input: CreateOrgOrderInput,
): Promise<ApiResult<OrgOrderResult>> {
  return withToken((token) => window.electronAPI.createUpgradeOrder(token, JSON.stringify(input)));
}

export type VerifyWorkspaceSubscriptionParams = {
  paymentId: string;
  orderId: string;
  signature: string;
  organizationName: string;
  planId: WorkspacePlanId;
  billingPeriod: WorkspaceBillingPeriod;
  teamSize: number;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  teamSetup: WorkspaceTeamSetup;
};

export async function verifyWorkspaceSubscription(
  input: VerifyWorkspaceSubscriptionParams,
): Promise<ApiResult<WorkspaceCreationResult>> {
  if (!window.electronAPI?.verifyOrgSubscription) {
    return unavailable();
  }

  const payload: VerifySignupInput = buildVerifySignupBody(input);
  const verifyResult = await window.electronAPI.verifyOrgSubscription(null, JSON.stringify(payload));

  if (verifyResult.ok) {
    return verifyResult;
  }

  if (!window.electronAPI.createOrganizationWorkspace) {
    return verifyResult;
  }

  const orgResult = await window.electronAPI.createOrganizationWorkspace(
    null,
    JSON.stringify(buildCreateOrganizationPayload(payload)),
  );

  if (!orgResult.ok) {
    return verifyResult;
  }

  const creation = normalizeWorkspaceCreationResult(orgResult.data);

  if (creation.token || creation.accessToken) {
    return { ok: true, data: creation };
  }

  const loginResult = await login({
    email: input.email.trim(),
    password: input.password,
  });

  if (loginResult.ok) {
    return { ok: true, data: normalizeWorkspaceCreationResult(loginResult.data) };
  }

  return {
    ok: false,
    error: loginResult.error ?? verifyResult.error ?? 'Workspace could not be created.',
    status: verifyResult.status,
  };
}

export async function verifyUpgradeSubscription(input: {
  paymentId: string;
  orderId: string;
  signature: string;
  planId: string;
  billingPeriod: string;
  teamSize: number;
}): Promise<ApiResult<{ ok: true }>> {
  return withToken((token) => window.electronAPI.verifyUpgradeSubscription(token, JSON.stringify(input)));
}

export async function loadOrganizationMembersAdmin(): Promise<ApiResult<OrganizationMemberItem[]>> {
  return withToken((token) => window.electronAPI.getOrganizationMembersAdmin(token));
}

export async function loadOrganizationMembersList(canManage: boolean): Promise<{
  members: OrganizationMemberItem[];
  status?: number;
}> {
  if (canManage) {
    const adminResult = await loadOrganizationMembersAdmin();

    return {
      members: adminResult.ok ? adminResult.data : [],
      status: adminResult.ok ? 200 : adminResult.status,
    };
  }

  if (!window.electronAPI?.getOrganizationMembers) {
    return { members: [], status: undefined };
  }

  const sidebarResult = await withToken((token) => window.electronAPI.getOrganizationMembers(token));

  if (!sidebarResult.ok) {
    return {
      members: [],
      status: sidebarResult.status,
    };
  }

  return {
    members: normalizeOrganizationMembers(sidebarResult.data),
    status: 200,
  };
}

export async function removeOrganizationMember(userId: string): Promise<ApiResult<{ ok: true }>> {
  return withToken((token) => window.electronAPI.removeOrganizationMember(token, userId));
}

export async function leaveOrganizationWorkspace(): Promise<ApiResult<{ ok: true }>> {
  return withToken((token) => window.electronAPI.leaveOrganizationWorkspace(token));
}

export async function loadOrganizationRoles(): Promise<ApiResult<OrganizationRoleItem[]>> {
  return withToken((token) => window.electronAPI.getOrganizationRoles(token));
}

export async function createOrganizationRole(name: string): Promise<ApiResult<OrganizationRoleItem[]>> {
  return withToken((token) => window.electronAPI.createOrganizationRole(token, name));
}

export async function updateOrganizationRole(
  roleId: string,
  name: string,
): Promise<ApiResult<OrganizationRoleItem[]>> {
  return withToken((token) => window.electronAPI.updateOrganizationRole(token, roleId, name));
}

export async function deleteOrganizationRole(roleId: string): Promise<ApiResult<OrganizationRoleItem[]>> {
  return withToken((token) => window.electronAPI.deleteOrganizationRole(token, roleId));
}

export async function loadOrganizationInvites(): Promise<ApiResult<OrganizationInviteItem[]>> {
  return withToken((token) => window.electronAPI.getOrganizationInvites(token));
}

export async function sendOrganizationInvite(
  email: string,
  roleId: string | null,
): Promise<ApiResult<OrganizationInviteItem[]>> {
  return withToken((token) => window.electronAPI.sendOrganizationInvite(token, email, roleId));
}

export async function revokeOrganizationInvite(
  inviteId: string,
): Promise<ApiResult<OrganizationInviteItem[]>> {
  return withToken((token) => window.electronAPI.revokeOrganizationInvite(token, inviteId));
}

export async function loadOrganizationSeats(): Promise<ApiResult<OrganizationSeatsInfo>> {
  return withToken((token) => window.electronAPI.getOrganizationSeats(token));
}

export async function loadOrgInvoices(): Promise<ApiResult<OrgInvoiceItem[]>> {
  return withToken((token) => window.electronAPI.getOrgInvoices(token));
}

export async function loadOrgInvoiceById(invoiceId: string): Promise<ApiResult<OrgInvoiceItem>> {
  return withToken((token) => window.electronAPI.getOrgInvoiceById(token, invoiceId));
}

export async function loadMyOrganizationInvites(): Promise<ApiResult<OrganizationInviteItem[]>> {
  return withToken((token) => window.electronAPI.getMyOrganizationInvites(token));
}

export async function acceptOrganizationInvite(inviteId: string): Promise<ApiResult<{ ok: true }>> {
  return withToken((token) => window.electronAPI.acceptOrganizationInvite(token, inviteId));
}

export async function declineOrganizationInvite(inviteId: string): Promise<ApiResult<{ ok: true }>> {
  return withToken((token) => window.electronAPI.declineOrganizationInvite(token, inviteId));
}
