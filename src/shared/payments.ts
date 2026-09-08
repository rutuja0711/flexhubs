import type { WorkspaceBillingPeriod, WorkspacePlanId } from './workspace';

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

function normalizePlanId(value: unknown, index = 0): WorkspacePlanId {
  const raw = String(value ?? '').toLowerCase().trim();

  if (raw.includes('starter')) return 'starter';
  if (raw.includes('business')) return 'business';
  if (raw.includes('custom')) return 'custom';
  if (raw.includes('team')) return 'team';

  const byIndex: WorkspacePlanId[] = ['starter', 'team', 'business', 'custom'];
  return byIndex[index] ?? 'team';
}

function normalizeBillingPeriod(value: unknown): WorkspaceBillingPeriod {
  const raw = String(value ?? '').toLowerCase();

  if (raw.includes('annual') || raw.includes('year')) return 'annual';
  if (raw.includes('semi') || raw.includes('6')) return '6months';
  return 'monthly';
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

  const record =
    asRecord(root.subscription) ??
    asRecord(root.orgSubscription) ??
    asRecord(root.data) ??
    root;

  const plan = asRecord(record.plan) ?? record;
  const planId = normalizePlanId(plan.id ?? record.planId ?? record.planTier);

  return {
    planId,
    planName: readString(plan.name) ?? readString(record.planName) ?? planId,
    teamSize: readNumber(record.teamSize) ?? readNumber(record.seats) ?? readNumber(record.memberLimit) ?? 0,
    usedSeats: readNumber(record.usedSeats) ?? readNumber(record.membersInUse) ?? readNumber(record.used) ?? 0,
    billingPeriod: normalizeBillingPeriod(record.billingPeriod ?? record.interval),
    status: readString(record.status) ?? 'active',
    activatedAt: readString(record.activatedAt) ?? readString(record.startedAt) ?? '',
    renewsAt: readString(record.renewsAt) ?? readString(record.renewalDate) ?? readString(record.endsAt) ?? '',
  };
}

export function normalizePlanCompliance(payload: unknown): PlanComplianceInfo {
  const record = asRecord(payload) ?? {};

  const rulesRaw = extractArray(record.rules, ['items']).length
    ? extractArray(record.rules, ['items'])
    : Array.isArray(record.rules)
      ? record.rules
      : [];

  return {
    minSeats: readNumber(record.minSeats) ?? readNumber(record.minimumSeats) ?? 1,
    maxSeats: readNumber(record.maxSeats) ?? readNumber(record.maximumSeats),
    rules: rulesRaw
      .map((item) => (typeof item === 'string' ? item : readString(asRecord(item)?.text ?? asRecord(item)?.rule)))
      .filter((item): item is string => Boolean(item)),
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
