import { resolveAvatarUrl } from './profile';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNameFromRecord(record: Record<string, unknown>): string | null {
  return (
    readString(record.name) ??
    readString(record.displayName) ??
    readString(record.title) ??
    readString(record.username)
  );
}

export function unwrapAuthUser(user: unknown): unknown {
  const record = asRecord(user);

  if (!record) {
    return user;
  }

  const nestedUser = asRecord(record.user);

  return nestedUser ?? user;
}

export function getUserId(user: unknown): string | null {
  const record = asRecord(unwrapAuthUser(user));

  if (!record) {
    return null;
  }

  return readString(record.id) ?? readString(record.userId);
}

export function getUserUsername(user: unknown): string | null {
  const record = asRecord(user);

  if (!record) {
    return null;
  }

  return readString(record.username) ?? readString(record.handle);
}

export function getUserDisplayName(user: unknown): string {
  const record = asRecord(user);

  if (!record) {
    return 'Your account';
  }

  return (
    readNameFromRecord(record) ??
    readString(record.email) ??
    'Your account'
  );
}

export function getWorkspaceName(user: unknown): string {
  const record = asRecord(user);

  if (!record) {
    return 'Your workspace';
  }

  const organization = asRecord(record.organization);
  const workspace = asRecord(record.workspace);

  const orgName =
    readString(record.organizationName) ??
    (organization ? readNameFromRecord(organization) : null) ??
    (workspace ? readNameFromRecord(workspace) : null) ??
    readString(record.companyName);

  if (orgName) {
    return orgName.endsWith('Workspace') ? orgName : `${orgName} Workspace`;
  }

  return 'Your workspace';
}

export function getWorkspaceShortName(user: unknown): string {
  const record = asRecord(user);

  if (!record) {
    return 'Your workspace';
  }

  const organization = asRecord(record.organization);
  const workspace = asRecord(record.workspace);

  return (
    readString(record.organizationName) ??
    (organization ? readNameFromRecord(organization) : null) ??
    (workspace ? readNameFromRecord(workspace) : null) ??
    readString(record.companyName) ??
    'Your workspace'
  );
}

export function getUserAvatarUrl(user: unknown): string | null {
  return resolveAvatarUrl(user);
}

export function getUserInitials(user: unknown): string {
  const name = getUserDisplayName(user);
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export function userInOrganization(user: unknown): boolean {
  const record = asRecord(unwrapAuthUser(user));

  if (!record) {
    return false;
  }

  if (record.inOrganization === true) {
    return true;
  }

  if (readString(record.organizationId)) {
    return true;
  }

  const organization = asRecord(record.organization);
  return Boolean(organization && (readString(organization.id) ?? readNameFromRecord(organization)));
}
