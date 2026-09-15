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
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

export type OrganizationRoleItem = {
  id: string;
  name: string;
  memberCount: number;
};

export type OrganizationInviteItem = {
  id: string;
  email: string;
  role: string;
  roleId: string | null;
  createdAt: string;
  registerUrl?: string;
};

export function toProductionRegisterUrl(registerUrl: string | null | undefined): string | null {
  if (!registerUrl?.trim()) {
    return null;
  }

  try {
    const url = new URL(registerUrl);
    url.protocol = 'https:';
    url.hostname = 'flexhubs.in';
    return url.toString();
  } catch {
    return registerUrl;
  }
}

export function extractInviteToken(registerUrl: string | null | undefined): string | null {
  if (!registerUrl?.trim()) {
    return null;
  }

  try {
    const url = new URL(registerUrl);
    const fromQuery = url.searchParams.get('invite')?.trim();
    if (fromQuery) {
      return fromQuery;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const registerIndex = parts.indexOf('register');
    if (registerIndex >= 0 && parts[registerIndex + 1]) {
      return parts[registerIndex + 1];
    }
  } catch {
    return null;
  }

  return null;
}

export type OrganizationSeatsInfo = {
  used: number;
  total: number;
  remaining: number;
};

export type OrgInvoiceItem = {
  id: string;
  invoiceNumber: string;
  date: string;
  planLabel: string;
  amount: number;
  url?: string;
};

function mapOrganizationRoleRecord(record: Record<string, unknown>, index: number): OrganizationRoleItem {
  return {
    id: readString(record.id) ?? `role-${index}`,
    name: readString(record.name) ?? readString(record.title) ?? 'Role',
    memberCount:
      readNumber(record.memberCount) ??
      readNumber(record.membersCount) ??
      readNumber(record.count) ??
      0,
  };
}

export function normalizeOrganizationRoles(payload: unknown): OrganizationRoleItem[] {
  const fromList = extractArray(payload, ['roles', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(mapOrganizationRoleRecord);

  if (fromList.length > 0) {
    return fromList;
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  const single =
    asRecord(record.role) ??
    asRecord(record.createdRole) ??
    asRecord(record.organizationRole) ??
    record;
  const name = readString(single.name) ?? readString(single.title);

  if (!name) {
    return [];
  }

  return [mapOrganizationRoleRecord(single, 0)];
}

function mapOrganizationInviteRecord(record: Record<string, unknown>, index: number): OrganizationInviteItem {
  const role = asRecord(record.role);

  return {
    id: readString(record.id) ?? `invite-${index}`,
    email: readString(record.email) ?? readString(record.inviteEmail) ?? '',
    role: readString(role?.name) ?? readString(record.roleName) ?? 'Member',
    roleId: readString(record.roleId) ?? readString(role?.id),
    createdAt: readString(record.createdAt) ?? '',
    registerUrl: readString(record.registerUrl) ?? undefined,
  };
}

export function normalizeOrganizationInvites(payload: unknown): OrganizationInviteItem[] {
  const fromList = extractArray(payload, ['invites', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(mapOrganizationInviteRecord);

  if (fromList.length > 0) {
    return fromList;
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  const singleInvite = asRecord(record.invite) ?? record;
  const email = readString(singleInvite.email) ?? readString(record.email);

  if (!email) {
    return [];
  }

  return [mapOrganizationInviteRecord(singleInvite, 0)];
}

export function normalizeOrganizationSeats(payload: unknown): OrganizationSeatsInfo {
  const record = asRecord(payload) ?? {};
  const used = readNumber(record.used) ?? readNumber(record.usedSeats) ?? readNumber(record.inUse) ?? 0;
  const total =
    readNumber(record.total) ??
    readNumber(record.totalSeats) ??
    readNumber(record.seatLimit) ??
    readNumber(record.limit) ??
    0;

  return {
    used,
    total,
    remaining: Math.max(0, readNumber(record.remaining) ?? total - used),
  };
}

export function normalizeOrgInvoices(payload: unknown): OrgInvoiceItem[] {
  return extractArray(payload, ['invoices', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => ({
      id: readString(record.id) ?? `invoice-${index}`,
      invoiceNumber:
        readString(record.invoiceNumber) ??
        readString(record.number) ??
        readString(record.id) ??
        `INV-${index + 1}`,
      date: readString(record.date) ?? readString(record.createdAt) ?? '',
      planLabel:
        readString(record.planLabel) ??
        readString(record.plan) ??
        readString(record.description) ??
        'Subscription',
      amount: readNumber(record.amount) ?? readNumber(record.total) ?? 0,
      url:
        readString(record.url) ??
        readString(record.pdfUrl) ??
        readString(record.downloadUrl) ??
        undefined,
    }));
}
