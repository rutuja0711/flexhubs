import type { WorkspaceBillingPeriod, WorkspacePlanId } from './workspace';
import { fromApiBillingPeriod } from './workspace';
import type { OrganizationSeatsInfo } from './organization';

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

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

export type PaymentPlanItem = {
  id: WorkspacePlanId;
  name: string;
  pricePerMember: number;
  minSeats: number;
  maxSeats: number | null;
  adminCount: number;
  features: string;
  contactOnly: boolean;
};

export type OrgSubscriptionInfo = {
  planId: WorkspacePlanId;
  planName: string;
  teamSize: number;
  usedSeats: number;
  billingPeriod: WorkspaceBillingPeriod;
  status: string;
  activatedAt: string;
  renewsAt: string;
};

export type PlanComplianceInfo = {
  minSeats: number;
  maxSeats: number | null;
  rules: string[];
};

const DEFAULT_PLANS: PaymentPlanItem[] = [
  {
    id: 'starter',
    name: 'Starter',
    pricePerMember: 100,
    minSeats: 2,
    maxSeats: 10,
    adminCount: 1,
    features: 'No Flex AI',
    contactOnly: false,
  },
  {
    id: 'team',
    name: 'Team',
    pricePerMember: 120,
    minSeats: 11,
    maxSeats: 15,
    adminCount: 2,
    features: '38 Flex patterns + AI',
    contactOnly: false,
  },
  {
    id: 'business',
    name: 'Business',
    pricePerMember: 150,
    minSeats: 16,
    maxSeats: 20,
    adminCount: 3,
    features: 'All Flex patterns + AI',
    contactOnly: false,
  },
  {
    id: 'custom',
    name: 'Custom',
    pricePerMember: 0,
    minSeats: 21,
    maxSeats: null,
    adminCount: 0,
    features: 'Contact support for pricing',
    contactOnly: true,
  },
];

function resolvePlanId(value: unknown): WorkspacePlanId | null {
  const raw = String(value ?? '').toLowerCase().trim();

  if (!raw) {
    return null;
  }

  if (raw.includes('custom')) return 'custom';
  if (raw.includes('business')) return 'business';
  if (raw.includes('team')) return 'team';
  if (raw.includes('starter')) return 'starter';

  return null;
}

function normalizePlanId(value: unknown, index = 0): WorkspacePlanId {
  return resolvePlanId(value) ?? (['starter', 'team', 'business', 'custom'] as const)[index] ?? 'team';
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = readNumber(value);

    if (parsed !== null && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    const parsed = readString(value);

    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function normalizeBillingPeriod(value: unknown): WorkspaceBillingPeriod {
  const raw = pickString(value);

  if (!raw) {
    return 'monthly';
  }

  return fromApiBillingPeriod(raw);
}

export function mergeOrgSubscriptionWithSeats(
  subscription: OrgSubscriptionInfo | null,
  seats: OrganizationSeatsInfo | null | undefined,
): OrgSubscriptionInfo | null {
  if (!subscription) {
    if (!seats || seats.total <= 0) {
      return null;
    }

    const planId = resolvePlanId(seats.planTier);

    if (!planId) {
      return null;
    }

    const defaultPlan = DEFAULT_PLANS.find((plan) => plan.id === planId);

    return {
      planId,
      planName: defaultPlan?.name ?? planId,
      teamSize: seats.total,
      usedSeats: seats.used,
      billingPeriod: 'monthly',
      status: 'active',
      activatedAt: '',
      renewsAt: '',
    };
  }

  return {
    ...subscription,
    teamSize: subscription.teamSize > 0 ? subscription.teamSize : (seats?.total ?? 0),
    usedSeats: subscription.usedSeats > 0 ? subscription.usedSeats : (seats?.used ?? 0),
  };
}

export function normalizePaymentPlans(payload: unknown): PaymentPlanItem[] {
  const items = extractArray(payload, ['plans', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null);

  if (items.length === 0) {
    return DEFAULT_PLANS;
  }

  return items.map((record, index) => {
    const id = normalizePlanId(record.tier ?? record.id ?? record.slug ?? record.name, index);
    const contactOnly = id === 'custom' || record.contactOnly === true || record.contactSales === true;

    return {
      id,
      name: readString(record.label) ?? readString(record.name) ?? DEFAULT_PLANS.find((plan) => plan.id === id)?.name ?? 'Plan',
      pricePerMember:
        readNumber(record.pricePerSeatInr) ??
        readNumber(record.pricePerMember) ??
        readNumber(record.price) ??
        readNumber(record.amount) ??
        DEFAULT_PLANS.find((plan) => plan.id === id)?.pricePerMember ??
        0,
      minSeats:
        readNumber(record.minMembers) ??
        readNumber(record.minSeats) ??
        readNumber(record.defaultMembers) ??
        DEFAULT_PLANS.find((plan) => plan.id === id)?.minSeats ??
        1,
      maxSeats:
        readNumber(record.maxMembers) ??
        readNumber(record.maxSeats) ??
        readNumber(record.memberLimit) ??
        DEFAULT_PLANS.find((plan) => plan.id === id)?.maxSeats ??
        null,
      adminCount:
        readNumber(record.maxAdmins) ??
        readNumber(record.adminCount) ??
        readNumber(record.admins) ??
        DEFAULT_PLANS.find((plan) => plan.id === id)?.adminCount ??
        1,
      features:
        readString(record.featureSummary) ??
        readString(record.features) ??
        readString(record.description) ??
        DEFAULT_PLANS.find((plan) => plan.id === id)?.features ??
        '',
      contactOnly,
    };
  });
}

export function normalizeOrgSubscription(payload: unknown): OrgSubscriptionInfo | null {
  const root = asRecord(payload);

  if (!root) {
    return null;
  }

  const details = asRecord(root.subscription) ?? root;
  const organization = asRecord(details.organization);
  const seatUsage = asRecord(details.seatUsage);

  const planId = resolvePlanId(
    organization?.planTier ?? details.planTier ?? seatUsage?.planTier,
  );

  if (!planId) {
    return null;
  }

  const defaultPlan = DEFAULT_PLANS.find((item) => item.id === planId);
  const planName = defaultPlan?.name ?? planId;

  const teamSize =
    pickNumber(organization?.seatLimit, seatUsage?.seatLimit, details.seatLimit, details.memberCount) ?? 0;

  const usedSeats = pickNumber(seatUsage?.seatsUsed, details.seatsUsed, details.membersInUse) ?? 0;

  const billingRaw = pickString(details.billingPeriod, organization?.billingPeriod);

  const status =
    pickString(organization?.subscriptionStatus, details.subscriptionStatus, details.status) ?? 'active';

  const activatedAt =
    pickString(details.subscriptionActivatedAt, details.activatedAt, details.activatedOn) ?? '';

  const renewsAt =
    pickString(details.subscriptionExpiresAt, details.renewsAt, details.renewalDate) ?? '';

  return {
    planId,
    planName,
    teamSize,
    usedSeats,
    billingPeriod: billingRaw ? normalizeBillingPeriod(billingRaw) : 'monthly',
    status,
    activatedAt,
    renewsAt,
  };
}

export function normalizePlanCompliance(payload: unknown): PlanComplianceInfo {
  const root = asRecord(payload) ?? {};
  const record = asRecord(root.compliance) ?? root;

  const rulesRaw = extractArray(record.rules, ['items']).length
    ? extractArray(record.rules, ['items'])
    : Array.isArray(record.rules)
      ? record.rules
      : [];

  const issueRules = extractArray(record, ['issues'])
    .map(asRecord)
    .map((issue) => readString(issue?.message))
    .filter((item): item is string => Boolean(item));

  const rules =
    rulesRaw.length > 0
      ? rulesRaw
          .map((item) =>
            typeof item === 'string' ? item : readString(asRecord(item)?.text ?? asRecord(item)?.rule),
          )
          .filter((item): item is string => Boolean(item))
      : issueRules;

  return {
    minSeats: readNumber(record.minSeats) ?? readNumber(record.minimumSeats) ?? 1,
    maxSeats: readNumber(record.maxSeats) ?? readNumber(record.maximumSeats),
    rules,
  };
}

export function getDefaultPaymentPlans(): PaymentPlanItem[] {
  return DEFAULT_PLANS;
}

export function billingPeriodLabel(period: WorkspaceBillingPeriod): string {
  if (period === '6months') return '6 months';
  if (period === 'annual') return 'Annual';
  return 'Monthly';
}

export function billingPeriodMultiplier(period: WorkspaceBillingPeriod): number {
  if (period === '6months') return 6;
  if (period === 'annual') return 12;
  return 1;
}

export function calculatePlanTotal(
  pricePerMember: number,
  teamSize: number,
  billingPeriod: WorkspaceBillingPeriod,
): { subtotal: number; gst: number; total: number } {
  const subtotal = teamSize * pricePerMember * billingPeriodMultiplier(billingPeriod);
  const gst = subtotal * 0.18;

  return { subtotal, gst, total: subtotal + gst };
}
