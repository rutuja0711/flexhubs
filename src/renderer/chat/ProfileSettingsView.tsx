import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FiBell,
  FiBellOff,
  FiChevronDown,
  FiClock,
  FiEye,
  FiLogOut,
  FiMail,
  FiMoon,
  FiRefreshCw,
  FiStar,
  FiSun,
  FiUpload,
  FiUser,
  FiVolume2,
} from 'react-icons/fi';
import { RemoteImage } from '../RemoteImage';
import {
  apiStatusToUi,
  applyNotificationPreferenceUpdate,
  buildGeneratedAvatarUrl,
  normalizeUserProfile,
  uiStatusToApi,
  type AvatarStyleItem,
  type ProfileSettings,
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
// import { ColorThemePicker } from '../theme/ColorThemePicker';
import { useTheme } from '../theme/ThemeProvider';
import { useToast } from '../ui/Toast';
import {
  disableDesktopPushNotifications,
  enableDesktopPushNotifications,
  shouldDeliverDesktopNotifications,
} from '../pushNotifications';
import { playMessageNotificationSound } from '../messageSound';
import { clearProfileCache, readProfileCache, writeProfileCache } from '../profileCache';

type ProfileSettingsViewProps = {
  user: unknown;
  onLogout: () => void;
  onUnauthorized: (status?: number) => boolean;
  onUserUpdated?: () => void;
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

function snoozeValueFromUntil(until: string | null): string {
  if (!until) return 'off';
  const target = new Date(until).getTime();
  if (Number.isNaN(target) || target <= Date.now()) return 'off';
  return 'custom';
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
    <div className={`rounded-2xl border border-app-border/70 bg-app-card/60 shadow-xs backdrop-blur-sm ${className}`}>{children}</div>
  );
}

function SectionGroup({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="mb-8 border-b border-app-border pb-3 text-sm font-bold tracking-wide text-app-muted uppercase">
        {title}
      </h2>
      <div className="space-y-12">{children}</div>
    </div>
  );
}

export function ProfileSettingsView({
  user,
  onLogout,
  onUnauthorized,
  onUserUpdated,
}: ProfileSettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfileState | null>(null);
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [avatarStyles, setAvatarStyles] = useState<AvatarStyleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusUi, setStatusUi] = useState('Available');
  const [statusMessage, setStatusMessage] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarTab, setAvatarTab] = useState<AvatarTab>('avatar');
  const [selectedStyle, setSelectedStyle] = useState('notionists');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [savedUsername, setSavedUsername] = useState('');
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeValue, setSnoozeValue] = useState('off');
  const [dndOpen, setDndOpen] = useState(false);
  const [dndValue, setDndValue] = useState('off');
  const [pushEnabled, setPushEnabled] = useState(() => shouldDeliverDesktopNotifications());
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<import('../../shared/features').BlockedUserItem[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

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
      setManualPresenceStatus(nextProfile.status, nextProfile.statusMessage);
      setTimezone(nextProfile.timezone);
      setAvatarUrl(nextProfile.avatarUrl);
      setAvatarTab(nextProfile.avatarMode ?? 'avatar');
      setSelectedStyle(nextProfile.avatarStyle ?? 'notionists');
      setAvatarSeed(nextProfile.avatarSeed ?? nextProfile.username ?? nextProfile.id ?? 'flexhubs');
      setUsernameDraft(nextProfile.username);
      setSavedUsername(nextProfile.username);
      setSnoozeValue(snoozeValueFromUntil(nextSettings.snoozeUntil));
      if (!nextSettings.dndEnabled) {
        setDndValue('off');
      }
      if (nextStyles.length > 0) {
        setAvatarStyles(nextStyles);
      }
    },
    [],
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
    const nextProfile = normalizeUserProfile(userPayload, settingsResult.data);
    const nextStyles = stylesResult.ok ? stylesResult.data : cached?.avatarStyles ?? [];

    applyProfileSnapshot(nextProfile, settingsResult.data, nextStyles);
    setAvatarUrl(nextProfile.avatarUrl ?? getUserAvatarUrl(userPayload));

    writeProfileCache({
      profile: nextProfile,
      settings: settingsResult.data,
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
    toast.success(`${username} unblocked.`);
  };

  const handleStatusChange = async (nextStatus: string) => {
    const previousStatus = statusUi;
    setStatusUi(nextStatus);
    setManualPresenceStatus(uiStatusToApi(nextStatus), statusMessage);
    setActionError('');
    const result = await saveUserStatus(uiStatusToApi(nextStatus), statusMessage);

    if (!result.ok) {
      setStatusUi(previousStatus);
      setManualPresenceStatus(uiStatusToApi(previousStatus), statusMessage);
      if (!onUnauthorized(result.status)) {
        setActionError(result.error);
        toast.error(result.error);
      }
      return;
    }

    toast.success(`Status set to ${nextStatus}.`);
    onUserUpdated?.();
  };

  const handleStatusMessageChange = (message: string) => {
    setStatusMessage(message);
    setPresenceStatusMessage(message);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        setSaving(true);
        const result = await saveUserStatus(uiStatusToApi(statusUi), message);
        setSaving(false);
        if (!result.ok) {
          if (!onUnauthorized(result.status)) {
            setActionError(result.error);
            toast.error(result.error);
          }
          return;
        }
        toast.success('Status message saved.');
      })();
    }, 800);
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
    setSnoozeValue(snoozeValueFromUntil(result.data.snoozeUntil));
    if (!result.data.dndEnabled) {
      setDndValue('off');
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
    const ok = await patchSettings(
      { snoozeValue: value },
      value === 'off' ? 'Snooze turned off.' : `${label}.`,
    );
    if (ok) setSnoozeOpen(false);
  };

  const handleDndChange = async (value: string) => {
    if (!settings) return;
    setDndValue(value);
    const label = DND_OPTIONS.find((option) => option.value === value)?.label ?? 'Do Not Disturb updated';
    const ok = await patchSettings(
      { dndValue: value },
      value === 'off' ? 'Do Not Disturb turned off.' : `${label} enabled.`,
    );
    if (ok) {
      setDndOpen(false);
      setDndValue(value);
    }
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
    setPushMessage('');

    try {
      const result = await enableDesktopPushNotifications();

      if (!result.ok) {
        setPushMessage(result.error);
        toast.error(result.error);
        return;
      }

      setPushEnabled(true);
      setPushMessage('Desktop notifications enabled.');
      toast.success('Desktop notifications enabled.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleRefreshPush = async () => {
    setPushBusy(true);
    setPushMessage('');

    try {
      const result = await enableDesktopPushNotifications();

      if (!result.ok) {
        setPushMessage(result.error);
        toast.error(result.error);
        return;
      }

      setPushEnabled(true);
      setPushMessage('Notification subscription refreshed.');
      toast.success('Notification subscription refreshed.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    setPushMessage('');

    try {
      const result = await disableDesktopPushNotifications();

      if (!result.ok) {
        setPushMessage(result.error);
        toast.error(result.error);
        return;
      }

      setPushEnabled(false);
      setPushMessage('Desktop notifications turned off.');
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
    if (avatarTab === 'initials') {
      return null;
    }

    if (avatarTab === 'upload') {
      return avatarUrl;
    }

    return buildGeneratedAvatarUrl(selectedStyle, avatarSeed);
  })();
  const selectedStyleName =
    avatarStyles.find((style) => style.id === selectedStyle)?.name ?? selectedStyle;
  const usernameChanged = usernameDraft.trim() !== savedUsername;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-app-chat-bg px-12 py-8 text-app-text">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-app-text tracking-tight">Profile & Settings</h1>
          {saving ? <span className="text-xs text-app-muted font-medium animate-pulse">Saving changes...</span> : null}
        </div>

        {actionError ? (
          <p className="mb-4 text-xs font-medium text-accent-soft" role="alert">{actionError}</p>
        ) : null}

        {/* Profile hero card */}
        <SectionCard className="mb-10 flex items-start gap-5 p-6 border-app-border/70 bg-gradient-to-br from-accent/10 via-app-card/70 to-app-card/50 shadow-md">
          <div className="relative shrink-0">
            <div className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-[#632a38] text-white shadow-md shadow-accent/20 ring-1 ring-white/10">
              <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">
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
            <div className={`absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full ring-2 ring-app-surface shadow-xs ${statusDotClass(statusUi)}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-app-text tracking-tight">{displayName}</h2>
            {profile.email ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-app-muted">
                <FiMail className="shrink-0" />
                {profile.email}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {profile.inOrganization ? (
                <span className="rounded-md bg-app-chat-hover px-2 py-1 text-[11px] font-semibold text-app-text">In organization</span>
              ) : null}
              {profile.organizationRole ? (
                <span className="rounded-md bg-accent-soft/20 px-2 py-1 text-[11px] font-semibold text-accent-soft">{profile.organizationRole}</span>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-start gap-4 text-xs font-semibold">
              <div className="min-w-0">
                <span
                  className={`inline-flex items-center gap-1.5 ${
                    statusUi === 'Busy'
                      ? 'text-orange-500'
                      : statusUi === 'Do not disturb'
                        ? 'text-red-500'
                        : statusUi === 'Away'
                          ? 'text-yellow-500'
                          : 'text-green-500'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${statusDotClass(statusUi)}`} />
                  {statusUi}
                </span>
                {statusMessage.trim() ? (
                  <p className="mt-1 max-w-md text-xs font-normal text-app-muted">{statusMessage.trim()}</p>
                ) : null}
              </div>
              <span className="inline-flex items-center gap-1.5 text-app-muted">
                <FiClock /> {formatLocalTime(timezone)}
              </span>
            </div>
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 items-start gap-x-16 gap-y-12 xl:grid-cols-2">
          <SectionGroup title="Profile">
            {/* Profile photo */}
            <section>
              <h3 className="text-base font-bold text-app-text">Profile photo</h3>
              <p className="mt-1 mb-4 text-sm text-app-muted">Pick a generated avatar, upload a photo, or use your initials.</p>
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-app-border bg-app-surface p-2">
                {(['avatar', 'upload', 'initials'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setAvatarTab(tab)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors ${
                      avatarTab === tab ? 'bg-app-chat-hover text-app-text' : 'text-app-muted hover:bg-app-chat-hover/60'
                    }`}
                  >
                    {tab === 'avatar' ? <FiStar className="text-lg" /> : tab === 'upload' ? <FiUpload className="text-lg" /> : <FiUser className="text-lg" />}
                    {tab === 'avatar' ? 'Avatar' : tab === 'upload' ? 'Upload' : 'Initials'}
                  </button>
                ))}
              </div>

              {avatarTab === 'avatar' ? (
                <>
                  <p className="mb-3 text-[10px] font-bold tracking-wider text-app-muted uppercase">Choose a style</p>
                  <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {avatarStyles.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => void handleSelectAvatarStyle(style.id)}
                        className={`overflow-hidden rounded-xl border transition-colors ${
                          selectedStyle === style.id ? 'border-accent ring-2 ring-accent/30' : 'border-app-border hover:border-app-muted'
                        }`}
                      >
                        <img src={style.previewUrl} alt={style.name} className="aspect-square w-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <p className="mb-3 text-sm text-app-muted">Selected: {selectedStyleName}</p>
                  <label className="mb-2 block text-sm font-semibold text-app-text">Avatar seed</label>
                  <div className="flex flex-wrap gap-3">
                    <input
                      type="text"
                      value={avatarSeed}
                      onChange={(event) => setAvatarSeed(event.target.value)}
                      className="min-w-[12rem] flex-1 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text focus:border-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleRandomizeSeed()}
                      className="inline-flex items-center gap-2 rounded-xl border border-app-border px-4 py-2 text-sm font-semibold text-app-text hover:bg-app-chat-hover"
                    >
                      <FiRefreshCw /> Randomize
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApplyAvatar()}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
                    >
                      Apply
                    </button>
                  </div>
                </>
              ) : null}

              {avatarTab === 'upload' ? (
                <div className="space-y-4">
                  {avatarUrl ? (
                    <div className="flex items-center gap-4">
                      <div className="relative h-20 w-20 overflow-hidden rounded-full bg-blue-400">
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-app-text">
                          {initials}
                        </span>
                        <RemoteImage
                          src={avatarUrl}
                          alt=""
                          loading="eager"
                          className="relative z-10 h-full w-full object-cover"
                        />
                      </div>
                      <p className="text-sm text-app-muted">Current uploaded photo</p>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleUploadAvatar}
                    className="rounded-xl border border-app-border px-4 py-2 text-sm font-semibold text-app-text hover:bg-app-chat-hover"
                  >
                    {avatarUrl ? 'Replace image' : 'Choose image to upload'}
                  </button>
                </div>
              ) : null}

              {avatarTab === 'initials' ? (
                <div>
                  <p className="mb-4 text-sm text-app-muted">Your initials are shown when no photo is set.</p>
                  <button
                    type="button"
                    onClick={() => void handleUseInitials()}
                    className="rounded-xl border border-app-border px-4 py-2 text-sm font-semibold text-app-text hover:bg-app-chat-hover"
                  >
                    Use initials
                  </button>
                </div>
              ) : null}
            </section>

            {/* Account details */}
            <section>
              <h3 className="text-base font-bold text-app-text">Account details</h3>
              <p className="mt-1 mb-4 text-sm text-app-muted">Your username is visible to others in chats and search.</p>
              <label className="mb-2 block text-sm font-semibold text-app-text">Username</label>
              <input
                type="text"
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                className="w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text focus:border-accent focus:outline-none"
              />
            </section>

            {/* Status */}
            <section>
              <h3 className="text-base font-bold text-app-text">Status</h3>
              <p className="mt-1 mb-4 text-sm text-app-muted">
                Shown under your name in chats. Available stays on while the app is open.
              </p>
              <div className="mb-4 grid grid-cols-2 gap-3">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => void handleStatusChange(option.label)}
                    className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
                      statusUi === option.label ? option.activeBorder : 'border-app-border bg-app-surface hover:border-app-muted'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-app-text">
                      <span className={`h-2 w-2 rounded-full ${option.dot}`} />
                      {option.label}
                    </span>
                    {statusUi === option.label ? <span className="text-[10px] font-bold text-accent">ACTIVE</span> : null}
                  </button>
                ))}
              </div>
              <label className="mb-2 block text-sm font-semibold text-app-text">Status message</label>
              <input
                type="text"
                placeholder="What's on your mind?"
                value={statusMessage}
                onChange={(event) => handleStatusMessageChange(event.target.value)}
                className="w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text placeholder-app-muted focus:border-accent focus:outline-none"
              />
            </section>

            {/* Online status */}
            <section>
              <h3 className="text-base font-bold text-app-text">Online status</h3>
              <p className="mt-1 mb-4 text-sm text-app-muted">
                Control whether teammates and friends can see when you are online, when you were last active, and when you read messages.
              </p>
              <SectionCard className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-app-text">Share online status & read receipts</p>
                    <p className="mt-1 mb-4 text-xs text-app-muted">
                      When off, others cannot see when you are online or when you read messages — and you will not see their status or read receipts either.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleOnlineStatusToggle()}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                        settings.shareOnlineStatus ? 'bg-accent text-white' : 'bg-app-chat-hover text-app-text'
                      }`}
                    >
                      {settings.shareOnlineStatus ? 'On' : 'Off'}
                    </button>
                  </div>
                  <FiEye className="mt-1 shrink-0 text-lg text-accent-soft" />
                </div>
              </SectionCard>
            </section>

            {/* Local time */}
            <section>
              <h3 className="text-base font-bold text-app-text">Local time</h3>
              <p className="mt-1 mb-4 text-sm text-app-muted">
                When you share online status, others can see your current local time while you are connected.
              </p>
              <SectionCard className="mb-3 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <FiClock className="text-app-muted" />
                  <span className="text-sm font-semibold text-app-text">{formatLocalTime(timezone)}</span>
                </div>
                <p className="text-xs text-app-muted">Others in your workspace and friends list see this local time.</p>
              </SectionCard>
              <button
                type="button"
                onClick={handleUseDeviceTime}
                className="mb-6 rounded-xl border border-app-border bg-transparent px-4 py-2 text-sm font-semibold text-app-text hover:bg-app-chat-hover"
              >
                Use device time ({formatTimezoneLabel(getDeviceTimezone())})
              </button>
              <label className="mb-2 block text-sm font-semibold text-app-text">Time zone</label>
              <div className="relative">
                <select
                  value={timezone}
                  onChange={(event) => void handleTimezoneChange(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text focus:border-accent focus:outline-none"
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
                <FiChevronDown className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-app-muted" />
              </div>
            </section>
          </SectionGroup>

          <SectionGroup title="Settings">
            {/* Appearance */}
            <section>
              <h3 className="text-base font-bold text-app-text">Appearance</h3>
              <p className="mt-1 mb-4 text-sm text-app-muted">Choose light or dark mode for the app.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setTheme('light');
                    toast.success('Light theme applied.');
                  }}
                  className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                    theme === 'light' ? 'border-accent bg-accent/10' : 'border-app-border bg-app-surface hover:border-app-muted'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-app-chat-bg text-app-text">
                    <FiSun className="text-lg" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-app-text">Light theme</p>
                    <p className="text-xs text-app-muted">Bright background and dark text</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTheme('dark');
                    toast.success('Dark theme applied.');
                  }}
                  className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                    theme === 'dark' ? 'border-accent bg-accent/10' : 'border-app-border bg-app-surface hover:border-app-muted'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface-input text-app-text">
                    <FiMoon className="text-lg" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-app-text">Dark theme</p>
                    <p className="text-xs text-app-muted">Dark background and light text</p>
                  </div>
                </button>
              </div>
            </section>

            {/* App snooze */}
            <section>
          <h3 className="text-base font-bold text-app-text">App snooze</h3>
          <p className="mt-1 mb-4 text-sm text-app-muted">
            Pause all notifications app-wide. Snooze individual hubs and groups from their chat header.
          </p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSnoozeOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-xl border border-app-border bg-app-surface p-4 transition-colors hover:border-app-muted"
            >
              <div className="flex items-center gap-3">
                <FiBellOff className="text-lg text-app-muted" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-app-text">Snooze all notifications</p>
                  <p className="text-xs text-app-muted">
                    {settings.snoozeUntil && new Date(settings.snoozeUntil).getTime() > Date.now()
                      ? `Snoozed until ${new Date(settings.snoozeUntil).toLocaleString()}`
                      : 'Notifications on'}
                  </p>
                </div>
              </div>
              <FiChevronDown className={`text-app-muted transition-transform ${snoozeOpen ? 'rotate-180' : ''}`} />
            </button>
            {snoozeOpen ? (
              <div className="absolute z-10 mt-2 w-full rounded-xl border border-app-border bg-app-elevated py-2 shadow-lg">
                {SNOOZE_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => void handleSnoozeChange(option.value)}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-app-chat-hover ${
                      snoozeValue === option.value ? 'text-accent-soft' : 'text-app-text'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {/* Do Not Disturb */}
        <section>
          <h3 className="text-base font-bold text-app-text">Do Not Disturb</h3>
          <p className="mt-1 mb-4 text-sm text-app-muted">Block all alerts until you turn it off or the timer ends.</p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDndOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-xl border border-app-border bg-app-surface p-4 transition-colors hover:border-app-muted"
            >
              <div className="flex items-center gap-3">
                <FiMoon className="text-lg text-app-muted" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-app-text">Do Not Disturb</p>
                  <p className="text-xs text-app-muted">{dndLabel(settings)}</p>
                </div>
              </div>
              <FiChevronDown className={`text-app-muted transition-transform ${dndOpen ? 'rotate-180' : ''}`} />
            </button>
            {dndOpen ? (
              <div className="absolute z-10 mt-2 w-full rounded-xl border border-app-border bg-app-elevated py-2 shadow-lg">
                {DND_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => void handleDndChange(option.value)}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-app-chat-hover ${
                      (option.value === 'off' && !settings.dndEnabled) ||
                      (option.value !== 'off' && settings.dndEnabled && dndValue === option.value)
                        ? 'text-accent-soft'
                        : 'text-app-text'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {/* Message sounds */}
        <section>
          <h3 className="text-base font-bold text-app-text">Message sounds</h3>
          <p className="mt-1 mb-4 text-sm text-app-muted">Discord-style ping when new messages arrive in other chats.</p>
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-app-text">Message notification sound</p>
            <p className="mt-1 mb-4 text-xs text-app-muted">
              Plays when someone else messages you in another chat. Your own messages never play a sound — just like Discord.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleMessageSoundToggle()}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  settings.messageSoundEnabled ? 'bg-accent text-white hover:bg-accent-hover' : 'bg-app-chat-hover text-app-text'
                }`}
              >
                <FiVolume2 className="text-lg" />
                {settings.messageSoundEnabled ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() => void handlePreviewMessageSound()}
                className="rounded-xl border border-app-border bg-transparent px-4 py-2 text-sm font-semibold text-app-text hover:bg-app-chat-hover"
              >
                Preview sound
              </button>
            </div>
          </SectionCard>
        </section>

        {/* Push notifications */}
        <section>
          <h3 className="text-base font-bold text-app-text">Push notifications</h3>
          <p className="mt-1 mb-4 text-sm text-app-muted">Receive alerts when you are away from Flexhubs.</p>
          <SectionCard className="p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-app-text">Desktop notifications</p>
              {pushEnabled ? (
                <FiBell className="text-lg text-accent-soft" />
              ) : (
                <FiBellOff className="text-lg text-app-muted" />
              )}
            </div>
            <p className="mb-4 text-xs text-app-muted">
              {pushEnabled
                ? 'You will receive alerts for new messages and activity while Flexhubs is open.'
                : 'Enable notifications to get alerts when Flexhubs is in the background.'}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {pushEnabled ? (
                <>
                  <button
                    type="button"
                    disabled={pushBusy}
                    onClick={() => void handleRefreshPush()}
                    className="inline-flex items-center gap-2 rounded-xl border border-app-border px-4 py-2 text-sm font-semibold text-app-text transition-colors hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiRefreshCw className="text-base" />
                    {pushBusy ? 'Refreshing…' : 'Refresh subscription'}
                  </button>
                  <button
                    type="button"
                    disabled={pushBusy}
                    onClick={() => void handleDisablePush()}
                    className="rounded-xl border border-app-border px-4 py-2 text-sm font-semibold text-app-text transition-colors hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Turn off
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={pushBusy}
                  onClick={() => void handleEnablePush()}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pushBusy ? 'Enabling…' : 'Enable notifications'}
                </button>
              )}
            </div>
            {pushMessage ? (
              <p className="mt-3 text-xs text-app-muted">{pushMessage}</p>
            ) : null}
          </SectionCard>
        </section>
          </SectionGroup>
        </div>

        <section className="mt-12 border-t border-app-border pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-app-text">Save profile changes</h3>
              <p className="mt-1 text-sm text-app-muted">
                Username changes are saved here. Status, timezone, avatar, and notification settings save automatically when you update them.
              </p>
            </div>
            <div className="flex shrink-0 justify-end gap-3">
              <button
                type="button"
                disabled={!usernameChanged || saving}
                onClick={() => setUsernameDraft(savedUsername)}
                className="rounded-xl border border-app-border px-4 py-2 text-sm font-semibold text-app-text hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!usernameChanged || saving || !usernameDraft.trim()}
                onClick={() => void handleSaveUsername()}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save changes
              </button>
            </div>
          </div>
        </section>

        {/* Blocked users */}
        <section className="mt-12">
          <h3 className="text-base font-bold text-app-text">Blocked users</h3>
          <p className="mt-1 mb-4 text-sm text-app-muted">People you have blocked cannot message you.</p>
          {blockedLoading ? (
            <p className="text-sm text-app-muted">Loading blocked users...</p>
          ) : blockedUsers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-app-border px-4 py-6 text-sm text-app-muted">
              No blocked users.
            </p>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-app-text">{user.username}</p>
                    {user.email ? <p className="truncate text-xs text-app-muted">{user.email}</p> : null}
                  </div>
                  <button
                    type="button"
                    disabled={unblockingId === user.id}
                    className="shrink-0 rounded-lg border border-app-border px-3 py-1.5 text-xs font-semibold text-app-text hover:bg-app-chat-hover disabled:opacity-50"
                    onClick={() => void handleUnblockUser(user.id, user.username)}
                  >
                    {unblockingId === user.id ? 'Unblocking...' : 'Unblock'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Session */}
        <section className="mt-12 pb-4">
          <h3 className="text-base font-bold text-app-text">Session</h3>
          <p className="mt-1 mb-4 text-sm text-app-muted">Sign out of Flexhubs on this device.</p>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10"
          >
            <FiLogOut /> Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
