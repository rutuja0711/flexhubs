import { unwrapAuthUser } from './user';

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
  const record = asRecord(payload);

  if (!record) {
    return Array.isArray(payload) ? payload : [];
  }

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return Array.isArray(payload) ? payload : [];
}

function readRoleFlag(record: Record<string, unknown>): boolean {
  const roleCandidates = [
    readString(record.role),
    readString(record.platformRole),
    readString(record.userType),
    readString(record.accountType),
    readString(asRecord(record.membership)?.role),
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

  return roleCandidates.some(
    (role) =>
      role === 'superadmin' ||
      role === 'super_admin' ||
      role === 'super-admin' ||
      role === 'platform_admin' ||
      role === 'platform-admin',
  );
}

export function userIsSuperAdmin(user: unknown): boolean {
  const record = asRecord(unwrapAuthUser(user));

  if (!record) {
    return false;
  }

  if (
    record.isSuperAdmin === true ||
    record.isPlatformAdmin === true ||
    record.superAdmin === true ||
    record.platformAdmin === true
  ) {
    return true;
  }

  if (readRoleFlag(record)) {
    return true;
  }

  const email = readString(record.email)?.toLowerCase();
  const username = readString(record.username)?.toLowerCase();

  if (email === 'superadmin@flexhubs.local' || username === 'superadmin') {
    return true;
  }

  const nested = asRecord(record.user);

  if (nested) {
    if (
      nested.isSuperAdmin === true ||
      nested.isPlatformAdmin === true ||
      nested.superAdmin === true ||
      nested.platformAdmin === true
    ) {
      return true;
    }

    if (readRoleFlag(nested)) {
      return true;
    }
  }

  return false;
}

export type SuperAdminStats = {
  totalUsers: number;
  totalOrganizations: number;
  totalMessages: number;
};

export type SuperAdminOrganization = {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  subscriptionStatus: string;
  isSuspended: boolean;
  memberCount: number;
  createdAt: string;
};

export type SuperAdminOrganizationsSort =
  | 'newest'
  | 'oldest'
  | 'plan_asc'
  | 'plan_desc'
  | 'name_asc'
  | 'name_desc';

export type SuperAdminOrganizationsListOptions = {
  q?: string;
  sort?: SuperAdminOrganizationsSort;
  plan?: string;
};

export type SuperAdminOrganizationsPage = {
  organizations: SuperAdminOrganization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  sort?: SuperAdminOrganizationsSort;
  query?: string;
  plan?: string;
};

export type SuperAdminOrganizationMember = {
  id: string;
  username: string;
  email: string;
  accountStatus: 'ACTIVE' | 'INVITED' | 'DELETED';
  isOrganizationAdmin: boolean;
  organizationRole: { id: string; name: string } | null;
  joinedAt: string;
};

export type SuperAdminOrganizationPendingInvite = {
  id: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'REJECTED';
  role: { id: string; name: string } | null;
  invitedAt: string;
};

export type SuperAdminOrganizationMembersResponse = {
  organization: {
    id: string;
    name: string;
    slug: string;
    isSuspended: boolean;
    planTier: string;
    subscriptionStatus: string;
  };
  members: SuperAdminOrganizationMember[];
  pendingInvites: SuperAdminOrganizationPendingInvite[];
  adminCount: number;
};

export type SuperAdminSuspendOrganizationResult = {
  organization: {
    id: string;
    name: string;
    isSuspended: boolean;
  };
};

function readCount(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = readNumber(record[key]);

    if (value !== null) {
      return value;
    }
  }

  return 0;
}

export function normalizeSuperAdminStats(payload: unknown): SuperAdminStats {
  const record = asRecord(payload) ?? {};
  const stats = asRecord(record.stats) ?? record;

  return {
    totalUsers: readCount(stats, ['totalUsers', 'users', 'userCount']),
    totalOrganizations: readCount(stats, ['totalOrganizations', 'organizations', 'organizationCount']),
    totalMessages: readCount(stats, ['totalMessages', 'messages', 'messageCount']),
  };
}

function readRoleRef(record: Record<string, unknown>): { id: string; name: string } | null {
  const role = asRecord(record.role) ?? asRecord(record.organizationRole);

  if (!role) {
    return null;
  }

  const id = readString(role.id) ?? '';
  const name = readString(role.name);

  if (!name) {
    return null;
  }

  return { id: id || name, name };
}

function readAccountStatus(value: unknown): SuperAdminOrganizationMember['accountStatus'] {
  const raw = readString(value)?.toUpperCase();

  if (raw === 'INVITED' || raw === 'DELETED') {
    return raw;
  }

  return 'ACTIVE';
}

function normalizeOrganization(record: Record<string, unknown>, index: number): SuperAdminOrganization {
  const isSuspended =
    record.isSuspended === true ||
    record.suspended === true;

  const planTier =
    readString(record.planTier) ??
    readString(record.plan) ??
    readString(record.planName) ??
    readString(asRecord(record.plan)?.name) ??
    '—';

  return {
    id:
      readString(record.id) ??
      readString(record.organizationId) ??
      readString(record.slug) ??
      `org-${index}`,
    name:
      readString(record.name) ??
      readString(record.organizationName) ??
      readString(record.title) ??
      'Untitled organization',
    slug: readString(record.slug) ?? readString(record.handle) ?? '—',
    planTier,
    subscriptionStatus: readString(record.subscriptionStatus) ?? '—',
    isSuspended,
    memberCount:
      readNumber(record.memberCount) ??
      readNumber(record.members) ??
      readNumber(record.membersCount) ??
      readNumber(record.userCount) ??
      0,
    createdAt:
      readString(record.createdAt) ??
      readString(record.created_at) ??
      '',
  };
}

export function normalizeSuperAdminOrganizations(payload: unknown): SuperAdminOrganizationsPage {
  const record = asRecord(payload) ?? {};
  const organizations = extractArray(payload, ['organizations', 'items', 'data', 'results'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(normalizeOrganization);

  const paginationRecord = asRecord(record.pagination) ?? record;
  const limit =
    readNumber(paginationRecord.limit) ??
    readNumber(paginationRecord.pageSize) ??
    readNumber(paginationRecord.perPage) ??
    10;
  const page = readNumber(paginationRecord.page) ?? readNumber(paginationRecord.currentPage) ?? 1;
  const total =
    readNumber(paginationRecord.total) ??
    readNumber(paginationRecord.totalCount) ??
    readNumber(record.total) ??
    organizations.length;
  const totalPages =
    readNumber(paginationRecord.totalPages) ??
    readNumber(paginationRecord.pageCount) ??
    Math.max(1, Math.ceil(total / Math.max(limit, 1)));

  const sortRaw = readString(record.sort);
  const sortValues: SuperAdminOrganizationsSort[] = [
    'newest',
    'oldest',
    'plan_asc',
    'plan_desc',
    'name_asc',
    'name_desc',
  ];
  const sort = sortValues.includes(sortRaw as SuperAdminOrganizationsSort)
    ? (sortRaw as SuperAdminOrganizationsSort)
    : undefined;
  const query = readString(record.query) ?? undefined;
  const planFilter = readString(record.plan) ?? undefined;

  return {
    organizations,
    pagination: {
      page: Math.max(1, page),
      limit: Math.max(1, Math.min(50, limit)),
      total: Math.max(0, total),
      totalPages: Math.max(1, totalPages),
    },
    ...(sort ? { sort } : {}),
    ...(query?.trim() ? { query: query.trim() } : {}),
    ...(planFilter?.trim() ? { plan: planFilter.trim() } : {}),
  };
}

function normalizeMember(record: Record<string, unknown>, index: number): SuperAdminOrganizationMember {
  return {
    id: readString(record.id) ?? `member-${index}`,
    username: readString(record.username) ?? '—',
    email: readString(record.email) ?? '—',
    accountStatus: readAccountStatus(record.accountStatus ?? record.status),
    isOrganizationAdmin: record.isOrganizationAdmin === true,
    organizationRole: readRoleRef(record),
    joinedAt: readString(record.joinedAt) ?? readString(record.createdAt) ?? '',
  };
}

function normalizePendingInvite(
  record: Record<string, unknown>,
  index: number,
): SuperAdminOrganizationPendingInvite {
  const statusRaw = readString(record.status)?.toUpperCase();

  return {
    id: readString(record.id) ?? `invite-${index}`,
    email: readString(record.email) ?? '—',
    status:
      statusRaw === 'ACCEPTED' || statusRaw === 'REVOKED' || statusRaw === 'REJECTED'
        ? statusRaw
        : 'PENDING',
    role: readRoleRef(record),
    invitedAt: readString(record.invitedAt) ?? readString(record.createdAt) ?? '',
  };
}

export function normalizeSuperAdminOrganizationMembers(
  payload: unknown,
): SuperAdminOrganizationMembersResponse {
  const record = asRecord(payload) ?? {};
  const orgRecord = asRecord(record.organization) ?? record;

  const members = extractArray(record, ['members', 'users', 'items'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(normalizeMember);

  const pendingInvites = extractArray(record, ['pendingInvites', 'invites', 'pending'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(normalizePendingInvite);

  return {
    organization: {
      id: readString(orgRecord.id) ?? '',
      name: readString(orgRecord.name) ?? '—',
      slug: readString(orgRecord.slug) ?? '—',
      isSuspended: orgRecord.isSuspended === true || orgRecord.suspended === true,
      planTier:
        readString(orgRecord.planTier) ??
        readString(orgRecord.plan) ??
        '—',
      subscriptionStatus: readString(orgRecord.subscriptionStatus) ?? '—',
    },
    members,
    pendingInvites,
    adminCount: readNumber(record.adminCount) ?? members.filter((m) => m.isOrganizationAdmin).length,
  };
}

export function normalizeSuperAdminSuspendResult(payload: unknown): SuperAdminSuspendOrganizationResult {
  const record = asRecord(payload) ?? {};
  const org = asRecord(record.organization) ?? record;

  return {
    organization: {
      id: readString(org.id) ?? '',
      name: readString(org.name) ?? '—',
      isSuspended: org.isSuspended === true || org.suspended === true,
    },
  };
}

/** Capitalize plan tier for display (e.g. business → Business). */
export function formatSuperAdminPlanTier(planTier: string): string {
  const trimmed = planTier.trim();

  if (!trimmed || trimmed === '—') {
    return '—';
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function formatSuperAdminAccountStatus(status: SuperAdminOrganizationMember['accountStatus']): string {
  switch (status) {
    case 'INVITED':
      return 'Invited (incomplete)';
    case 'DELETED':
      return 'Deleted';
    default:
      return 'Active';
  }
}