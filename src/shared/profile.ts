function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const PRESENCE_STATUS_VALUES = new Set(['ONLINE', 'AWAY', 'BUSY', 'DND', 'OFFLINE']);

function isPresenceStatusValue(value: string): boolean {
  return PRESENCE_STATUS_VALUES.has(value.trim().toUpperCase());
}

function readStatusMessageFromRecord(record: Record<string, unknown>): string {
  for (const key of ['statusMessage', 'customStatus', 'message'] as const) {
    const value = readString(record[key]);

    if (value && !isPresenceStatusValue(value)) {
      return value;
    }
  }

  return '';
}

export function readUserStatusMessage(source: unknown): string {
  const record = asRecord(source);

  if (!record) {
    return '';
  }

  const candidates = [
    record,
    asRecord(record.user),
    asRecord(record.presence),
    asRecord(record.profile),
  ].filter((entry): entry is Record<string, unknown> => entry !== null);

  for (const entry of candidates) {
    const message = readStatusMessageFromRecord(entry);

    if (message) {
      return message;
    }
  }

  return '';
}

export function readUserStatusMessageUpdate(source: unknown): string | undefined {
  const record = asRecord(source);

  if (!record) {
    return undefined;
  }

  const candidates = [
    record,
    asRecord(record.user),
    asRecord(record.presence),
    asRecord(record.profile),
  ].filter((entry): entry is Record<string, unknown> => entry !== null);

  for (const entry of candidates) {
    for (const key of ['statusMessage', 'customStatus', 'message'] as const) {
      if (!(key in entry) || typeof entry[key] !== 'string') {
        continue;
      }

      const raw = entry[key] as string;
      const trimmed = raw.trim();

      if (trimmed && isPresenceStatusValue(trimmed)) {
        continue;
      }

      return trimmed;
    }
  }

  return undefined;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
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

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export type UserPresenceStatus = 'ONLINE' | 'AWAY' | 'BUSY' | 'DND' | 'OFFLINE';

export type ProfileSettings = {
  shareOnlineStatus: boolean;
  messageSoundEnabled: boolean;
  dndEnabled: boolean;
  dndUntil: string | null;
  dndDuration: string | null;
  pushEnabled: boolean;
  snoozeUntil: string | null;
  snoozeDuration: string | null;
  snoozedForever: boolean;
};

export type AvatarStyleItem = {
  id: string;
  name: string;
  previewUrl: string;
};

export type UserProfileState = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  avatarStyle: string | null;
  avatarSeed: string | null;
  avatarMode: 'avatar' | 'upload' | 'initials';
  status: UserPresenceStatus;
  statusMessage: string;
  timezone: string;
  organizationRole: string | null;
  inOrganization: boolean;
  shareOnlineStatus: boolean;
};

export type OrganizationMemberItem = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  initials: string;
  isAdmin: boolean;
  isOwner: boolean;
};

const UI_STATUS_TO_API: Record<string, UserPresenceStatus> = {
  Available: 'ONLINE',
  Away: 'AWAY',
  Busy: 'BUSY',
  'Do not disturb': 'DND',
};

const API_STATUS_TO_UI: Record<UserPresenceStatus, string> = {
  ONLINE: 'Available',
  AWAY: 'Away',
  BUSY: 'Busy',
  DND: 'Do not disturb',
  OFFLINE: 'Away',
};

export function uiStatusToApi(status: string): UserPresenceStatus {
  return UI_STATUS_TO_API[status] ?? 'ONLINE';
}

export function apiStatusToUi(status: string | null | undefined): string {
  if (!status) {
    return 'Available';
  }

  const normalized = status.toUpperCase() as UserPresenceStatus;
  return API_STATUS_TO_UI[normalized] ?? 'Available';
}

export function userPresenceDotClass(status: UserPresenceStatus): string {
  switch (status) {
    case 'AWAY':
      return 'bg-yellow-500';
    case 'BUSY':
      return 'bg-orange-500';
    case 'DND':
      return 'bg-red-500';
    case 'OFFLINE':
      return 'bg-[#666666]';
    default:
      return 'bg-[#3ecf8e]';
  }
}

export function normalizeNotificationSettings(payload: unknown): ProfileSettings {
  const root = asRecord(payload) ?? {};
  const record = asRecord(root.settings) ?? root;

  const snoozedUntil =
    readString(record.snoozeUntil) ??
    readString(record.snoozedUntil);

  const dndEnabled =
    readBoolean(record.dndEnabled) ??
    readBoolean(record.dndActive) ??
    readBoolean(record.doNotDisturb) ??
    readBoolean(record.dnd) ??
    false;

  return {
    shareOnlineStatus:
      readBoolean(record.shareOnlineStatus) ??
      readBoolean(record.sharePresence) ??
      readBoolean(record.showOnlineStatus) ??
      readBoolean(record.onlineStatusVisible) ??
      true,
    messageSoundEnabled:
      readBoolean(record.messageSoundEnabled) ??
      readBoolean(record.messageSound) ??
      readBoolean(record.soundEnabled) ??
      true,
    dndEnabled,
    dndUntil: readString(record.dndUntil),
    dndDuration: readString(record.duration) ?? readString(record.dndDuration),
    pushEnabled: readBoolean(record.pushEnabled) ?? readBoolean(record.push) ?? false,
    snoozeUntil: snoozedUntil,
    snoozeDuration: readString(record.snoozeDuration),
    snoozedForever: readBoolean(record.snoozedForever) ?? false,
  };
}

export function buildGeneratedAvatarUrl(style: string, seed: string): string {
  const safeStyle = style.trim() || 'notionists';
  const safeSeed = encodeURIComponent(seed.trim() || 'flexhubs');
  return `https://api.dicebear.com/7.x/${safeStyle}/svg?seed=${safeSeed}`;
}

export function resolveAvatarUrl(source: unknown): string | null {
  const record = asRecord(source);

  if (!record) {
    return null;
  }

  const avatarMode =
    readString(record.avatarMode) ??
    readString(record.avatarType) ??
    (record.useInitials === true ? 'initials' : null);

  if (
    record.useInitials === true ||
    avatarMode === 'initials'
  ) {
    return null;
  }

  const rawUrl =
    readString(record.avatarUrl) ??
    readString(record.avatar) ??
    readString(record.imageUrl) ??
    readString(record.iconUrl) ??
    readString(record.icon);

  if (avatarMode === 'upload' && rawUrl) {
    return normalizeUploadUrl(rawUrl);
  }

  const avatarStyle =
    readString(record.avatarStyle) ??
    readString(record.avatarStyleId) ??
    readString(record.style);

  if (avatarStyle && avatarMode !== 'upload') {
    const seed =
      readString(record.avatarSeed) ??
      readString(record.seed) ??
      readString(record.username) ??
      readString(record.email) ??
      readString(record.id) ??
      'flexhubs';

    return buildGeneratedAvatarUrl(avatarStyle, seed);
  }

  if (!rawUrl) {
    return null;
  }

  return normalizeUploadUrl(rawUrl);
}

export function normalizeAvatarStyles(payload: unknown): AvatarStyleItem[] {
  const items = extractArray(payload, ['styles', 'items', 'data']);

  return items
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const id =
        readString(record.id) ??
        readString(record.style) ??
        readString(record.slug) ??
        `style-${index}`;
      const name =
        readString(record.name) ??
        readString(record.label) ??
        readString(record.title) ??
        id;
      const seed = readString(record.previewSeed) ?? 'flexhubs';

      return {
        id,
        name,
        previewUrl:
          readString(record.previewUrl) ??
          readString(record.url) ??
          readString(record.imageUrl) ??
          buildGeneratedAvatarUrl(id, seed),
      };
    });
}

export function normalizeUserProfile(user: unknown, settings?: ProfileSettings): UserProfileState {
  const record = asRecord(user) ?? {};
  const organizationRoleRecord = asRecord(record.organizationRole);
  const roleName =
    readString(organizationRoleRecord?.name) ??
    readString(typeof record.organizationRole === 'string' ? record.organizationRole : null) ??
    readString(record.organizationRoleName) ??
    readString(record.orgRole) ??
    readString(record.role);

  const name =
    readString(record.name) ??
    readString(record.displayName) ??
    readString(record.username) ??
    '';

  const statusRaw =
    readString(record.presenceStatus) ??
    readString(record.status) ??
    'ONLINE';

  const normalizedStatus = statusRaw.toUpperCase() as UserPresenceStatus;

  return {
    id: readString(record.id) ?? readString(record.userId) ?? '',
    name,
    username: readString(record.username) ?? '',
    email: readString(record.email) ?? '',
    avatarUrl: resolveAvatarUrl(record),
    avatarStyle:
      readString(record.avatarStyle) ?? readString(record.avatarStyleId) ?? readString(record.style),
    avatarSeed: readString(record.avatarSeed) ?? readString(record.seed),
    avatarMode: (() => {
      if (record.useInitials === true) {
        return 'initials' as const;
      }

      const explicitMode =
        readString(record.avatarMode) ??
        readString(record.avatarType);

      if (explicitMode === 'initials') {
        return 'initials' as const;
      }

      if (explicitMode === 'upload') {
        return 'upload' as const;
      }

      if (explicitMode === 'avatar') {
        return 'avatar' as const;
      }

      if (readString(record.avatarStyle) ?? readString(record.avatarStyleId)) {
        return 'avatar' as const;
      }

      if (
        readString(record.avatarUrl) ??
        readString(record.avatar) ??
        readString(record.imageUrl)
      ) {
        return 'upload' as const;
      }

      return 'initials' as const;
    })(),
    status:
      normalizedStatus === 'ONLINE' ||
      normalizedStatus === 'AWAY' ||
      normalizedStatus === 'BUSY' ||
      normalizedStatus === 'DND' ||
      normalizedStatus === 'OFFLINE'
        ? normalizedStatus
        : 'ONLINE',
    statusMessage: readUserStatusMessage(record),
    timezone: readString(record.timezone) ?? readString(record.timeZone) ?? 'UTC',
    organizationRole: roleName,
    inOrganization: Boolean(
      record.inOrganization === true ||
        record.organizationId ||
        record.organization ||
        roleName,
    ),
    shareOnlineStatus: settings?.shareOnlineStatus ?? readBoolean(record.shareOnlineStatus) ?? readBoolean(record.sharePresence) ?? true,
  };
}

export function isOrganizationAdminRole(role: string | null | undefined): boolean {
  const normalized = (role ?? '').trim().toLowerCase();

  return (
    normalized.includes('admin') ||
    normalized.includes('founder') ||
    normalized.includes('owner') ||
    normalized.includes('director')
  );
}

function isWorkspaceOwnerRole(role: string | null | undefined): boolean {
  const normalized = (role ?? '').trim().toLowerCase();

  return (
    normalized === 'admin' ||
    normalized.includes('founder') ||
    normalized.includes('owner') ||
    normalized.includes('workspace creator')
  );
}

function unwrapAuthUserRecord(user: unknown): Record<string, unknown> | null {
  const record = asRecord(user);

  if (!record) {
    return null;
  }

  return asRecord(record.user) ?? record;
}

export function userIsWorkspaceOwner(user: unknown): boolean {
  const record = unwrapAuthUserRecord(user) ?? {};
  const organization = asRecord(record.organization);
  const membership = asRecord(record.membership) ?? asRecord(record.organizationMembership);
  const organizationRole = asRecord(record.organizationRole);
  const userId = readString(record.id) ?? readString(record.userId);

  if (
    record.isOwner === true ||
    record.isFounder === true ||
    record.isWorkspaceOwner === true ||
    record.createdWorkspace === true ||
    record.organizationOwner === true ||
    record.isAdmin === true ||
    record.isOrganizationAdmin === true ||
    record.canManageOrganization === true ||
    record.canManageBilling === true ||
    organization?.isAdmin === true ||
    organization?.canManageOrganization === true ||
    membership?.isOwner === true ||
    membership?.isFounder === true ||
    membership?.isCreator === true ||
    membership?.isAdmin === true ||
    membership?.isOrganizationAdmin === true
  ) {
    return true;
  }

  const ownerId =
    readString(record.organizationOwnerId) ??
    readString(organization?.ownerId) ??
    readString(organization?.createdById) ??
    readString(organization?.founderId) ??
    readString(asRecord(organization?.owner)?.id) ??
    readString(asRecord(organization?.createdBy)?.id);

  if (userId && ownerId && userId === ownerId) {
    return true;
  }

  const roleCandidates = [
    readString(organizationRole?.name),
    readString(organizationRole?.title),
    readString(typeof record.organizationRole === 'string' ? record.organizationRole : null),
    readString(record.organizationRoleName),
    readString(record.orgRole),
    readString(membership?.role),
    readString(asRecord(membership?.role)?.name),
    readString(record.workspaceRole),
    readString(record.memberRole),
  ];

  return roleCandidates.some((role) => isWorkspaceOwnerRole(role));
}

function readProfileEmail(user: unknown): string {
  const record = unwrapAuthUserRecord(user);

  if (!record) {
    return '';
  }

  return (readString(record.email) ?? '').toLowerCase();
}

function readProfileUserId(user: unknown): string {
  const record = unwrapAuthUserRecord(user);

  if (!record) {
    return '';
  }

  return readString(record.id) ?? readString(record.userId) ?? '';
}

function memberMatchesCurrentUser(
  member: OrganizationMemberItem,
  userId: string,
  profileEmail: string,
): boolean {
  if (userId && member.id === userId) {
    return true;
  }

  if (profileEmail && member.email.toLowerCase() === profileEmail) {
    return true;
  }

  return false;
}

export function userCanManageOrganization(
  user: unknown,
  members?: OrganizationMemberItem[],
): boolean {
  const record = unwrapAuthUserRecord(user) ?? {};
  const organization = asRecord(record.organization);
  const membership = asRecord(record.membership) ?? asRecord(record.organizationMembership);
  const userId = readString(record.id) ?? readString(record.userId);

  if (
    record.isOrganizationAdmin === true ||
    membership?.isOrganizationAdmin === true
  ) {
    return true;
  }

  if (
    record.isOwner === true ||
    record.isFounder === true ||
    record.createdWorkspace === true ||
    record.organizationOwner === true ||
    record.isWorkspaceOwner === true ||
    membership?.isOwner === true ||
    membership?.isFounder === true ||
    membership?.isCreator === true
  ) {
    return true;
  }

  const ownerId =
    readString(record.organizationOwnerId) ??
    readString(organization?.ownerId) ??
    readString(organization?.createdById) ??
    readString(organization?.founderId) ??
    readString(asRecord(organization?.owner)?.id) ??
    readString(asRecord(organization?.createdBy)?.id);

  if (userId && ownerId && userId === ownerId) {
    return true;
  }

  if (!members || members.length === 0) {
    return false;
  }

  const profileEmail = readProfileEmail(user);

  return members.some(
    (member) =>
      (member.isOwner || member.isAdmin) &&
      memberMatchesCurrentUser(member, userId ?? '', profileEmail),
  );
}

export function normalizeOrganizationMembers(payload: unknown): OrganizationMemberItem[] {
  return extractArray(payload, ['members', 'users', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const userRecord = asRecord(record.user) ?? record;
      const membership = asRecord(record.membership) ?? asRecord(record.organizationMembership);
      const roleRecord =
        asRecord(record.role) ??
        asRecord(userRecord.organizationRole) ??
        asRecord(membership?.role);

      const name =
        readString(userRecord.name) ??
        readString(userRecord.displayName) ??
        readString(userRecord.username) ??
        readString(record.name) ??
        'Member';

      const organizationRoleString =
        typeof record.organizationRole === 'string'
          ? readString(record.organizationRole)
          : typeof userRecord.organizationRole === 'string'
            ? readString(userRecord.organizationRole)
            : null;

      const role =
        readString(roleRecord?.name) ??
        readString(roleRecord?.title) ??
        readString(record.roleName) ??
        readString(record.jobTitle) ??
        readString(record.organizationRoleName) ??
        organizationRoleString ??
        readString(userRecord.organizationRoleName) ??
        readString(userRecord.orgRole) ??
        readString(asRecord(membership?.role)?.name) ??
        readString(membership?.roleName) ??
        readString(typeof membership?.role === 'string' ? membership.role : null) ??
        '';

      const normalizedRole = role.toLowerCase();
      const memberType = readString(record.memberType) ?? readString(record.type);
      const normalizedMemberType = (memberType ?? '').toLowerCase();
      const isOwner =
        record.isOwner === true ||
        userRecord.isOwner === true ||
        record.isFounder === true ||
        userRecord.isFounder === true ||
        record.isOrganizationOwner === true ||
        userRecord.isOrganizationOwner === true ||
        normalizedMemberType.includes('founder') ||
        normalizedMemberType.includes('owner') ||
        normalizedRole.includes('founder') ||
        normalizedRole.includes('owner');
      const isAdmin =
        isOwner ||
        record.isOrganizationAdmin === true ||
        userRecord.isOrganizationAdmin === true ||
        record.organizationAdmin === true ||
        userRecord.organizationAdmin === true;

      return {
        id:
          readString(userRecord.id) ??
          readString(record.userId) ??
          readString(record.id) ??
          `member-${index}`,
        name,
        username: readString(userRecord.username) ?? readString(record.username) ?? '',
        email:
          readString(userRecord.email) ??
          readString(record.email) ??
          '',
        role,
        avatarUrl: resolveAvatarUrl(userRecord) ?? resolveAvatarUrl(record),
        initials: initialsFromName(name),
        isAdmin,
        isOwner,
      };
    });
}

function readUploadUrlFromRecord(record: Record<string, unknown> | null): string | null {
  if (!record) {
    return null;
  }

  return (
    readString(record.url) ??
    readString(record.fileUrl) ??
    readString(record.avatarUrl) ??
    readString(record.publicUrl) ??
    readString(record.path) ??
    readString(record.location) ??
    readString(record.secure_url)
  );
}

export function extractUploadUrl(payload: unknown): string | null {
  const direct = readUploadUrlFromRecord(asRecord(payload));

  if (direct) {
    return direct;
  }

  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const dataString = readString(record.data);

  if (dataString && (/^https?:\/\//i.test(dataString) || dataString.startsWith('/'))) {
    return dataString;
  }

  for (const key of ['data', 'file', 'upload', 'result', 'image']) {
    const nestedUrl = readUploadUrlFromRecord(asRecord(record[key]));

    if (nestedUrl) {
      return nestedUrl;
    }
  }

  return null;
}

export function normalizeUploadUrl(url: string): string {
  const trimmed = url.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith('/')) {
    return `https://flexhubs.in${trimmed}`;
  }

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // API upload responses sometimes return paths like "uploads/abc.png".
  if (!trimmed.includes('://')) {
    return `https://flexhubs.in/${trimmed.replace(/^\/+/, '')}`;
  }

  return trimmed;
}

function omitNullishValues(payload: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export function buildProfileUpdatePayload(
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...updates };
  const avatarUrl = readString(updates.avatarUrl);
  const avatarMode = readString(updates.avatarMode);

  delete payload.avatarMode;

  if (avatarUrl) {
    payload.avatarUrl = avatarUrl;
    payload.avatar = avatarUrl;
  }

  if (updates.useInitials === true || avatarMode === 'initials') {
    payload.useInitials = true;
    payload.avatarType = 'initials';
    delete payload.avatarUrl;
    delete payload.avatar;
    delete payload.avatarStyle;
    delete payload.avatarStyleId;
    delete payload.avatarSeed;
    delete payload.style;
    delete payload.seed;
  } else if (avatarMode === 'upload' && avatarUrl) {
    payload.avatarType = 'upload';
    payload.useInitials = false;
    delete payload.avatarStyle;
    delete payload.avatarStyleId;
    delete payload.avatarSeed;
    delete payload.style;
    delete payload.seed;
  } else if (avatarMode === 'avatar') {
    payload.avatarType = 'avatar';
    payload.useInitials = false;
  }

  if (typeof updates.shareOnlineStatus === 'boolean') {
    payload.shareOnlineStatus = updates.shareOnlineStatus;
    payload.sharePresence = updates.shareOnlineStatus;
    payload.showOnlineStatus = updates.shareOnlineStatus;
  }

  if (typeof updates.messageSoundEnabled === 'boolean') {
    payload.messageSoundEnabled = updates.messageSoundEnabled;
    payload.messageSound = updates.messageSoundEnabled;
    payload.soundEnabled = updates.messageSoundEnabled;
  }

  if (typeof updates.username === 'string') {
    payload.username = updates.username.trim();
  }

  if (typeof updates.avatarStyle === 'string') {
    payload.avatarStyle = updates.avatarStyle;
    payload.avatarStyleId = updates.avatarStyle;
    payload.style = updates.avatarStyle;
  }

  if (typeof updates.avatarSeed === 'string') {
    payload.avatarSeed = updates.avatarSeed;
    payload.seed = updates.avatarSeed;
  }

  return omitNullishValues(payload);
}

export type NotificationPreferenceUpdate = {
  snoozeValue?: string;
  dndValue?: string;
  messageSoundEnabled?: boolean;
};

const SNOOZE_PRESET_VALUES = ['30m', '1h', '4h', '8h', '24h', 'tomorrow', 'forever', 'off'] as const;
const DND_PRESET_VALUES = ['1h', '4h', '8h', '24h', 'tomorrow', 'off'] as const;

function buildTomorrowUntil(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}

function buildSnoozePayload(value: string): Record<string, unknown> {
  const preset = SNOOZE_PRESET_VALUES.includes(value as (typeof SNOOZE_PRESET_VALUES)[number])
    ? value
    : 'off';

  if (preset === 'off') {
    return {
      snoozedUntil: null,
      snoozedForever: false,
      snoozeDuration: 'off',
    };
  }

  if (preset === 'forever') {
    return {
      snoozedUntil: null,
      snoozedForever: true,
      snoozeDuration: 'forever',
    };
  }

  if (preset === 'tomorrow') {
    return {
      snoozedUntil: buildTomorrowUntil(),
      snoozedForever: false,
      snoozeDuration: 'tomorrow',
    };
  }

  return {
    snoozedUntil: null,
    snoozedForever: false,
    snoozeDuration: preset,
  };
}

function buildDndPayload(value: string): Record<string, unknown> {
  const preset = DND_PRESET_VALUES.includes(value as (typeof DND_PRESET_VALUES)[number]) ? value : 'off';

  if (preset === 'off') {
    return {
      dndEnabled: false,
      dndUntil: null,
    };
  }

  if (preset === 'tomorrow') {
    return {
      dndEnabled: true,
      dndUntil: buildTomorrowUntil(),
      duration: 'tomorrow',
    };
  }

  return {
    dndEnabled: true,
    dndUntil: null,
    duration: preset,
  };
}

const SNOOZE_DURATION_MS: Record<string, number> = {
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '8h': 8 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};

const DND_DURATION_MS: Record<string, number> = {
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '8h': 8 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};

function closestDurationPreset(
  remainingMs: number,
  presets: Record<string, number>,
): string | null {
  let closest: string | null = null;
  let closestDelta = Infinity;

  for (const [preset, ms] of Object.entries(presets)) {
    const delta = Math.abs(remainingMs - ms);
    if (delta < closestDelta) {
      closestDelta = delta;
      closest = preset;
    }
  }

  return closest;
}

export function resolveSnoozeSelectValue(settings: ProfileSettings): string {
  const untilMs = settings.snoozeUntil ? new Date(settings.snoozeUntil).getTime() : NaN;
  const hasFutureUntil = !Number.isNaN(untilMs) && untilMs > Date.now();
  const forever = settings.snoozedForever === true;

  if (!forever && !hasFutureUntil) {
    return 'off';
  }

  if (forever || settings.snoozeDuration === 'forever') {
    return 'forever';
  }

  const duration = settings.snoozeDuration?.trim();
  if (
    duration &&
    SNOOZE_PRESET_VALUES.includes(duration as (typeof SNOOZE_PRESET_VALUES)[number]) &&
    duration !== 'off'
  ) {
    return duration;
  }

  if (hasFutureUntil) {
    const remaining = untilMs - Date.now();
    const tomorrowTarget = new Date(buildTomorrowUntil()).getTime();
    if (Math.abs(untilMs - tomorrowTarget) < 2 * 60 * 60_000) {
      return 'tomorrow';
    }

    if (remaining > 50 * 365 * 24 * 60 * 60_000) {
      return 'forever';
    }

    return closestDurationPreset(remaining, SNOOZE_DURATION_MS) ?? '1h';
  }

  return 'off';
}

export function resolveDndSelectValue(settings: ProfileSettings): string {
  if (!settings.dndEnabled) {
    return 'off';
  }

  const duration = settings.dndDuration?.trim();
  if (
    duration &&
    DND_PRESET_VALUES.includes(duration as (typeof DND_PRESET_VALUES)[number]) &&
    duration !== 'off'
  ) {
    return duration;
  }

  const untilMs = settings.dndUntil ? new Date(settings.dndUntil).getTime() : NaN;
  if (!Number.isNaN(untilMs) && untilMs > Date.now()) {
    const remaining = untilMs - Date.now();
    const tomorrowTarget = new Date(buildTomorrowUntil()).getTime();
    if (Math.abs(untilMs - tomorrowTarget) < 2 * 60 * 60_000) {
      return 'tomorrow';
    }

    return closestDurationPreset(remaining, DND_DURATION_MS) ?? '1h';
  }

  return duration && DND_PRESET_VALUES.includes(duration as (typeof DND_PRESET_VALUES)[number])
    ? duration
    : '1h';
}

function snoozeUntilFromPayload(payload: Record<string, unknown>): string | null {
  if (payload.snoozeDuration === 'off') {
    return null;
  }

  if (payload.snoozedForever === true) {
    return new Date(Date.now() + 100 * 365 * 24 * 60 * 60_000).toISOString();
  }

  const explicitUntil = readString(payload.snoozedUntil);

  if (explicitUntil) {
    return explicitUntil;
  }

  const duration = readString(payload.snoozeDuration);

  if (duration && SNOOZE_DURATION_MS[duration]) {
    return new Date(Date.now() + SNOOZE_DURATION_MS[duration]).toISOString();
  }

  return null;
}

export function applyNotificationPreferenceUpdate(
  settings: ProfileSettings,
  updates: NotificationPreferenceUpdate,
): ProfileSettings {
  let next = { ...settings };

  if (updates.snoozeValue !== undefined) {
    const snoozePayload = buildSnoozePayload(updates.snoozeValue || 'off');
    const snoozeDuration = readString(snoozePayload.snoozeDuration) ?? updates.snoozeValue;
    next = {
      ...next,
      snoozeUntil: snoozeUntilFromPayload(snoozePayload),
      snoozeDuration,
      snoozedForever: snoozePayload.snoozedForever === true,
    };
  }

  if (updates.dndValue !== undefined) {
    const payload = buildDndPayload(updates.dndValue || 'off');
    next = {
      ...next,
      dndEnabled: payload.dndEnabled === true,
      dndUntil: readString(payload.dndUntil),
      dndDuration:
        readString(payload.duration) ??
        (updates.dndValue === 'off' ? 'off' : updates.dndValue),
    };
  }

  if (updates.messageSoundEnabled !== undefined) {
    next = {
      ...next,
      messageSoundEnabled: updates.messageSoundEnabled,
    };
  }

  return next;
}

export function buildNotificationSettingsPayload(
  updates: NotificationPreferenceUpdate,
): Record<string, unknown> {
  if (updates.snoozeValue !== undefined) {
    return buildSnoozePayload(updates.snoozeValue || 'off');
  }

  if (updates.dndValue !== undefined) {
    return buildDndPayload(updates.dndValue || 'off');
  }

  return buildSnoozePayload('off');
}
