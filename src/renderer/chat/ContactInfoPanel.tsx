import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  FiBell,
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSearch,
  FiSlash,
  FiTrash2,
  FiVideo,
  FiX,
} from 'react-icons/fi';
import type { ConversationItem } from '../../shared/chat';
import { mapApiPresenceToStatus, type PresenceStatus } from '../../shared/chat';
import {
  formatContactPresenceLabel,
  mapContactPresenceStatus,
  normalizeContactUser,
  presenceDotClass,
  type ContactUserProfile,
} from '../../shared/contact';
import { blockUser, loadUserPresence, loadUserProfile } from '../chatApi';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { Avatar, PinIcon } from './ChatIcons';
import { ConversationSharedFiles } from './ConversationSharedFiles';

type ContactInfoPanelProps = {
  conversation: ConversationItem;
  peerUserId: string;
  pinnedCount: number;
  notificationsSnoozed: boolean;
  canCall: boolean;
  callBusy?: boolean;
  onClose: () => void;
  onStartVoiceCall?: () => void;
  onStartVideoCall?: () => void;
  onOpenSearch: () => void;
  onOpenPinned: () => void;
  onTogglePinChat: () => void;
  onMarkUnread: () => void;
  onClearHistory: () => void;
  onScheduleEvent: () => void;
  onSnooze: (duration: string) => void;
  snoozeOptions: ReadonlyArray<{ value: string; label: string }>;
};

type ActionRowProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  trailing?: ReactNode;
};

function ActionRow({ icon, title, subtitle, onClick, disabled, danger, trailing }: ActionRowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-2xl border border-app-border/60 bg-app-card/50 px-3.5 py-3 text-left transition-all duration-150 hover:bg-app-card hover:border-app-border hover:shadow-xs disabled:opacity-50 ${
        danger ? 'border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5' : ''
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
          danger ? 'bg-red-500/10 text-red-400' : 'bg-app-inset text-app-muted'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${danger ? 'text-red-400' : 'text-app-text'}`}>{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-app-muted">{subtitle}</p> : null}
      </div>
      {trailing ?? <FiChevronRight className="shrink-0 text-app-muted/70 group-hover:text-app-text group-hover:translate-x-0.5 transition-all text-xs" />}
    </button>
  );
}

export function ContactInfoPanel({
  conversation,
  peerUserId,
  pinnedCount,
  notificationsSnoozed,
  canCall,
  callBusy = false,
  onClose,
  onStartVoiceCall,
  onStartVideoCall,
  onOpenSearch,
  onOpenPinned,
  onTogglePinChat,
  onMarkUnread,
  onClearHistory,
  onScheduleEvent,
  onSnooze,
  snoozeOptions,
}: ContactInfoPanelProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [profile, setProfile] = useState<ContactUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveStatus, setLiveStatus] = useState<PresenceStatus | null>(null);
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    const result = await loadUserProfile(peerUserId);

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const normalized = normalizeContactUser(result.data);

    if (!normalized) {
      setError('Could not load contact profile.');
      return;
    }

    setProfile(normalized);
  }, [peerUserId]);

  const refreshPresence = useCallback(async () => {
    const result = await loadUserPresence([peerUserId]);

    if (!result.ok) {
      return;
    }

    const item = result.data.find((entry) => entry.userId === peerUserId);

    if (item) {
      setLiveStatus(mapApiPresenceToStatus(item.status));
    }
  }, [peerUserId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void refreshPresence();

    const intervalId = window.setInterval(() => {
      void refreshPresence();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [refreshPresence]);

  const displayName = profile?.name ?? conversation.title;
  const presenceStatus =
    liveStatus ?? mapContactPresenceStatus(profile?.status ?? null) ?? null;
  const presenceLabel = formatContactPresenceLabel(
    presenceStatus,
    profile?.lastSeenAt ?? null,
    profile?.sharePresence ?? true,
  );

  const handleBlockUser = async () => {
    const confirmed = await confirm({
      title: 'Block user',
      message: `Block ${displayName}? They will no longer be able to message you.`,
      confirmLabel: 'Block user',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setBlocking(true);
    const result = await blockUser(peerUserId);
    setBlocking(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${displayName} blocked.`);
    onClose();
  };

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col border-l border-app-border/70 bg-app-surface/95 backdrop-blur-xl font-sans text-app-text shadow-2xl">
      <header className="flex items-center justify-between border-b border-app-border/50 px-5 py-4">
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold tracking-wider text-app-muted uppercase">
            Contact Details
          </span>
          <h2 className="truncate text-base font-semibold text-app-text tracking-tight">{displayName}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
          aria-label="Close contact panel"
        >
          <FiX className="text-base" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="flex flex-col items-center border-b border-app-border/50 px-5 py-6 bg-gradient-to-b from-accent/5 to-transparent">
          <div className="relative mb-3.5">
            <Avatar
              imageUrl={profile?.avatarUrl ?? null}
              initials={profile?.avatarInitials ?? displayName.slice(0, 2).toUpperCase()}
              size="lg"
            />
            <span
              className={`absolute right-1 bottom-1 h-3.5 w-3.5 rounded-full ring-2 ring-app-surface ${presenceDotClass(presenceStatus)}`}
              aria-hidden="true"
            />
          </div>
          <h3 className="text-base font-semibold text-app-text tracking-tight">{displayName}</h3>
          <p className="mt-1 text-xs text-app-muted">
            {loading ? 'Loading...' : presenceLabel}
          </p>
          {error ? (
            <p className="mt-2 text-xs text-accent-soft" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <section className="border-b border-app-border/50 p-5">
          <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-app-muted uppercase">Bio</span>
          <p className="text-xs leading-relaxed text-app-muted">
            {profile?.bio?.trim() || 'No bio added yet'}
          </p>
        </section>

        <ConversationSharedFiles conversationId={conversation.id} />

        <section className="space-y-2 p-5">
          {canCall ? (
            <>
              <ActionRow
                icon={<FiPhone />}
                title="Audio call"
                subtitle="Start a voice call"
                disabled={callBusy}
                onClick={onStartVoiceCall}
              />
              <ActionRow
                icon={<FiVideo />}
                title="Video call"
                subtitle="Start a video call"
                disabled={callBusy}
                onClick={onStartVideoCall}
              />
            </>
          ) : null}

          <ActionRow
            icon={<FiSearch />}
            title="Search messages"
            subtitle="Find text in this chat"
            onClick={() => {
              onClose();
              onOpenSearch();
            }}
          />

          <ActionRow
            icon={<PinIcon size={16} />}
            title="Pinned messages"
            subtitle={pinnedCount > 0 ? `${pinnedCount} pinned` : 'No pinned messages yet'}
            onClick={() => {
              onClose();
              onOpenPinned();
            }}
          />

          <div className="relative">
            <ActionRow
              icon={<FiBell />}
              title="Notifications"
              subtitle={notificationsSnoozed ? 'Notifications snoozed' : 'Notifications on'}
              trailing={
                <FiChevronDown
                  className={`shrink-0 text-app-muted transition-transform ${snoozeMenuOpen ? 'rotate-180' : ''}`}
                />
              }
              onClick={() => setSnoozeMenuOpen((open) => !open)}
            />
            {snoozeMenuOpen ? (
              <div className="mt-2 rounded-2xl border border-app-border/80 bg-app-surface/95 backdrop-blur-xl p-1.5 shadow-xl">
                {notificationsSnoozed ? (
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-app-inset transition-colors"
                    onClick={() => {
                      setSnoozeMenuOpen(false);
                      onSnooze('off');
                    }}
                  >
                    Turn notifications back on
                  </button>
                ) : null}
                {snoozeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="block w-full rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-app-inset transition-colors"
                    onClick={() => {
                      setSnoozeMenuOpen(false);
                      onSnooze(option.value);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <ActionRow
            icon={<FiCalendar />}
            title="Schedule event"
            subtitle="Add a calendar reminder for this chat"
            onClick={() => {
              onClose();
              onScheduleEvent();
            }}
          />

          <ActionRow
            icon={<FiMail />}
            title="Mark as unread"
            subtitle="Show this chat as unread in your list"
            onClick={onMarkUnread}
          />

          <ActionRow
            icon={<FiMapPin />}
            title={conversation.isPinned ? 'Unpin chat' : 'Pin chat'}
            subtitle="Pin this chat to the top of your list"
            onClick={onTogglePinChat}
          />

          <ActionRow
            icon={<FiTrash2 />}
            title="Clear chat history"
            subtitle="Hide messages on your device only"
            danger
            onClick={onClearHistory}
          />

          <ActionRow
            icon={<FiSlash />}
            title="Block user"
            subtitle="Stop messages and requests"
            danger
            disabled={blocking}
            onClick={() => {
              void handleBlockUser();
            }}
          />
        </section>
      </div>
    </div>
  );
}
