import type { LoginSuccess } from './auth';

export type WorkspacePlanId = 'starter' | 'team' | 'business' | 'custom';
export type WorkspaceBillingPeriod = 'monthly' | '6months' | 'annual';
export type ApiBillingPeriod = 'monthly' | 'semiannual' | 'annual';

export function toApiBillingPeriod(period: WorkspaceBillingPeriod): ApiBillingPeriod {
  if (period === '6months') {
    return 'semiannual';
  }

  return period;
}

export function fromApiBillingPeriod(period: string): WorkspaceBillingPeriod {
  const raw = period.toLowerCase();
  if (raw.includes('semi') || raw.includes('6')) return '6months';
  if (raw.includes('annual') || raw.includes('year')) return 'annual';
  return 'monthly';
}

export type CreateOrgOrderInput = {
  planId: WorkspacePlanId;
  billingPeriod: WorkspaceBillingPeriod;
  teamSize: number;
};

export type PaymentOrderApiBody = {
  planTier: WorkspacePlanId;
  memberCount: number;
  billingPeriod: ApiBillingPeriod;
};

export type OrgOrderResult = {
  id: string;
  amount: number;
  currency: string;
  key?: string;
  devBypass?: boolean;
};

export type WorkspaceSeatInput = {
  role: string;
  admin: boolean;
  inviteEmail: string;
};

export type WorkspaceTeamSetup = {
  roles: string[];
  slots: Array<{
    roleName: string;
    isAdmin: boolean;
    email: string;
  }>;
};

export type VerifySignupInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  organizationName: string;
  planTier: WorkspacePlanId;
  memberCount: number;
  billingPeriod: ApiBillingPeriod;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  teamSetup: WorkspaceTeamSetup;
};

export type VerifyOrgSubscriptionInput = VerifySignupInput;

export type WorkspaceCreationResult = LoginSuccess;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeTeamSize(value: number): number {
  const size = Math.floor(Number(value));
  return Number.isFinite(size) && size > 0 ? size : 1;
}

export function buildPaymentOrderBody(input: CreateOrgOrderInput): PaymentOrderApiBody {
  return {
    planTier: input.planId,
    memberCount: normalizeTeamSize(input.teamSize),
    billingPeriod: toApiBillingPeriod(input.billingPeriod),
  };
}

/** @deprecated Use buildPaymentOrderBody */
export function buildCreateOrgOrderBody(input: CreateOrgOrderInput): PaymentOrderApiBody {
  return buildPaymentOrderBody(input);
}

export function buildCreateOrganizationPayload(input: VerifySignupInput): Record<string, unknown> {
  return {
    name: input.organizationName,
    organizationName: input.organizationName,
    planTier: input.planTier,
    planId: input.planTier,
    memberCount: input.memberCount,
    billingPeriod: input.billingPeriod,
    username: input.username,
    email: input.email,
    password: input.password,
    confirmPassword: input.confirmPassword,
    teamSetup: input.teamSetup,
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
  };
}

export function buildVerifySignupBody(input: {
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
}): VerifySignupInput {
  return {
    razorpayOrderId: input.orderId,
    razorpayPaymentId: input.paymentId,
    razorpaySignature: input.signature,
    organizationName: input.organizationName,
    planTier: input.planId,
    memberCount: normalizeTeamSize(input.teamSize),
    billingPeriod: toApiBillingPeriod(input.billingPeriod),
    username: input.username,
    email: input.email,
    password: input.password,
    confirmPassword: input.confirmPassword,
    teamSetup: input.teamSetup,
  };
}

/** @deprecated Use buildVerifySignupBody */
export function buildVerifyOrgSubscriptionBody(input: {
  paymentId: string;
  orderId: string;
  signature: string;
  planId: WorkspacePlanId;
  billingPeriod: WorkspaceBillingPeriod;
  teamSize: number;
  orgDetails: {
    name: string;
    username: string;
    workEmail: string;
    password: string;
    seats: WorkspaceSeatInput[];
  };
}): never {
  throw new Error('Use buildVerifySignupBody with teamSetup instead.');
}

export function normalizeOrgOrderResult(payload: unknown): OrgOrderResult {
  const record = asRecord(payload) ?? {};

  return {
    id: readString(record.id) ?? readString(record.orderId) ?? '',
    amount: readNumber(record.amount) ?? 0,
    currency: readString(record.currency) ?? 'INR',
    key: readString(record.key) ?? readString(record.keyId) ?? undefined,
    devBypass: record.devBypass === true,
  };
}

export function normalizeWorkspaceCreationResult(payload: unknown): WorkspaceCreationResult {
  const record = asRecord(payload) ?? {};

  return {
    token: readString(record.token) ?? undefined,
    accessToken: readString(record.accessToken) ?? undefined,
    user: record.user ?? record,
    ...record,
  };
}
