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
  plan: string;
  memberCount: number;
  status: string;
  suspended: boolean;
};

export type SuperAdminOrganizationsPage = {
  items: SuperAdminOrganization[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

function normalizeOrganization(record: Record<string, unknown>, index: number): SuperAdminOrganization {
  const statusRaw =
    readString(record.status) ??
    readString(record.state) ??
    (record.suspended === true ? 'Suspended' : 'Active');
  const normalizedStatus = statusRaw.trim() || 'Active';
  const suspended =
    record.suspended === true ||
    normalizedStatus.toLowerCase() === 'suspended' ||
    normalizedStatus.toLowerCase() === 'inactive';

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
    plan:
      readString(record.plan) ??
      readString(record.planName) ??
      readString(asRecord(record.plan)?.name) ??
      '—',
    memberCount:
      readNumber(record.memberCount) ??
      readNumber(record.members) ??
      readNumber(record.membersCount) ??
      readNumber(record.userCount) ??
      0,
    status: suspended ? 'Suspended' : normalizedStatus,
    suspended,
  };
}

export function normalizeSuperAdminOrganizations(payload: unknown): SuperAdminOrganizationsPage {
  const record = asRecord(payload) ?? {};
  const items = extractArray(payload, ['organizations', 'items', 'data', 'results'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(normalizeOrganization);

  const page = readNumber(record.page) ?? readNumber(record.currentPage) ?? 1;
  const pageSize =
    readNumber(record.pageSize) ??
    readNumber(record.limit) ??
    readNumber(record.perPage) ??
    (items.length > 0 ? items.length : 10);
  const total =
    readNumber(record.total) ??
    readNumber(record.totalCount) ??
    readNumber(record.count) ??
    items.length;
  const totalPages =
    readNumber(record.totalPages) ??
    readNumber(record.pageCount) ??
    Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));

  return {
    items,
    page: Math.max(1, page),
    pageSize: Math.max(1, pageSize),
    total: Math.max(0, total),
    totalPages: Math.max(1, totalPages),
  };
}
