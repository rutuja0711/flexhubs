import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FiBell,
  FiBellOff,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiEdit2,
  FiEye,
  FiLogOut,
  FiMail,
  FiMoon,
  FiStar,
  FiSun,
  FiUpload,
  FiUser,
  FiVolume2,
  FiHeadphones,
  FiShield,
  FiSmartphone,
  FiDownloadCloud,
} from 'react-icons/fi';
import { RemoteImage } from '../RemoteImage';
import {
  apiStatusToUi,
  applyNotificationPreferenceUpdate,
  buildGeneratedAvatarUrl,
  mergeProfileSettingsFromUser,
  mergeRemoteUserStatus,
  normalizeNotificationSettings,
  normalizeUserProfile,
  resolveDndSelectValue,
  formatNotificationQuietUntil,
  isAppSnoozeActive,
  resolveSnoozeSelectValue,
  uiStatusToApi,
  type AvatarStyleItem,
  type ProfileSettings,
  type UserPresenceStatus,
  type UserProfileState,
} from '../../shared/profile';
import { formatTimezoneLabel, getTimezoneOptions } from '../../shared/timezones';
import { getUserAvatarUrl, getUserInitials } from '../../shared/user';
import { getCurrentUser } from '../authApi';
import {
  getEffectivePresenceStatus,
  getPresenceStatusMessage,
  setManualPresenceStatus,
  setPresenceSharingEnabled,
  subscribePresenceManager,
  syncPresenceToServer,
} from '../presenceManager';
import { presenceDotClassForUiLabel } from './presenceStatusUi';
import {
  loadAvatarStyles,
  loadBlockedUsers,
  loadResolvedUserStatus,
  loadNotificationSettings,
  saveNotificationSettings,
  saveUserProfile,
  saveUserStatus,
  saveUserTimezone,
  unblockUser,
  uploadUserProfileImage,
} from '../chatApi';
import { useTheme } from '../theme/ThemeProvider';
import { useToast } from '../ui/Toast';
import {
  disableDesktopPushNotifications,
  enableDesktopPushNotifications,
  shouldDeliverDesktopNotifications,
} from '../pushNotifications';
import { playMessageNotificationSound } from '../messageSound';
import {
  getPreferredAudioOutputDeviceId,
  labelForAudioOutputDevice,
  listAudioOutputDevices,
  setPreferredAudioOutputDeviceId,
} from '../audioOutputDevice';
import { UpdatesSettings } from './UpdatesSettings';
import { PrivacySettings } from './PrivacySettings';
import {
  markUserUnblocked,
  refreshBlockedUsersFromApi,
  setBlockedUserIdsFromList,
} from '../blockedUsersSync';
import {
  mergePrivacySettings,
  mergeStoredPrivacySettings,
  pickPrivacySettings,
  readStoredPrivacySettings,
  writeStoredPrivacySettings,
} from '../privacySettingsStorage';
import { clearProfileCache, readProfileCache, writeProfileCache } from '../profileCache';
import {
  isFlexHubsHostedAssetUrl,
  peekAuthenticatedMediaUrl,
  resolveAuthenticatedMediaUrl,
} from '../authenticatedMedia';
import { pickPreferredAvatarUrl } from '../../shared/chat';
import { normalizeUploadUrl } from '../../shared/profile';

type ProfileSettingsViewProps = {
  user: unknown;
  sessionNotificationSettings?: ProfileSettings | null;
  onLogout: () => void;
  onUnauthorized: (status?: number) => boolean;
  onUserUpdated?: () => void;
  hasUpdateBadge?: boolean;
  onUpdateViewed?: () => void;
  onNotificationSettingsChange?: (settings: ProfileSettings) => void;
  initialTab?: 'profile' | 'appearance' | 'notifications' | 'privacy' | 'updates';
};

type AvatarTab = 'avatar' | 'upload' | 'initials';

const SNOOZE_OPTIONS = [
  { label: 'Notifications on', value: 'off' },
  { label: '30 minutes', value: '30m' },
  { label: '1 hour', value: '1h' },
  { label: '4 hours', value: '4h' },
  { label: '8 hours', value: '8h' },
  { label: '24 hours', value: '24h' },
  { label: 'Until tomorrow', value: 'tomorrow' },
  { label: 'Forever', value: 'forever' },
] as const;

const DND_OPTIONS = [
  { label: 'Off', value: 'off' },
  { label: '1 hour', value: '1h' },
  { label: '4 hours', value: '4h' },
  { label: '8 hours', value: '8h' },
  { label: '24 hours', value: '24h' },
  { label: 'Until tomorrow', value: 'tomorrow' },
] as const;

function formatLocalTime(timezone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).format(new Date());
  } catch {
    return new Date().toLocaleTimeString();
  }
}

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function dndLabel(settings: ProfileSettings): string {
  if (!settings.dndEnabled) {
    return 'Off';
  }

  if (settings.dndUntil && new Date(settings.dndUntil).getTime() > Date.now()) {
    return `On until ${new Date(settings.dndUntil).toLocaleString()}`;
  }

  return 'On';
}

function areProfileSettingsEqual(a: ProfileSettings, b: ProfileSettings): boolean {
  return (
    a.shareOnlineStatus === b.shareOnlineStatus &&
    a.showLastActive === b.showLastActive &&
    a.readReceipts === b.readReceipts &&
    a.profileVisibility === b.profileVisibility &&
    a.emailVisibility === b.emailVisibility &&
    a.statusVisibility === b.statusVisibility &&
    a.allowDirectMessagesFrom === b.allowDirectMessagesFrom &&
    a.callPrivacy === b.callPrivacy &&
    a.messageSoundEnabled === b.messageSoundEnabled &&
    a.dndEnabled === b.dndEnabled &&
    a.dndUntil === b.dndUntil &&
    a.dndDuration === b.dndDuration &&
    a.pushEnabled === b.pushEnabled &&
    a.snoozeUntil === b.snoozeUntil &&
    a.snoozeDuration === b.snoozeDuration &&
    a.snoozedForever === b.snoozedForever
  );
}

function resolveSessionUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const id = (user as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id : null;
}

function statusDotClass(statusUi: string): string {
  return presenceDotClassForUiLabel(statusUi);
}

function resolveAvatarPreviewSrc(imageUrl: string | null): string | null {
  if (!imageUrl?.trim()) {
    return null;
  }

  const normalized = normalizeUploadUrl(imageUrl.trim());
  if (normalized.startsWith('blob:') || normalized.startsWith('data:')) {
    return normalized;
  }

  if (!isFlexHubsHostedAssetUrl(normalized)) {
    return normalized;
  }

  return peekAuthenticatedMediaUrl(normalized);
}

function AvatarPreviewCircle({
  imageUrl,
  initials,
  uploading,
  uploadSucceeded,
  sizeClass = 'h-[4.5rem] w-[4.5rem]',
}: {
  imageUrl: string | null;
  initials: string;
  uploading?: boolean;
  uploadSucceeded?: boolean;
  sizeClass?: string;
}) {
  const logicalSrcRef = useRef<string | null>(null);
  const [displaySrc, setDisplaySrc] = useState<string | null>(() => resolveAvatarPreviewSrc(imageUrl));
  const [remoteFailed, setRemoteFailed] = useState(false);

  useEffect(() => {
    if (!imageUrl?.trim()) {
      logicalSrcRef.current = null;
      setRemoteFailed(false);
      setDisplaySrc(null);
      return;
    }

    const normalized = normalizeUploadUrl(imageUrl.trim());
    const logicalKey = normalized;

    if (
      normalized.startsWith('blob:') ||
      normalized.startsWith('data:') ||
      !isFlexHubsHostedAssetUrl(normalized)
    ) {
      logicalSrcRef.current = logicalKey;
      setRemoteFailed(false);
      setDisplaySrc(normalized);
      return;
    }

    const cached = peekAuthenticatedMediaUrl(normalized);
    if (cached) {
      logicalSrcRef.current = logicalKey;
      setRemoteFailed(false);
      setDisplaySrc(cached);
      return;
    }

    if (logicalSrcRef.current !== logicalKey) {
      setDisplaySrc(null);
    }
    logicalSrcRef.current = logicalKey;
    setRemoteFailed(false);

    let cancelled = false;
    void resolveAuthenticatedMediaUrl(imageUrl)
      .then((nextSrc) => {
        if (!cancelled && nextSrc !== normalized) {
          setDisplaySrc(nextSrc);
        } else if (!cancelled) {
          setRemoteFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const showDirect = Boolean(displaySrc) && (displaySrc?.startsWith('blob:') || displaySrc?.startsWith('data:'));
  const showRemote = Boolean(displaySrc) && !showDirect && !remoteFailed;

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full bg-app-chat-hover ${sizeClass}`}>
      {showDirect ? (
        <img src={displaySrc!} alt="" className="h-full w-full object-cover" />
      ) : showRemote ? (
        <RemoteImage
          src={displaySrc}
          alt=""
          loading="eager"
          wrapperClassName="flex h-full w-full"
          className="h-full w-full object-cover"
          onError={() => setRemoteFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-lg font-bold text-app-text">
          {initials}
        </span>
      )}

      {uploading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 backdrop-blur-[1px]">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span className="text-[10px] font-semibold text-white">Uploading…</span>
        </div>
      ) : null}

      {uploadSucceeded && !uploading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-green-600/75 animate-in fade-in duration-200">
          <FiCheck className="h-7 w-7 text-white" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-app-border bg-app-surface shadow-xs ${className}`}>
      {children}
    </div>
  );
}

function NavButton({ icon, label, active, onClick, danger }: { icon: ReactNode, label: string, active?: boolean, onClick: () => void, danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${danger
          ? 'text-red-500 hover:bg-red-500/10 font-semibold'
          : active
            ? 'bg-app-chat-hover text-app-text font-bold'
            : 'text-app-muted hover:bg-app-chat-hover/50 hover:text-app-text font-medium'
        }`}
    >
      <span className="text-[1.1rem] shrink-0">{icon}</span>
      {label}
    </button>
  );
}

export function ProfileSettingsView({
  user,
  sessionNotificationSettings = null,
  onLogout,
  onUnauthorized,
  onUserUpdated,
  hasUpdateBadge,
  onUpdateViewed,
  onNotificationSettingsChange,
  initialTab = 'profile',
}: ProfileSettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'privacy' | 'updates'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [profile, setProfile] = useState<UserProfileState | null>(null);
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [avatarStyles, setAvatarStyles] = useState<AvatarStyleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusUi, setStatusUi] = useState('Available');
  const [statusMessage, setStatusMessage] = useState('');
  const [savedStatusMessage, setSavedStatusMessage] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatarPreviewUrl, setLocalAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadSucceeded, setAvatarUploadSucceeded] = useState(false);
  const [avatarTab, setAvatarTab] = useState<AvatarTab>('avatar');
  const [selectedStyle, setSelectedStyle] = useState('notionists');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameEditing, setUsernameEditing] = useState(false);
  const [savedUsername, setSavedUsername] = useState('');
  const [snoozeValue, setSnoozeValue] = useState('off');
  const [dndValue, setDndValue] = useState('off');
  const [pushEnabled, setPushEnabled] = useState(() => shouldDeliverDesktopNotifications());
  const [pushBusy, setPushBusy] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<import('../../shared/features').BlockedUserItem[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const [hwAccelerationDisabled, setHwAccelerationDisabled] = useState<boolean>(false);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState(() =>
    getPreferredAudioOutputDeviceId(),
  );

  useEffect(() => {
    void window.electronAPI?.getHardwareAccelerationDisabled?.().then(disabled => {
      setHwAccelerationDisabled(disabled);
    });
  }, []);

  const refreshAudioOutputDevices = useCallback(async () => {
    const outputs = await listAudioOutputDevices();
    setAudioOutputDevices(outputs);
    setSelectedAudioOutputId(getPreferredAudioOutputDeviceId());
  }, []);

  useEffect(() => {
    void refreshAudioOutputDevices();

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) {
      return;
    }

    const onDeviceChange = () => {
      void refreshAudioOutputDevices();
    };

    mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => mediaDevices.removeEventListener('devicechange', onDeviceChange);
  }, [refreshAudioOutputDevices]);

  const handleAudioOutputChange = (deviceId: string) => {
    setSelectedAudioOutputId(deviceId);
    setPreferredAudioOutputDeviceId(deviceId);
    toast.success('Speaker output updated.');
  };

  const handleToggleHwAcceleration = async () => {
    const nextState = !hwAccelerationDisabled;
    setHwAccelerationDisabled(nextState);
    if (window.electronAPI?.setHardwareAccelerationDisabled) {
      await window.electronAPI.setHardwareAccelerationDisabled(nextState);

      const shouldRestart = window.confirm(
        'Hardware acceleration settings have been updated.\n\nThe app must be restarted for this change to take effect. Restart now?'
      );
      if (shouldRestart) {
        await window.electronAPI.relaunchApp?.();
      }
    }
  };
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  const uploadSuccessTimeoutRef = useRef<number | undefined>(undefined);
  const localPreviewRef = useRef<string | null>(null);
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const sessionAvatarUrl = useMemo(() => getUserAvatarUrl(user), [user]);
  const sessionUserId = useMemo(() => resolveSessionUserId(user), [user]);

  const settingsRef = useRef(settings);
  const avatarStylesRef = useRef(avatarStyles);
  const sessionNotificationSettingsRef = useRef(sessionNotificationSettings);
  const onNotificationSettingsChangeRef = useRef(onNotificationSettingsChange);
  const applyProfileSnapshotRef = useRef<
    (
      nextProfile: UserProfileState,
      nextSettings: ProfileSettings,
      nextStyles: AvatarStyleItem[],
      options?: { syncParentNotificationSettings?: boolean },
    ) => void
  >(() => {});
  const refreshProfileRef = useRef<(options?: { silent?: boolean }) => Promise<void>>(
    async () => {},
  );

  settingsRef.current = settings;
  avatarStylesRef.current = avatarStyles;
  sessionNotificationSettingsRef.current = sessionNotificationSettings;
  onNotificationSettingsChangeRef.current = onNotificationSettingsChange;

  useEffect(() => {
    return () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
      if (uploadSuccessTimeoutRef.current) {
        window.clearTimeout(uploadSuccessTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const syncStatusUi = () => {
      setStatusUi(apiStatusToUi(getEffectivePresenceStatus()));
    };

    syncStatusUi();
    return subscribePresenceManager(syncStatusUi);
  }, []);

  const clearLocalAvatarPreview = useCallback(() => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
    setLocalAvatarPreviewUrl(null);
  }, []);

  const persistLocalStatus = useCallback(
    (apiStatus: UserPresenceStatus, message: string) => {
      setProfile((currentProfile) => {
        if (!currentProfile) {
          return currentProfile;
        }

        const nextProfile = {
          ...currentProfile,
          status: apiStatus,
          statusMessage: message,
        };

        if (settings) {
          writeProfileCache({
            profile: nextProfile,
            settings,
            avatarStyles,
          });
        }

        return nextProfile;
      });
    },
    [avatarStyles, settings],
  );

  const applyProfileSnapshot = useCallback(
    (
      nextProfile: UserProfileState,
      nextSettings: ProfileSettings,
      nextStyles: AvatarStyleItem[],
      options?: { syncParentNotificationSettings?: boolean },
    ) => {
      setProfile(nextProfile);
      setSettings(nextSettings);
      setStatusUi(apiStatusToUi(nextProfile.status));
      setStatusMessage(nextProfile.statusMessage);
      setSavedStatusMessage(nextProfile.statusMessage);
      setManualPresenceStatus(nextProfile.status, nextProfile.statusMessage);
      setTimezone(nextProfile.timezone);
      setAvatarUrl((current) =>
        pickPreferredAvatarUrl(nextProfile.avatarUrl ?? sessionAvatarUrl, current),
      );
      setAvatarTab(nextProfile.avatarMode ?? 'avatar');
      setSelectedStyle(nextProfile.avatarStyle ?? 'notionists');
      setAvatarSeed(nextProfile.avatarSeed ?? nextProfile.username ?? nextProfile.id ?? 'flexhubs');
      setUsernameDraft(nextProfile.username);
      setSavedUsername(nextProfile.username);
      setSnoozeValue(resolveSnoozeSelectValue(nextSettings));
      setDndValue(resolveDndSelectValue(nextSettings));
      if (nextStyles.length > 0) {
        setAvatarStyles(nextStyles);
      }

      const shouldSyncParent = options?.syncParentNotificationSettings !== false;
      if (shouldSyncParent) {
        const parentBaseline =
          sessionNotificationSettingsRef.current ?? settingsRef.current;
        if (
          !parentBaseline ||
          !areProfileSettingsEqual(parentBaseline, nextSettings)
        ) {
          onNotificationSettingsChangeRef.current?.(nextSettings);
        }
      }
    },
    [sessionAvatarUrl],
  );

  const persistSettings = useCallback(
    (next: ProfileSettings) => {
      setSettings(next);
      setProfile((current) => {
        if (current) {
          writeStoredPrivacySettings(current.id, pickPrivacySettings(next));
          writeProfileCache({
            profile: current,
            settings: next,
            avatarStyles,
          });
        }
        return current;
      });
    },
    [avatarStyles],
  );

  const buildSessionSnapshot = useCallback(
    (
      userPayload: unknown,
      settingsSeed?: ProfileSettings | null,
      styles: AvatarStyleItem[] = [],
    ) => {
      const baseSettings = settingsSeed ?? normalizeNotificationSettings({});
      let mergedSettings = mergeProfileSettingsFromUser(userPayload, baseSettings);
      const storedPrivacy = readStoredPrivacySettings(
        normalizeUserProfile(userPayload, mergedSettings).id,
      );
      if (storedPrivacy) {
        mergedSettings = mergeStoredPrivacySettings(mergedSettings, storedPrivacy);
      }
      const nextProfile = normalizeUserProfile(userPayload, mergedSettings);
      return { nextProfile, mergedSettings, nextStyles: styles };
    },
    [],
  );

  const refreshProfile = useCallback(async (options?: { silent?: boolean }) => {
    const cachedBeforeFetch = readProfileCache();
    const hasCachedProfile = Boolean(cachedBeforeFetch?.profile);
    const hasSessionUser = Boolean(user);

    if (!options?.silent && !hasCachedProfile && !hasSessionUser) {
      setLoading(true);
    }

    setError('');

    const statusSeedUserId =
      normalizeUserProfile(user ?? {}).id || readProfileCache()?.profile.id || '';

    const [userResult, settingsResult, stylesResult, statusResult] = await Promise.all([
      getCurrentUser(),
      loadNotificationSettings(),
      loadAvatarStyles(),
      loadResolvedUserStatus(statusSeedUserId),
    ]);

    const userPayload = userResult.ok
      ? (userResult.data.user ?? userResult.data)
      : user;

    if (!userPayload) {
      if (onUnauthorized(userResult.status)) {
        setLoading(false);
        return;
      }
      if (!hasCachedProfile) {
        setError(userResult.error || 'Unable to load profile.');
      }
      setLoading(false);
      return;
    }

    if (
      !userResult.ok &&
      !onUnauthorized(userResult.status) &&
      !options?.silent &&
      userResult.error
    ) {
      setActionError(userResult.error);
    }

    let mergedSettings: ProfileSettings;
    if (settingsResult.ok) {
      mergedSettings = mergeProfileSettingsFromUser(userPayload, settingsResult.data);
    } else if (onUnauthorized(settingsResult.status)) {
      setLoading(false);
      return;
    } else {
      const fallbackSettings =
        sessionNotificationSettingsRef.current ??
        cachedBeforeFetch?.settings ??
        settingsRef.current ??
        normalizeNotificationSettings({});
      mergedSettings = mergeProfileSettingsFromUser(userPayload, fallbackSettings);
      if (!options?.silent && settingsResult.error) {
        setActionError(settingsResult.error);
      }
    }

    let statusPayload = statusResult.ok ? statusResult.data : null;

    if (!statusResult.ok && userPayload) {
      const resolved = await loadResolvedUserStatus(normalizeUserProfile(userPayload).id);

      if (resolved.ok) {
        statusPayload = resolved.data;
      }
    }

    const remoteStatus = mergeRemoteUserStatus(userPayload, statusPayload);
    const normalizedProfile = normalizeUserProfile(userPayload, mergedSettings);
    const nextProfile = {
      ...normalizedProfile,
      status: remoteStatus.status,
      statusMessage: statusPayload
        ? remoteStatus.statusMessage
        : remoteStatus.statusMessage.trim() || getPresenceStatusMessage(),
    };
    setManualPresenceStatus(nextProfile.status, nextProfile.statusMessage);
    const nextStyles = stylesResult.ok
      ? stylesResult.data
      : cachedBeforeFetch?.avatarStyles ?? avatarStylesRef.current;

    if (cachedBeforeFetch?.settings) {
      mergedSettings = mergePrivacySettings(mergedSettings, cachedBeforeFetch.settings);
    }

    const storedPrivacy = readStoredPrivacySettings(nextProfile.id);
    if (storedPrivacy) {
      mergedSettings = mergeStoredPrivacySettings(mergedSettings, storedPrivacy);
    }

    applyProfileSnapshot(nextProfile, mergedSettings, nextStyles);

    writeProfileCache({
      profile: nextProfile,
      settings: mergedSettings,
      avatarStyles: nextStyles,
    });

    setLoading(false);
  }, [applyProfileSnapshot, onUnauthorized, user]);

  applyProfileSnapshotRef.current = applyProfileSnapshot;
  refreshProfileRef.current = refreshProfile;

  useEffect(() => {
    const applySnapshot = applyProfileSnapshotRef.current;
    const runRefreshProfile = refreshProfileRef.current;

    const cached = readProfileCache();

    if (cached) {
      let settingsFromCache = cached.settings;
      const storedPrivacy = readStoredPrivacySettings(cached.profile.id);
      if (storedPrivacy) {
        settingsFromCache = mergeStoredPrivacySettings(settingsFromCache, storedPrivacy);
      }

      applySnapshot(cached.profile, settingsFromCache, cached.avatarStyles);
      setLoading(false);
      void runRefreshProfile({ silent: true });
      return;
    }

    if (user) {
      const { nextProfile, mergedSettings, nextStyles } = buildSessionSnapshot(
        user,
        sessionNotificationSettingsRef.current,
      );
      applySnapshot(nextProfile, mergedSettings, nextStyles);
      setLoading(false);
    }

    void runRefreshProfile({ silent: Boolean(user) });
  }, [buildSessionSnapshot, sessionUserId]);

  useEffect(() => {
    if (activeTab !== 'profile') {
      return;
    }

    void refreshProfileRef.current?.({ silent: true });
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'privacy') {
      return;
    }

    void refreshBlockedUsersFromApi();
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;

    const loadBlocks = async () => {
      setBlockedLoading(true);
      const result = await loadBlockedUsers();
      if (cancelled) return;
      setBlockedLoading(false);

      if (!result.ok) {
        if (!onUnauthorized(result.status)) {
          setActionError(result.error);
        }
        return;
      }

      setBlockedUsers(result.data);
      setBlockedUserIdsFromList(result.data);
    };

    void loadBlocks();

    return () => {
      cancelled = true;
    };
  }, [onUnauthorized]);

  const handleUnblockUser = async (userId: string, username: string) => {
    setUnblockingId(userId);
    setActionError('');
    const result = await unblockUser(userId);
    setUnblockingId(null);

    if (!result.ok) {
      if (!onUnauthorized(result.status)) setActionError(result.error);
      return;
    }

    setBlockedUsers((current) => current.filter((user) => user.id !== userId));
    markUserUnblocked(userId);
    void refreshBlockedUsersFromApi();
    toast.success(`${username} unblocked.`);
  };

  const handleStatusMessageChange = (message: string) => {
    setStatusMessage(message);
  };

  const handleSaveStatusMessage = async () => {
    if (statusMessage === savedStatusMessage) return;
    setSaving(true);
    setActionError('');
    const apiStatus = getEffectivePresenceStatus();
    const result = await saveUserStatus(apiStatus, statusMessage);
    setSaving(false);
    if (!result.ok) {
      if (!onUnauthorized(result.status)) {
        setActionError(result.error);
        toast.error(result.error);
      }
      return;
    }

    persistLocalStatus(apiStatus, statusMessage);
    setManualPresenceStatus(apiStatus, statusMessage);
    setSavedStatusMessage(statusMessage);
    toast.success('Status message saved.');
    onUserUpdated?.();
  };

  const patchSettings = async (
    updates: import('../../shared/profile').NotificationPreferenceUpdate,
    successMessage?: string,
  ): Promise<boolean> => {
    if (!settings) {
      return false;
    }

    const previous = settings;
    const optimistic = applyNotificationPreferenceUpdate(settings, updates);
    setSettings(optimistic);
    onNotificationSettingsChange?.(optimistic);
    setActionError('');

    const result = await saveNotificationSettings(updates);

    if (!result.ok) {
      setSettings(previous);
      onNotificationSettingsChange?.(previous);
      if (!onUnauthorized(result.status)) {
        setActionError(result.error);
        toast.error(result.error);
      }
      return false;
    }

    setSettings(result.data);
    onNotificationSettingsChange?.(result.data);
    if (profile) {
      writeProfileCache({
        profile,
        settings: result.data,
        avatarStyles,
      });
    }
    if (updates.snoozeValue !== undefined) {
      setSnoozeValue(updates.snoozeValue);
    } else {
      setSnoozeValue(resolveSnoozeSelectValue(result.data));
    }

    if (updates.dndValue !== undefined) {
      setDndValue(updates.dndValue);
    } else {
      setDndValue(resolveDndSelectValue(result.data));
    }
    if (successMessage) {
      toast.success(successMessage);
    }
    return true;
  };

  const handleOnlineStatusToggle = async () => {
    if (!settings) return;
    const previous = settings.shareOnlineStatus;
    const next = !previous;
    setSettings({ ...settings, shareOnlineStatus: next });
    setActionError('');
    const [notifResult, profileResult] = await Promise.all([
      saveNotificationSettings({ shareOnlineStatus: next }),
      saveUserProfile({ shareOnlineStatus: next }),
    ]);

    if (!notifResult.ok && !profileResult.ok && !onUnauthorized(notifResult.status || profileResult.status)) {
      setSettings({ ...settings, shareOnlineStatus: previous });
      const errorMessage = notifResult.error || profileResult.error || 'Unable to update online status.';
      setActionError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    if (notifResult.ok && notifResult.data) {
      setSettings(notifResult.data);
      onNotificationSettingsChange?.(notifResult.data);
      if (profile) {
        writeProfileCache({ profile, settings: notifResult.data, avatarStyles });
      }
    }

    setPresenceSharingEnabled(next);
    void syncPresenceToServer();
    toast.success(next ? 'Online status sharing turned on.' : 'Online status sharing turned off.');
    onUserUpdated?.();
  };

  const handleSnoozeChange = async (value: string) => {
    setSnoozeValue(value);
    const label = SNOOZE_OPTIONS.find((option) => option.value === value)?.label ?? 'Snooze updated';
    await patchSettings(
      { snoozeValue: value },
      value === 'off' ? 'Snooze turned off.' : `${label}.`,
    );
  };

  const handleDndChange = async (value: string) => {
    if (!settings) return;
    setDndValue(value);
    const label = DND_OPTIONS.find((option) => option.value === value)?.label ?? 'Do Not Disturb updated';
    await patchSettings(
      { dndValue: value },
      value === 'off' ? 'Do Not Disturb turned off.' : `${label} enabled.`,
    );
  };

  const handleMessageSoundToggle = async () => {
    if (!settings) return;
    const previous = settings.messageSoundEnabled;
    const next = !previous;
    setSettings({ ...settings, messageSoundEnabled: next });
    setActionError('');
    const result = await saveUserProfile({ messageSoundEnabled: next });

    if (!result.ok) {
      setSettings({ ...settings, messageSoundEnabled: previous });
      if (!onUnauthorized(result.status)) {
        setActionError(result.error);
        toast.error(result.error);
      }
      return;
    }

    toast.success(next ? 'Message sounds turned on.' : 'Message sounds turned off.');
    onUserUpdated?.();
  };

  const handlePreviewMessageSound = async () => {
    const played = await playMessageNotificationSound();

    if (played) {
      toast.success('Preview played.');
      return;
    }

    toast.error('Unable to play preview sound on this device.');
  };

  const handleEnablePush = async () => {
    setPushBusy(true);

    try {
      const result = await enableDesktopPushNotifications();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setPushEnabled(true);
      toast.success('Desktop notifications enabled.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);

    try {
      const result = await disableDesktopPushNotifications();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setPushEnabled(false);
      toast.success('Desktop notifications turned off.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleTimezoneChange = async (nextTimezone: string) => {
    const previous = timezone;
    setTimezone(nextTimezone);
    setSaving(true);
    setActionError('');
    const result = await saveUserTimezone(nextTimezone);
    setSaving(false);
    if (!result.ok) {
      setTimezone(previous);
      if (!onUnauthorized(result.status)) {
        setActionError(result.error);
        toast.error(result.error);
      }
      return;
    }
    toast.success(`Time zone updated to ${formatTimezoneLabel(nextTimezone)}.`);
    onUserUpdated?.();
  };

  const handleUseDeviceTime = () => {
    void handleTimezoneChange(getDeviceTimezone());
  };

  const handleAvatarSave = async (
    updates: Record<string, unknown>,
    successMessage = 'Profile updated.',
    options?: { skipSavingFlag?: boolean },
  ): Promise<boolean> => {
    if (!options?.skipSavingFlag) {
      setSaving(true);
    }
    setActionError('');
    const result = await saveUserProfile(updates);
    if (!options?.skipSavingFlag) {
      setSaving(false);
    }
    if (!result.ok) {
      if (!onUnauthorized(result.status)) {
        setActionError(result.error);
        toast.error(result.error);
      }
      return false;
    }

    if (typeof updates.avatarUrl === 'string') {
      setAvatarUrl(updates.avatarUrl);
    } else if (updates.avatarUrl === null) {
      setAvatarUrl(null);
    }

    if (typeof updates.username === 'string') {
      setSavedUsername(updates.username);
      setProfile((current) =>
        current ? { ...current, username: updates.username as string, name: updates.username as string } : current,
      );
    }

    if (typeof updates.avatarStyle === 'string') {
      setSelectedStyle(updates.avatarStyle);
    } else if (updates.avatarStyle === null) {
      setSelectedStyle('notionists');
    }

    if (typeof updates.avatarSeed === 'string') {
      setAvatarSeed(updates.avatarSeed);
    } else if (updates.avatarSeed === null) {
      setAvatarSeed('');
    }

    if (updates.useInitials === true || updates.avatarMode === 'initials') {
      setAvatarTab('initials');
      setAvatarUrl(null);
      setProfile((current) =>
        current ? { ...current, avatarMode: 'initials', avatarUrl: null, avatarStyle: null } : current,
      );
    } else if (updates.avatarMode === 'upload') {
      setAvatarTab('upload');
      setProfile((current) =>
        current
          ? {
            ...current,
            avatarMode: 'upload',
            avatarUrl: typeof updates.avatarUrl === 'string' ? updates.avatarUrl : current.avatarUrl,
            avatarStyle: null,
          }
          : current,
      );
    } else if (updates.avatarMode === 'avatar') {
      setAvatarTab('avatar');
      setProfile((current) =>
        current
          ? {
            ...current,
            avatarMode: 'avatar',
            avatarUrl: typeof updates.avatarUrl === 'string' ? updates.avatarUrl : current.avatarUrl,
            avatarStyle:
              typeof updates.avatarStyle === 'string'
                ? updates.avatarStyle
                : current.avatarStyle,
            avatarSeed:
              typeof updates.avatarSeed === 'string' ? updates.avatarSeed : current.avatarSeed,
          }
          : current,
      );
    }

    onUserUpdated?.();
    toast.success(successMessage);
    if (typeof updates.avatarUrl === 'string' || updates.avatarMode === 'upload') {
      clearProfileCache();
    }
    return true;
  };

  const handleSelectAvatarStyle = async (styleId: string) => {
    setSelectedStyle(styleId);
    const url = buildGeneratedAvatarUrl(styleId, avatarSeed);
    setAvatarUrl(url);
    const styleName = avatarStyles.find((style) => style.id === styleId)?.name ?? styleId;
    await handleAvatarSave(
      {
        avatarStyle: styleId,
        avatarSeed,
        avatarUrl: url,
        avatarMode: 'avatar',
        useInitials: false,
      },
      `${styleName} avatar applied.`,
    );
  };

  const handleRandomizeSeed = async () => {
    const nextSeed = `avatar-${Math.random().toString(36).slice(2, 10)}`;
    setAvatarSeed(nextSeed);
    const url = buildGeneratedAvatarUrl(selectedStyle, nextSeed);
    setAvatarUrl(url);
    await handleAvatarSave(
      {
        avatarStyle: selectedStyle,
        avatarSeed: nextSeed,
        avatarUrl: url,
        avatarMode: 'avatar',
        useInitials: false,
      },
      'Avatar randomized.',
    );
  };

  const handleApplyAvatar = async () => {
    const url = buildGeneratedAvatarUrl(selectedStyle, avatarSeed);
    setAvatarUrl(url);
    await handleAvatarSave(
      {
        avatarStyle: selectedStyle,
        avatarSeed,
        avatarUrl: url,
        avatarMode: 'avatar',
        useInitials: false,
      },
      'Avatar applied.',
    );
  };

  const handleUploadAvatar = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      void (async () => {
        clearLocalAvatarPreview();
        const objectUrl = URL.createObjectURL(file);
        localPreviewRef.current = objectUrl;
        setLocalAvatarPreviewUrl(objectUrl);
        setAvatarTab('upload');
        setAvatarUploading(true);
        setAvatarUploadSucceeded(false);
        setActionError('');

        try {
          const uploadResult = await uploadUserProfileImage(file);
          if (!uploadResult.ok) {
            if (!onUnauthorized(uploadResult.status)) {
              setActionError(uploadResult.error);
              toast.error(uploadResult.error);
            }
            return;
          }

          setAvatarUrl(uploadResult.data.url);
          const saved = await handleAvatarSave(
            {
              avatarUrl: uploadResult.data.url,
              avatarMode: 'upload',
              useInitials: false,
              avatarStyle: null,
              avatarSeed: null,
            },
            'Profile picture updated.',
            { skipSavingFlag: true },
          );

          if (saved) {
            clearLocalAvatarPreview();
            setAvatarUploadSucceeded(true);
            if (uploadSuccessTimeoutRef.current) {
              window.clearTimeout(uploadSuccessTimeoutRef.current);
            }
            uploadSuccessTimeoutRef.current = window.setTimeout(() => {
              setAvatarUploadSucceeded(false);
            }, 2200);
          }
        } catch (uploadError) {
          const message = uploadError instanceof Error ? uploadError.message : 'Failed to upload avatar.';
          setActionError(message);
          toast.error(message);
        } finally {
          setAvatarUploading(false);
        }
      })();
    };
    input.click();
  };

  const handleUseInitials = async () => {
    setAvatarTab('initials');
    setAvatarUrl(null);
    await handleAvatarSave({ avatarMode: 'initials', useInitials: true }, 'Initials avatar applied.');
  };

  const handleSaveUsername = async () => {
    if (!usernameDraft.trim()) {
      setActionError('Username cannot be empty.');
      toast.error('Username cannot be empty.');
      return;
    }

    if (usernameDraft.trim() === savedUsername) {
      toast.success('Username is already up to date.');
      return;
    }

    const ok = await handleAvatarSave({ username: usernameDraft.trim() }, 'Username saved.');
    if (ok) {
      setSavedUsername(usernameDraft.trim());
    }
    return ok;
  };

  if (loading && !profile) {
    return (
      <div className="flex h-full flex-col gap-4 bg-app-chat-bg p-6" aria-busy="true">
        <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-app-chat-hover" />
        <div className="mx-auto h-4 w-40 animate-pulse rounded bg-app-chat-hover" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-xl bg-app-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-app-chat-bg px-8 text-center">
        <p className="mb-4 text-sm text-accent-soft">{error || 'Unable to load profile.'}</p>
        <button type="button" className="rounded-[10px] border border-app-border px-4 py-2 text-sm" onClick={() => void refreshProfile()}>
          Try again
        </button>
      </div>
    );
  }

  if (!profile || !settings) {
    return (
      <div className="flex h-full flex-col gap-4 bg-app-chat-bg p-6" aria-busy="true">
        <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-app-chat-hover" />
        <div className="mx-auto h-4 w-40 animate-pulse rounded bg-app-chat-hover" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-xl bg-app-surface" />
          ))}
        </div>
      </div>
    );
  }

  const displayName = profile.name || profile.username || 'Your account';
  const initials = getUserInitials(profile);
  const effectiveSavedAvatarUrl = avatarUrl ?? profile.avatarUrl ?? sessionAvatarUrl;

  const previewAvatarUrl = (() => {
    if (localAvatarPreviewUrl) {
      return localAvatarPreviewUrl;
    }

    if (avatarTab === 'initials') {
      return null;
    }

    if (avatarTab === 'upload') {
      return effectiveSavedAvatarUrl;
    }

    return buildGeneratedAvatarUrl(selectedStyle, avatarSeed);
  })();
  const usernameChanged = usernameDraft.trim() !== savedUsername;
  const statusMessageChanged = statusMessage !== savedStatusMessage;
  const selectedAvatarStyleName =
    avatarStyles.find((style) => style.id === selectedStyle)?.name ?? selectedStyle;

  return (
    <div className="flex h-full w-full bg-app-chat-bg text-app-text">
      {/* Sidebar Navigation */}
      <div className="w-64 shrink-0 border-r border-app-border overflow-y-auto bg-app-surface/30 px-4 py-8">
        <h1 className="mb-8 px-3 text-xl font-bold text-app-text tracking-tight">Profile & Settings</h1>

        <div className="space-y-6">
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold tracking-wider text-app-muted uppercase">Account</p>
            <NavButton icon={<FiUser />} label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          </div>

          <div>
            <p className="mb-2 px-3 text-[10px] font-bold tracking-wider text-app-muted uppercase">Preferences</p>
            <NavButton icon={<FiSun />} label="Appearance" active={activeTab === 'appearance'} onClick={() => setActiveTab('appearance')} />
            <NavButton icon={<FiBell />} label="Notifications" active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} />
          </div>

          <div>
            <p className="mb-2 px-3 text-[10px] font-bold tracking-wider text-app-muted uppercase">Privacy & Security</p>
            <NavButton icon={<FiShield />} label="Privacy" active={activeTab === 'privacy'} onClick={() => setActiveTab('privacy')} />
          </div>

          <div>
            <p className="mb-2 px-3 text-[10px] font-bold tracking-wider text-app-muted uppercase">Application</p>
            <div className="relative">
              <NavButton icon={<FiDownloadCloud />} label="Updates" active={activeTab === 'updates'} onClick={() => { setActiveTab('updates'); onUpdateViewed?.(); }} />
              {hasUpdateBadge && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent animate-pulse" />
              )}
            </div>
          </div>

          <div className="pt-4 mt-6 border-t border-app-border">
            <NavButton danger icon={<FiLogOut />} label="Sign out" onClick={() => void onLogout()} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-8 md:px-12 lg:px-20">
        <div className="w-full max-w-4xl">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              {activeTab === 'profile' ? (
                <>
                  <h2 className="text-2xl font-bold tracking-tight text-app-text">Profile</h2>
                  <p className="mt-1 text-sm text-app-muted">
                    Photo, status, and how teammates see you
                  </p>
                </>
              ) : activeTab !== 'privacy' ? (
                <h2 className="text-2xl font-bold tracking-tight text-app-text capitalize">{activeTab}</h2>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              {saving ? <span className="shrink-0 text-xs font-medium text-accent-soft animate-pulse">Saving...</span> : null}
            </div>
          </div>

          {actionError ? (
            <p className="mb-4 text-xs font-medium text-accent-soft" role="alert">{actionError}</p>
          ) : null}

          <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'profile' && (
              <>
                {/* Profile summary */}
                <SectionCard className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:gap-8">
                  <div className="flex shrink-0 flex-col items-center gap-3 sm:items-start">
                    <div className="relative h-[4.5rem] w-[4.5rem]">
                      <AvatarPreviewCircle
                        imageUrl={previewAvatarUrl}
                        initials={initials}
                        uploading={avatarUploading}
                        uploadSucceeded={avatarUploadSucceeded}
                      />
                      <span
                        className={`absolute bottom-0 right-0 z-50 h-3.5 w-3.5 rounded-full border-2 border-app-surface ${statusDotClass(statusUi)}`}
                        aria-hidden="true"
                      />
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-chat-hover px-3 py-1 text-[11px] font-semibold text-app-text"
                    >
                      <span className={`h-2 w-2 rounded-full ${statusDotClass(statusUi)}`} />
                      {statusUi}
                    </span>
                    <p className="flex items-center gap-1.5 text-xs text-app-muted">
                      <FiClock className="shrink-0" aria-hidden="true" />
                      {formatLocalTime(timezone)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      {usernameEditing ? (
                        <input
                          type="text"
                          value={usernameDraft}
                          autoFocus
                          onChange={(event) => setUsernameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void handleSaveUsername().then((ok) => {
                                if (ok !== false) setUsernameEditing(false);
                              });
                            }
                            if (event.key === 'Escape') {
                              setUsernameDraft(savedUsername);
                              setUsernameEditing(false);
                            }
                          }}
                          className="max-w-full rounded-lg border border-app-border bg-app-chat-bg px-2.5 py-1 text-lg font-bold text-app-text focus:border-accent focus:outline-none"
                        />
                      ) : (
                        <h3 className="text-xl font-bold tracking-tight text-app-text">{displayName}</h3>
                      )}
                      <button
                        type="button"
                        aria-label="Edit username"
                        className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
                        onClick={() => {
                          if (usernameEditing) {
                            setUsernameDraft(savedUsername);
                            setUsernameEditing(false);
                            return;
                          }
                          setUsernameEditing(true);
                        }}
                      >
                        <FiEdit2 className="h-4 w-4" aria-hidden />
                      </button>
                      {usernameEditing ? (
                        <button
                          type="button"
                          disabled={!usernameChanged || saving || !usernameDraft.trim()}
                          onClick={() =>
                            void handleSaveUsername().then(() => setUsernameEditing(false))
                          }
                          className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                      ) : null}
                    </div>
                    {profile.email ? (
                      <p className="mt-1.5 flex items-center justify-center gap-2 text-sm text-app-muted sm:justify-start">
                        <FiMail className="shrink-0 opacity-80" size={14} aria-hidden="true" />
                        <span className="truncate">{profile.email}</span>
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      {profile.inOrganization ? (
                        <span className="rounded-full bg-app-chat-hover px-2.5 py-0.5 text-[11px] font-medium text-app-text">
                          In organization
                        </span>
                      ) : null}
                      {profile.organizationRole ? (
                        <span className="rounded-full bg-accent-soft/15 px-2.5 py-0.5 text-[11px] font-medium text-accent-soft">
                          {profile.organizationRole}
                        </span>
                      ) : null}
                    </div>
                    {savedStatusMessage.trim() ? (
                      <p className="mt-3 text-sm text-app-muted">{savedStatusMessage.trim()}</p>
                    ) : null}
                  </div>
                </SectionCard>

                {/* Profile Photo */}
                <section>
                  <h4 className="mb-3 text-base font-semibold text-app-text">Profile photo</h4>
                  <SectionCard className="p-5">
                    <div className="mb-5 flex gap-1 rounded-xl border border-app-border bg-app-inset/60 p-1">
                      {(['avatar', 'upload', 'initials'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setAvatarTab(tab)}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${avatarTab === tab
                              ? 'bg-app-elevated text-app-text shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                              : 'text-app-muted hover:text-app-text'
                            }`}
                        >
                          {tab === 'avatar' ? (
                            <FiStar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : tab === 'upload' ? (
                            <FiUpload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <FiUser className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          )}
                          {tab === 'avatar' ? 'Avatar' : tab === 'upload' ? 'Upload' : 'Initials'}
                        </button>
                      ))}
                    </div>

                    {avatarTab === 'avatar' ? (
                      <>
                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-app-muted uppercase">
                          Choose a style
                        </p>
                        <div className="max-h-[17.5rem] overflow-y-auto rounded-xl border border-app-border bg-app-inset/40 p-3">
                          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                            {avatarStyles.map((style) => (
                              <button
                                key={style.id}
                                type="button"
                                onClick={() => void handleSelectAvatarStyle(style.id)}
                                className={`overflow-hidden rounded-xl border-2 transition-colors ${selectedStyle === style.id
                                    ? 'border-accent ring-2 ring-accent/25'
                                    : 'border-transparent hover:border-app-border'
                                  }`}
                              >
                                <img
                                  src={style.previewUrl}
                                  alt={style.name}
                                  className="aspect-square w-full bg-app-surface object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-app-muted">
                          Selected:{' '}
                          <span className="font-semibold text-app-text">{selectedAvatarStyleName}</span>
                        </p>
                      </>
                    ) : null}

                    {avatarTab === 'upload' ? (
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <AvatarPreviewCircle
                          imageUrl={previewAvatarUrl}
                          initials={initials}
                          uploading={avatarUploading}
                          uploadSucceeded={avatarUploadSucceeded}
                          sizeClass="h-16 w-16"
                        />
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            disabled={avatarUploading}
                            onClick={handleUploadAvatar}
                            className="rounded-lg border border-app-border px-4 py-2 text-sm font-medium hover:bg-app-chat-hover disabled:cursor-wait disabled:opacity-60"
                          >
                            {avatarUploading
                              ? 'Uploading…'
                              : previewAvatarUrl
                                ? 'Replace photo'
                                : 'Choose photo'}
                          </button>
                          {avatarUploadSucceeded ? (
                            <p className="text-xs font-medium text-green-500">Photo updated successfully.</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {avatarTab === 'initials' ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => void handleUseInitials()}
                          className="rounded-lg border border-app-border px-4 py-2 text-sm font-medium hover:bg-app-chat-hover"
                        >
                          Use initials
                        </button>
                      </div>
                    ) : null}
                  </SectionCard>
                </section>

                <section>
                  <h4 className="mb-3 text-sm font-semibold text-app-text">Status message</h4>
                  <SectionCard className="p-5">
                    <label
                      className="mb-1.5 block text-sm font-semibold text-app-text"
                      htmlFor="profile-status-message"
                    >
                      Message
                    </label>
                    <div className="relative">
                      <input
                        id="profile-status-message"
                        type="text"
                        placeholder="What's on your mind?"
                        value={statusMessage}
                        onChange={(event) => handleStatusMessageChange(event.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && statusMessageChanged) {
                            void handleSaveStatusMessage();
                          }
                        }}
                        className="w-full rounded-xl border border-app-border bg-app-chat-bg px-3 py-2.5 pr-10 text-sm text-app-text focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={!statusMessageChanged || saving}
                        onClick={() => void handleSaveStatusMessage()}
                        className={`absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-app-chat-bg ${statusMessageChanged
                            ? 'text-accent hover:bg-accent/10'
                            : 'cursor-default text-app-muted/70'
                          }`}
                        aria-label="Save status message"
                      >
                        <FiCheck className="text-base" aria-hidden="true" />
                      </button>
                    </div>
                  </SectionCard>
                </section>

                {/* Local time & time zone */}
                <section>
                  <h4 className="mb-3 text-sm font-semibold text-app-text">Local time & time zone</h4>
                  <SectionCard className="p-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-app-text">Local time</label>
                        <div className="flex h-[38px] items-center gap-2 rounded-lg border border-app-border bg-app-chat-bg/50 px-3 text-sm text-app-text">
                          <FiClock className="text-app-muted" />
                          {formatLocalTime(timezone)}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 flex items-center justify-between text-xs font-semibold text-app-text">
                          Time zone
                          <button type="button" onClick={handleUseDeviceTime} className="text-[10px] text-accent-soft hover:underline">Use device time</button>
                        </label>
                        <div className="relative">
                          <select
                            value={timezone}
                            onChange={(event) => void handleTimezoneChange(event.target.value)}
                            className="w-full appearance-none rounded-lg border border-app-border bg-app-chat-bg px-3 py-2 text-sm text-app-text focus:border-accent focus:outline-none"
                          >
                            {!timezoneOptions.some((option) => option.value === timezone) ? (
                              <option value={timezone}>{formatTimezoneLabel(timezone)}</option>
                            ) : null}
                            {timezoneOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-app-muted" />
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </section>
              </>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-8">
                <section>
                  <h4 className="mb-3 text-sm font-semibold text-app-text">Theme</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${theme === 'light' ? 'border-accent bg-accent/5' : 'border-app-border bg-app-surface hover:border-app-muted'
                        }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-800">
                        <FiSun className="text-lg" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-app-text">Light mode</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${theme === 'dark' ? 'border-accent bg-accent/5' : 'border-app-border bg-app-surface hover:border-app-muted'
                        }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#111111] border border-gray-700 text-gray-200">
                        <FiMoon className="text-lg" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-app-text">Dark mode</p>
                      </div>
                    </button>
                  </div>
                </section>


              </div>
            )}

            {activeTab === 'notifications' && (
              <>
                <section>
                  <h4 className="mb-1 text-sm font-semibold text-app-text">App snooze</h4>
                  <p className="mb-3 text-xs leading-relaxed text-app-muted">
                    Pause all notifications app-wide. Snooze individual hubs and groups from their chat header.
                  </p>
                  {isAppSnoozeActive(settings) ? (
                    <div className="mb-4 rounded-xl border border-rose-200/90 bg-rose-50/95 p-3 shadow-sm shadow-rose-900/[0.04] dark:border-rose-900/55 dark:bg-rose-950/40 dark:shadow-black/20">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-200/80 text-rose-900 dark:bg-rose-900/70 dark:text-rose-100">
                          <FiBellOff className="text-lg" strokeWidth={1.75} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-rose-950 dark:text-rose-50">
                            Snooze all notifications
                          </p>
                          <p className="text-xs font-medium text-rose-800/80 dark:text-rose-200/75">
                            {settings.snoozedForever
                              ? 'Snoozed until you turn it off'
                              : formatNotificationQuietUntil(settings.snoozeUntil)
                                ? `Snoozed until ${formatNotificationQuietUntil(settings.snoozeUntil)}`
                                : 'Snoozed'}
                          </p>
                        </div>
                        <div className="relative shrink-0">
                          <select
                            value={snoozeValue}
                            onChange={(e) => void handleSnoozeChange(e.target.value)}
                            aria-label="App snooze duration"
                            className="appearance-none rounded-lg border border-rose-300/80 bg-white/90 px-3 py-1.5 pr-8 text-sm font-medium text-rose-950 focus:outline-none focus:border-accent dark:border-rose-800/80 dark:bg-rose-950/60 dark:text-rose-50"
                          >
                            {SNOOZE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-rose-800/70 dark:text-rose-200/70" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <SectionCard className="mb-4">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <FiBellOff className="text-app-muted text-lg" aria-hidden="true" />
                          <div>
                            <p className="text-sm font-semibold text-app-text">Snooze all notifications</p>
                            <p className="text-xs text-app-muted">Notifications on</p>
                          </div>
                        </div>
                        <div className="relative">
                          <select
                            value={snoozeValue}
                            onChange={(e) => void handleSnoozeChange(e.target.value)}
                            aria-label="App snooze duration"
                            className="appearance-none rounded-lg border border-app-border bg-app-chat-bg px-3 py-1.5 pr-8 text-sm text-app-text focus:outline-none focus:border-accent"
                          >
                            {SNOOZE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted" />
                        </div>
                      </div>
                    </SectionCard>
                  )}

                  <h4 className="mb-3 text-sm font-semibold text-app-text">Do Not Disturb</h4>
                  <SectionCard className="divide-y divide-app-border">
                    <div className="flex items-center justify-between p-4 hover:bg-app-chat-hover/30 transition-colors rounded-xl">
                      <div className="flex items-center gap-3">
                        <FiMoon className="text-app-muted text-lg" />
                        <div>
                          <p className="text-sm font-semibold text-app-text">Do Not Disturb</p>
                          <p className="text-xs text-app-muted">{dndLabel(settings)}</p>
                        </div>
                      </div>
                      <div className="relative">
                        <select
                          value={dndValue}
                          onChange={(e) => void handleDndChange(e.target.value)}
                          className="appearance-none rounded-lg border border-app-border bg-app-chat-bg px-3 py-1.5 pr-8 text-sm text-app-text focus:outline-none focus:border-accent"
                        >
                          {DND_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted" />
                      </div>
                    </div>
                  </SectionCard>
                </section>

                <section>
                  <h4 className="mb-3 text-sm font-semibold text-app-text">Sounds & Desktop</h4>
                  <SectionCard className="divide-y divide-app-border">
                    <div className="flex items-center justify-between p-4 hover:bg-app-chat-hover/30 transition-colors rounded-t-xl">
                      <div className="flex items-center gap-3">
                        <FiVolume2 className="text-app-muted text-lg" />
                        <div>
                          <p className="text-sm font-semibold text-app-text">Message sounds</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handlePreviewMessageSound()}
                          title="Preview sound"
                          aria-label="Preview message sound"
                          className="inline-flex items-center justify-center rounded border border-app-border p-1.5 text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
                        >
                          <FiVolume2 className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMessageSoundToggle()}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${settings.messageSoundEnabled ? 'bg-accent' : 'bg-app-border'}`}
                        >
                          <span className="sr-only">Toggle message sounds</span>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 ease-in-out ${settings.messageSoundEnabled ? 'translate-x-2' : '-translate-x-2'}`} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-4 hover:bg-app-chat-hover/30 transition-colors">
                      <div className="flex min-w-0 items-center gap-3">
                        <FiHeadphones className="text-app-muted shrink-0 text-lg" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-app-text">Speaker output</p>
                          <p className="text-xs text-app-muted mt-0.5">
                            Messages, voice notes, and calls
                          </p>
                        </div>
                      </div>
                      <div className="relative shrink-0">
                        <select
                          value={selectedAudioOutputId}
                          onChange={(event) => handleAudioOutputChange(event.target.value)}
                          className="max-w-[220px] appearance-none rounded-lg border border-app-border bg-app-surface py-2 pl-3 pr-8 text-sm text-app-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                          aria-label="Select speaker output"
                        >
                          <option value="default">System default</option>
                          {audioOutputDevices.map((device, index) => (
                            <option key={device.deviceId || `output-${index}`} value={device.deviceId}>
                              {labelForAudioOutputDevice(device, index)}
                            </option>
                          ))}
                        </select>
                        <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted" />
                      </div>
                    </div>
                    <div className="flex items-start justify-between p-4 hover:bg-app-chat-hover/30 transition-colors rounded-b-xl">
                      <div className="flex gap-3">
                        <FiSmartphone className="text-app-muted text-lg mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-app-text">Desktop notifications</p>
                          <p className="text-xs text-app-muted mt-0.5">Alerts when away from FlexHubs</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pushEnabled ? (
                          <button
                            type="button"
                            disabled={pushBusy}
                            onClick={() => void handleDisablePush()}
                            className="rounded border border-app-border px-2 py-1 text-[11px] font-semibold hover:bg-app-chat-hover disabled:opacity-50"
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pushBusy}
                            onClick={() => void handleEnablePush()}
                            className="rounded border border-app-border px-2 py-1 text-[11px] font-semibold hover:bg-app-chat-hover disabled:opacity-50"
                          >
                            Enable
                          </button>
                        )}
                      </div>
                    </div>
                  </SectionCard>
                </section>
              </>
            )}

            {activeTab === 'privacy' && (
              <PrivacySettings
                settings={settings}
                persistSettings={persistSettings}
                blockedUsers={blockedUsers}
                blockedLoading={blockedLoading}
                unblockingId={unblockingId}
                handleUnblockUser={handleUnblockUser}
                onUserUpdated={onUserUpdated}
                onUnauthorized={onUnauthorized}
              />
            )}
            {activeTab === 'updates' && (
              <UpdatesSettings />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
