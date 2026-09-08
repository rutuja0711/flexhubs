import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import {
  normalizeOrgSubscription,
  normalizePaymentPlans,
  normalizePlanCompliance,
  type OrgSubscriptionInfo,
  type PaymentPlanItem,
  type PlanComplianceInfo,
} from '../shared/payments';
import type {
  CreateOrgOrderInput,
  OrgOrderResult,
  WorkspaceCreationResult,
  WorkspaceBillingPeriod,
  WorkspacePlanId,
} from '../shared/workspace';
import {
  buildPaymentOrderBody,
  buildVerifySignupBody,
  normalizeOrgOrderResult,
  normalizeWorkspaceCreationResult,
  toApiBillingPeriod,
  type VerifySignupInput,
} from '../shared/workspace';
import { apiGet } from './apiRequest';

type JsonRecord = Record<string, unknown> & { error?: string };

async function postJson<T>(
  url: string,
  label: string,
  body: unknown,
  token?: string | null,
): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let data = {} as T & JsonRecord;

    try {
      data = (await response.json()) as T & JsonRecord;
    } catch {
      data = {} as T & JsonRecord;
    }

    console.log(`[${label}] status:`, response.status);
    console.log(`[${label}] request:`, body);
    console.log(`[${label}] response:`, data);

    if (!response.ok) {
      return {
        ok: false,
        error: data.error ?? 'Request failed. Please try again.',
        status: response.status,
      };
    }

    return { ok: true, data };
  } catch (error) {
    console.error(`[${label}] request failed:`, error);
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}

export async function fetchPaymentPlans(token: string | null): Promise<ApiResult<PaymentPlanItem[]>> {
  if (!token) {
    return { ok: true, data: normalizePaymentPlans(null) };
  }

  const result = await apiGet<unknown>(`${API_BASE_URL}/payments/plans`, token, 'Payment Plans API');

  if (!result.ok) {
    return { ok: true, data: normalizePaymentPlans(null) };
  }

  return { ok: true, data: normalizePaymentPlans(result.data) };
}

export async function fetchOrgSubscription(token: string): Promise<ApiResult<OrgSubscriptionInfo | null>> {
  const orgResult = await apiGet<unknown>(
    `${API_BASE_URL}/payments/org-subscription`,
    token,
    'Org Subscription API',
  );

  if (orgResult.ok) {
    return { ok: true, data: normalizeOrgSubscription(orgResult.data) };
  }

  if (!orgResult.status) {
    return orgResult as ApiResult<OrgSubscriptionInfo | null>;
  }

  const fallback = await apiGet<unknown>(
    `${API_BASE_URL}/payments/subscription`,
    token,
    'Subscription API',
  );

  if (!fallback.ok) {
    return fallback as ApiResult<OrgSubscriptionInfo | null>;
  }

  return { ok: true, data: normalizeOrgSubscription(fallback.data) };
}

export async function fetchPlanCompliance(
  token: string | null,
  planId: string,
  teamSize: number,
): Promise<ApiResult<PlanComplianceInfo>> {
  const url = `${API_BASE_URL}/payments/plan-compliance?planId=${encodeURIComponent(planId)}&teamSize=${teamSize}`;

  if (token) {
    const result = await apiGet<unknown>(url, token, 'Plan Compliance API');

    if (!result.ok) {
      return result;
    }

    return { ok: true, data: normalizePlanCompliance(result.data) };
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    let data = {} as unknown & JsonRecord;

    try {
      data = (await response.json()) as unknown & JsonRecord;
    } catch {
      data = {};
    }

    console.log('[Plan Compliance API] status:', response.status);

    if (!response.ok) {
      return {
        ok: false,
        error: data.error ?? 'Request failed. Please try again.',
        status: response.status,
      };
    }

    return { ok: true, data: normalizePlanCompliance(data) };
  } catch (error) {
    console.error('[Plan Compliance API] request failed:', error);
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}

export async function createSignupOrder(
  input: CreateOrgOrderInput,
): Promise<ApiResult<OrgOrderResult>> {
  const result = await postJson<unknown>(
    `${API_BASE_URL}/payments/create-order`,
    'Create Signup Order API',
    buildPaymentOrderBody(input),
    null,
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrgOrderResult(result.data) };
}

export async function createOrgOrder(
  token: string | null,
  input: CreateOrgOrderInput,
): Promise<ApiResult<OrgOrderResult>> {
  const primary = await postJson<unknown>(
    `${API_BASE_URL}/payments/create-org-order`,
    'Create Org Order API',
    buildPaymentOrderBody(input),
    token,
  );

  if (primary.ok) {
    return { ok: true, data: normalizeOrgOrderResult(primary.data) };
  }

  return createSignupOrder(input);
}

export async function createUpgradeOrder(
  token: string,
  input: CreateOrgOrderInput,
): Promise<ApiResult<OrgOrderResult>> {
  const result = await postJson<unknown>(
    `${API_BASE_URL}/payments/create-order`,
    'Create Upgrade Order API',
    buildPaymentOrderBody(input),
    token,
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeOrgOrderResult(result.data) };
}

export async function verifySignupPayment(
  input: VerifySignupInput,
): Promise<ApiResult<WorkspaceCreationResult>> {
  const result = await postJson<unknown>(
    `${API_BASE_URL}/payments/verify-signup`,
    'Verify Signup Payment API',
    input,
    null,
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeWorkspaceCreationResult(result.data) };
}

export async function verifyOrgSubscription(
  token: string | null,
  input: VerifySignupInput,
): Promise<ApiResult<WorkspaceCreationResult>> {
  const primary = await postJson<unknown>(
    `${API_BASE_URL}/payments/verify-org-subscription`,
    'Verify Org Subscription API',
    input,
    token,
  );

  if (primary.ok) {
    return { ok: true, data: normalizeWorkspaceCreationResult(primary.data) };
  }

  return verifySignupPayment(input);
}

export async function verifyUpgradeSubscription(
  token: string,
  input: {
    paymentId: string;
    orderId: string;
    signature: string;
    planId: string;
    billingPeriod: string;
    teamSize: number;
  },
): Promise<ApiResult<{ ok: true }>> {
  const result = await postJson<unknown>(
    `${API_BASE_URL}/payments/verify-upgrade`,
    'Verify Upgrade API',
    {
      razorpayPaymentId: input.paymentId,
      razorpayOrderId: input.orderId,
      razorpaySignature: input.signature,
      planTier: input.planId as WorkspacePlanId,
      memberCount: Math.max(1, Math.floor(Number(input.teamSize) || 1)),
      billingPeriod: toApiBillingPeriod(input.billingPeriod as WorkspaceBillingPeriod),
    },
    token,
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}
