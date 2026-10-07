import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FiBell,
  FiBellOff,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiEye,
  FiLogOut,
  FiMail,
  FiMoon,
  FiStar,
  FiSun,
  FiUpload,
  FiUser,
  FiVolume2,
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
  normalizeUserProfile,
  resolveDndSelectValue,
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
  setManualPresenceStatus,
  setPresenceStatusMessage,
} from '../presenceManager';
import {
  loadAvatarStyles,
  loadBlockedUsers,
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
import { UpdatesSettings } from './UpdatesSettings';
import { PrivacySettings } from './PrivacySettings';
import {
  markUserUnblocked,
  refreshBlockedUsersFromApi,
  setBlockedUserIdsFromList,
} from '../blockedUsersSync';
import { clearProfileCache, readProfileCache, writeProfileCache } from '../profileCache';

type ProfileSettingsViewProps = {
  user: unknown;
  onLogout: () => void;
  onUnauthorized: (status?: number) => boolean;
  onUserUpdated?: () => void;
  hasUpdateBadge?: boolean;
  onUpdateViewed?: () => void;
};

type AvatarTab = 'avatar' | 'upload' | 'initials';

const STATUS_OPTIONS = [
  { label: 'Available', dot: 'bg-green-500', activeBorder: 'border-green-500/50 bg-green-500/10' },
  { label: 'Away', dot: 'bg-yellow-500', activeBorder: 'border-yellow-500/50 bg-yellow-500/10' },
  { label: 'Busy', dot: 'bg-orange-500', activeBorder: 'border-orange-500/50 bg-orange-500/10' },
  {
    label: 'Do not disturb',
    dot: 'bg-red-500',
    activeBorder: 'border-red-500/50 bg-red-500/10',
  },
] as const;

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

function statusDotClass(statusUi: string): string {
  return STATUS_OPTIONS.find((option) => option.label === statusUi)?.dot ?? 'bg-green-500';
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
  onLogout,
  onUnauthorized,
  onUserUpdated,
  hasUpdateBadge,
  onUpdateViewed,
}: ProfileSettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'privacy' | 'updates'>('profile');
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
  const [avatarTab, setAvatarTab] = useState<AvatarTab>('avatar');
  const [selectedStyle, setSelectedStyle] = useState('notionists');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [savedUsername, setSavedUsername] = useState('');
  const [snoozeValue, setSnoozeValue] = useState('off');
  const [dndValue, setDndValue] = useState('off');
  const [pushEnabled, setPushEnabled] = useState(() => shouldDeliverDesktopNotifications());
  const [pushBusy, setPushBusy] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<import('../../shared/features').BlockedUserItem[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const [hwAccelerationDisabled, setHwAccelerationDisabled] = useState<boolean>(false);

  useEffect(() => {
    void window.electronAPI?.getHardwareAccelerationDisabled?.().then(disabled => {
      setHwAccelerationDisabled(disabled);
    });
  }, []);

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
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

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
    ) => {
      setProfile(nextProfile);
      setSettings(nextSettings);
      setStatusUi(apiStatusToUi(nextProfile.status));
      setStatusMessage(nextProfile.statusMessage);
      setSavedStatusMessage(nextProfile.statusMessage);
      setManualPresenceStatus(nextProfile.status, nextProfile.statusMessage);
      setTimezone(nextProfile.timezone);
      setAvatarUrl(nextProfile.avatarUrl);
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
    },
    [],
  );

  const persistSettings = useCallback(
    (next: ProfileSettings) => {
      setSettings(next);
      setProfile((current) => {
        if (current) {
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

  const refreshProfile = useCallback(async (options?: { silent?: boolean }) => {
    const cached = readProfileCache();
    const hasCachedProfile = Boolean(cached?.profile);

    if (!options?.silent && !hasCachedProfile) {
      setLoading(true);
    }

    setError('');

    const [userResult, settingsResult, stylesResult] = await Promise.all([
      getCurrentUser(),
      loadNotificationSettings(),
      loadAvatarStyles(),
    ]);

    if (!userResult.ok) {
      if (onUnauthorized(userResult.status)) {
        if (!options?.silent && !hasCachedProfile) setLoading(false);
        return;
      }
      if (!hasCachedProfile) {
        setError(userResult.error);
      }
      if (!options?.silent && !hasCachedProfile) setLoading(false);
      return;
    }

    if (!settingsResult.ok) {
      if (onUnauthorized(settingsResult.status)) {
        if (!options?.silent && !hasCachedProfile) setLoading(false);
        return;
      }
      if (!hasCachedProfile) {
        setError(settingsResult.error);
      }
      if (!options?.silent && !hasCachedProfile) setLoading(false);
      return;
    }

    const userPayload = userResult.data.user ?? userResult.data;
    const mergedSettings = mergeProfileSettingsFromUser(userPayload, settingsResult.data);
    const nextProfile = normalizeUserProfile(userPayload, mergedSettings);
    const nextStyles = stylesResult.ok ? stylesResult.data : cached?.avatarStyles ?? [];

    applyProfileSnapshot(nextProfile, mergedSettings, nextStyles);
    setAvatarUrl(nextProfile.avatarUrl ?? getUserAvatarUrl(userPayload));

    writeProfileCache({
      profile: nextProfile,
      settings: mergedSettings,
      avatarStyles: nextStyles,
    });

    if (!options?.silent && !hasCachedProfile) {
      setLoading(false);
    }
  }, [applyProfileSnapshot, onUnauthorized]);

  useEffect(() => {
    const cached = readProfileCache();

    if (cached) {
      applyProfileSnapshot(cached.profile, cached.settings, cached.avatarStyles);
      setAvatarUrl(cached.profile.avatarUrl);
      setLoading(false);
    }

    void refreshProfile({ silent: Boolean(cached) });
  }, [applyProfileSnapshot, refreshProfile]);

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

  const handleStatusChange = async (nextStatus: string) => {
    const previousStatus = statusUi;
    setStatusUi(nextStatus);
    setManualPresenceStatus(uiStatusToApi(nextStatus), statusMessage);
    setActionError('');
    const result = await saveUserStatus(uiStatusToApi(nextStatus));

    if (!result.ok) {
      setStatusUi(previousStatus);
      setManualPresenceStatus(uiStatusToApi(previousStatus), statusMessage);
      if (!onUnauthorized(result.status)) {
        setActionError(result.error);
        toast.error(result.error);
      }
      return;
    }

    const apiStatus = uiStatusToApi(nextStatus);
    persistLocalStatus(apiStatus, statusMessage);
    toast.success(`Status set to ${nextStatus}.`);
    onUserUpdated?.();
  };

  const handleStatusMessageChange = (message: string) => {
    setStatusMessage(message);
  };

  const handleSaveStatusMessage = async () => {
    if (statusMessage === savedStatusMessage) return;
    setSaving(true);
    setActionError('');
    const result = await saveUserProfile({ statusMessage, bio: statusMessage });
    setSaving(false);
    if (!result.ok) {
      if (!onUnauthorized(result.status)) {
        setActionError(result.error);
        toast.error(result.error);
      }
      return;
    }

    persistLocalStatus(uiStatusToApi(statusUi), statusMessage);
    setPresenceStatusMessage(statusMessage);
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
    setActionError('');

    const result = await saveNotificationSettings(updates);

    if (!result.ok) {
      setSettings(previous);
      if (!onUnauthorized(result.status)) {
        setActionError(result.error);
        toast.error(result.error);
      }
      return false;
    }

    setSettings(result.data);
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
    const profileResult = await saveUserProfile({ shareOnlineStatus: next });

    if (!profileResult.ok && !onUnauthorized(profileResult.status)) {
      setSettings({ ...settings, shareOnlineStatus: previous });
      setActionError(profileResult.error);
      toast.error(profileResult.error);
      return;
    }

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
  ): Promise<boolean> => {
    setSaving(true);
    setActionError('');
    const result = await saveUserProfile(updates);
    setSaving(false);
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
        setSaving(true);
        setActionError('');
        try {
          const uploadResult = await uploadUserProfileImage(file);
          if (!uploadResult.ok) {
            if (!onUnauthorized(uploadResult.status)) {
              setActionError(uploadResult.error);
              toast.error(uploadResult.error);
            }
            setSaving(false);
            return;
          }
          setAvatarTab('upload');
          setAvatarUrl(uploadResult.data.url);
          await handleAvatarSave(
            {
              avatarUrl: uploadResult.data.url,
              avatarMode: 'upload',
              useInitials: false,
              avatarStyle: null,
              avatarSeed: null,
            },
            'Profile picture updated.',
          );
        } catch (uploadError) {
          const message = uploadError instanceof Error ? uploadError.message : 'Failed to upload avatar.';
          setActionError(message);
          toast.error(message);
          setSaving(false);
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
    if (ok) setSavedUsername(usernameDraft.trim());
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

  if (error || !profile || !settings) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-app-chat-bg px-8 text-center">
        <p className="mb-4 text-sm text-accent-soft">{error || 'Unable to load profile.'}</p>
        <button type="button" className="rounded-[10px] border border-app-border px-4 py-2 text-sm" onClick={() => void refreshProfile()}>
          Try again
        </button>
      </div>
    );
  }

  const displayName = profile.name || profile.username || 'Your account';
  const initials = getUserInitials(profile);
  const previewAvatarUrl = (() => {
    const savedMode = profile.avatarMode;

    if (savedMode === 'initials') {
      return null;
    }

    if (savedMode === 'upload') {
      return avatarUrl ?? profile.avatarUrl;
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
                    <div className="relative">
                      <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-full bg-app-chat-hover ring-1 ring-app-border/60">
                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-app-text">
                          {initials}
                        </span>
                        {previewAvatarUrl ? (
                          <RemoteImage
                            src={previewAvatarUrl}
                            alt=""
                            loading="eager"
                            className="relative z-10 h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div
                        className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-app-surface ${statusDotClass(statusUi)}`}
                      />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${STATUS_OPTIONS.find((option) => option.label === statusUi)?.activeBorder ??
                        'border-app-border bg-app-chat-hover'
                        }`}
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
                    <h3 className="text-xl font-bold tracking-tight text-app-text">{displayName}</h3>
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

                {/* Basic Information */}
                <section>
                  <h4 className="mb-3 text-sm font-semibold text-app-text">Basic information</h4>
                  <SectionCard className="p-5">
                    <label className="mb-1 block text-xs font-semibold text-app-text">Username</label>
                    <input
                      type="text"
                      value={usernameDraft}
                      onChange={(event) => setUsernameDraft(event.target.value)}
                      className="w-full rounded-lg border border-app-border bg-app-chat-bg px-3 py-2 text-sm text-app-text focus:border-accent focus:outline-none"
                    />

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        disabled={!usernameChanged || saving || !usernameDraft.trim()}
                        onClick={() => void handleSaveUsername()}
                        className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save changes
                      </button>
                    </div>
                  </SectionCard>
                </section>

                {/* Profile Photo */}
                <section>
                  <h4 className="text-base font-semibold text-app-text">Profile photo</h4>
                  <p className="mt-1 mb-4 text-sm text-app-muted">
                    Pick a generated avatar, upload a photo, or use your initials.
                  </p>
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
                      <div className="flex items-center gap-4">
                        {avatarUrl ? (
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-blue-400">
                            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-app-text">
                              {initials}
                            </span>
                            <RemoteImage src={avatarUrl} alt="" className="relative z-10 h-full w-full object-cover" />
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleUploadAvatar}
                          className="rounded-lg border border-app-border px-4 py-2 text-sm font-medium hover:bg-app-chat-hover"
                        >
                          {avatarUrl ? 'Replace photo' : 'Choose photo'}
                        </button>
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

                {/* Status & Presence */}
                <section>
                  <SectionCard className="p-5">
                    <h4 className="text-sm font-semibold text-app-text">Status &amp; presence</h4>
                    <p className="mt-1 mb-4 text-xs leading-relaxed text-app-muted">
                      Set Available, Away, Busy, or Do not disturb. Your status message appears under
                      your name in the chat list.
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {STATUS_OPTIONS.map((option) => {
                        const isActive = statusUi === option.label;

                        return (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => {
                              if (!isActive) {
                                void handleStatusChange(option.label);
                              }
                            }}
                            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${isActive
                                ? option.activeBorder
                                : 'border-app-border bg-app-chat-bg/40 text-app-text hover:border-app-border-strong hover:bg-app-chat-hover/50'
                              }`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${option.dot}`} />
                              <span className="truncate">{option.label}</span>
                            </span>
                            {isActive ? (
                              <span className="ml-2 shrink-0 text-[10px] font-bold uppercase tracking-wide text-accent">
                                Active
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    <label className="mb-1.5 mt-5 block text-sm font-semibold text-app-text">
                      Status message
                    </label>
                    <div className="relative">
                      <input
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
                      onClick={() => { setTheme('light'); toast.success('Light theme applied.'); }}
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
                      onClick={() => { setTheme('dark'); toast.success('Dark theme applied.'); }}
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
                  <h4 className="mb-3 text-sm font-semibold text-app-text">Snooze & Do Not Disturb</h4>
                  <SectionCard className="divide-y divide-app-border">
                    <div className="flex items-center justify-between p-4 hover:bg-app-chat-hover/30 transition-colors rounded-t-xl">
                      <div className="flex items-center gap-3">
                        <FiBellOff className="text-app-muted text-lg" />
                        <div>
                          <p className="text-sm font-semibold text-app-text">App snooze</p>
                          <p className="text-xs text-app-muted">
                            {settings.snoozeUntil && new Date(settings.snoozeUntil).getTime() > Date.now()
                              ? `Snoozed until ${new Date(settings.snoozeUntil).toLocaleString()}`
                              : 'Notifications on'}
                          </p>
                        </div>
                      </div>
                      <div className="relative">
                        <select
                          value={snoozeValue}
                          onChange={(e) => void handleSnoozeChange(e.target.value)}
                          className="appearance-none rounded-lg border border-app-border bg-app-chat-bg px-3 py-1.5 pr-8 text-sm text-app-text focus:outline-none focus:border-accent"
                        >
                          {SNOOZE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 hover:bg-app-chat-hover/30 transition-colors rounded-b-xl">
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
                        <button type="button" onClick={() => void handlePreviewMessageSound()} className="text-[11px] font-semibold text-app-text border border-app-border rounded px-2 py-1 hover:bg-app-chat-hover">Preview</button>
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
