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
  FiClock,
  FiUser,
  FiLogOut,
  FiMoreHorizontal,
  FiMessageSquare,
} from 'react-icons/fi';
import type { ConversationItem } from '../../shared/chat';
import { mapApiPresenceToStatus, type PresenceStatus } from '../../shared/chat';
import {
  formatContactPresenceLabel,
  mapContactPresenceStatus,
  normalizeContactUser,
  initialsFromName,
  presenceDotClass,
  type ContactUserProfile,
} from '../../shared/contact';
import {
  markUserBlocked,
  markUserUnblocked,
  refreshBlockedUsersFromApi,
  subscribeBlockedUsers,
  syncPeerBlockFromRelationship,
} from '../blockedUsersSync';
import { redactPeerProfileForViewerBlocked } from '../../shared/blocking';
import { blockUser, loadFriendRelationship, loadUserPresence, loadUserProfile, unblockUser } from '../chatApi';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { Avatar, PinIcon } from './ChatIcons';
import { ConversationSharedFiles } from './ConversationSharedFiles';

type ContactInfoPanelProps = {
  conversation: ConversationItem;
  peerUserId: string;
  pinnedCount: number;
  pinnedMessages?: any[];
  onJumpToMessage?: (id: string) => void;
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
  onBlockedUsersChanged?: () => void;
  peerIsBlocked?: boolean;
  peerBlockedViewer?: boolean;
};

type AccordionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  trailing?: ReactNode;
  badge?: string | number;
};

function Accordion({ title, children, defaultOpen = false, trailing, badge }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-app-border/40">
      <button 
        type="button"
        className="flex w-full items-center justify-between p-4 py-3.5 hover:bg-app-inset/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-[14px] font-semibold text-app-text">{title}</span>
        <div className="flex items-center gap-3">
           {badge != null && <span className="bg-app-inset/80 text-app-muted text-xs px-2.5 py-0.5 rounded-full font-medium">{badge}</span>}
           {trailing}
           <FiChevronDown className={`text-app-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function ContactInfoPanel({
  conversation,
  peerUserId,
  pinnedCount,
  pinnedMessages = [],
  onJumpToMessage,
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
  onBlockedUsersChanged,
  peerIsBlocked = false,
  peerBlockedViewer = false,
}: ContactInfoPanelProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [profile, setProfile] = useState<ContactUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveStatus, setLiveStatus] = useState<PresenceStatus | null>(null);
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [relationshipBlocked, setRelationshipBlocked] = useState(false);
  const [relationshipLoading, setRelationshipLoading] = useState(true);

  const isBlocked = peerIsBlocked || relationshipBlocked;

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

  const loadRelationship = useCallback(async () => {
    setRelationshipLoading(true);
    const result = await loadFriendRelationship(peerUserId);
    setRelationshipLoading(false);
    if (result.ok) {
      syncPeerBlockFromRelationship(peerUserId, result.data);
      setRelationshipBlocked(peerIsBlocked || result.data.blockedByMe === true);
    }
  }, [peerIsBlocked, peerUserId]);

  useEffect(() => {
    void loadProfile();
    void loadRelationship();
  }, [loadProfile, loadRelationship]);

  useEffect(() => {
    return subscribeBlockedUsers(() => {
      void loadRelationship();
    });
  }, [loadRelationship]);

  useEffect(() => {
    if (peerBlockedViewer) {
      setLiveStatus(null);
      return;
    }

    void refreshPresence();
    const intervalId = window.setInterval(() => {
      void refreshPresence();
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [peerBlockedViewer, refreshPresence]);

  const displayName = profile?.name ?? conversation.title;
  const visibleProfile = profile
    ? redactPeerProfileForViewerBlocked(
        {
          avatarUrl: profile.avatarUrl,
          status: profile.status,
          lastSeenAt: profile.lastSeenAt,
          sharePresence: profile.sharePresence,
          tagline: profile.tagline,
          role: profile.role,
        },
        peerBlockedViewer,
      )
    : null;
  const presenceStatus = peerBlockedViewer
    ? null
    : liveStatus ?? mapContactPresenceStatus(visibleProfile?.status ?? null) ?? null;
  const presenceLabel = formatContactPresenceLabel(
    presenceStatus,
    visibleProfile?.lastSeenAt ?? null,
    visibleProfile?.sharePresence ?? true,
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
    setRelationshipBlocked(true);
    markUserBlocked(peerUserId);
    void refreshBlockedUsersFromApi();
    toast.success(`${displayName} blocked.`);
    onBlockedUsersChanged?.();
  };

  const handleUnblockUser = async () => {
    const confirmed = await confirm({
      title: 'Unblock user',
      message: `Unblock ${displayName}? They will be able to message you again.`,
      confirmLabel: 'Unblock user',
    });
    if (!confirmed) {
      return;
    }
    setBlocking(true);
    const result = await unblockUser(peerUserId);
    setBlocking(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRelationshipBlocked(false);
    markUserUnblocked(peerUserId);
    void refreshBlockedUsersFromApi();
    toast.success(`${displayName} unblocked.`);
    onBlockedUsersChanged?.();
  };

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col border-l border-app-border/70 bg-app-surface/95 backdrop-blur-xl font-sans text-app-text shadow-2xl">
      <header className="flex items-center justify-between border-b border-app-border/40 px-4 py-4">
        <h2 className="text-[17px] font-bold text-app-text tracking-tight">Conversation details</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
          aria-label="Close contact panel"
        >
          <FiX className="text-xl" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center pt-8 pb-6 px-4">
          <div className="relative mb-3 flex items-center justify-center h-[88px] w-[88px]">
            <Avatar
              imageUrl={visibleProfile?.avatarUrl ?? conversation.avatarUrl ?? null}
              initials={profile?.avatarInitials ?? initialsFromName(displayName)}
              size="xl"
            />
          </div>
          <div className="flex items-center gap-1 mb-1">
            <h3 className="text-[17px] font-bold text-app-text">{displayName}</h3>
          </div>
          {!peerBlockedViewer ? (
            <div className="flex items-center gap-1.5 text-[13px] mb-1">
              <span
                className={`w-2 h-2 rounded-full ${presenceStatus === 'online' ? 'bg-emerald-500' : 'bg-app-muted'}`}
              ></span>
              <span className="text-app-text font-medium">
                {presenceStatus === 'online' ? 'Online' : presenceLabel}
              </span>
            </div>
          ) : null}
          {!peerBlockedViewer && visibleProfile?.role ? (
            <p className="text-[13px] text-app-muted mb-1">{visibleProfile.role}</p>
          ) : null}
          {!peerBlockedViewer && visibleProfile?.tagline ? (
            <p className="text-[13px] text-app-muted">"{visibleProfile.tagline}"</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-start justify-center gap-5 pb-6 border-b border-app-border/40 px-4">
          <button type="button" className="flex flex-col items-center gap-2 group">
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-app-border bg-transparent text-[#972c44] transition-colors group-hover:bg-[#972c44]/5">
              <FiMessageSquare className="text-lg" />
            </div>
            <span className="text-[11px] font-medium text-app-text">Message</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-2 group"
            onClick={onStartVoiceCall}
            disabled={!canCall || callBusy || isBlocked || peerBlockedViewer}
          >
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-app-border bg-transparent text-[#972c44] transition-colors group-hover:bg-[#972c44]/5 disabled:opacity-40">
              <FiPhone className="text-lg" />
            </div>
            <span className="text-[11px] font-medium text-app-text">Call</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-2 group"
            onClick={onStartVideoCall}
            disabled={!canCall || callBusy || isBlocked || peerBlockedViewer}
          >
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-app-border bg-transparent text-[#972c44] transition-colors group-hover:bg-[#972c44]/5 disabled:opacity-40">
              <FiVideo className="text-lg" />
            </div>
            <span className="text-[11px] font-medium text-app-text">Video</span>
          </button>
          {!relationshipLoading ? (
            <button
              type="button"
              className="flex flex-col items-center gap-2 group"
              disabled={blocking}
              onClick={() => {
                if (isBlocked) {
                  void handleUnblockUser();
                } else {
                  void handleBlockUser();
                }
              }}
            >
              <div
                className={`flex h-[42px] w-[42px] items-center justify-center rounded-full border bg-transparent transition-colors disabled:opacity-40 ${
                  isBlocked
                    ? 'border-app-border text-app-text group-hover:bg-app-inset/60'
                    : 'border-red-500/30 text-[#c42c44] group-hover:bg-red-500/10'
                }`}
              >
                <FiSlash className="text-lg" />
              </div>
              <span className={`text-[11px] font-medium ${isBlocked ? 'text-app-text' : 'text-[#c42c44]'}`}>
                {isBlocked ? 'Unblock' : 'Block'}
              </span>
            </button>
          ) : null}
        </div>

        <Accordion title="About" defaultOpen>
          <div className="space-y-4 pt-2">
            <div className="flex items-center">
              <div className="flex items-center gap-3 w-[120px] text-app-muted">
                <FiClock className="text-base" />
                <span className="text-[13px]">Local time</span>
              </div>
              <span className="text-[13px] text-app-text font-medium">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {profile?.email && (
              <div className="flex items-center">
                <div className="flex items-center gap-3 w-[120px] text-app-muted">
                  <FiMail className="text-base" />
                  <span className="text-[13px]">Email</span>
                </div>
                <span className="text-[13px] text-[#972c44] font-medium truncate">{profile.email}</span>
              </div>
            )}
            {profile?.createdAt && (
              <div className="flex items-center">
                <div className="flex items-center gap-3 w-[120px] text-app-muted">
                  <FiUser className="text-base" />
                  <span className="text-[13px]">Member since</span>
                </div>
                <span className="text-[13px] text-app-text font-medium">
                  {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </Accordion>

        <Accordion title="Shared files" defaultOpen trailing={<span className="text-[12px] font-medium text-[#972c44]">See all</span>}>
          <div className="pt-2">
            <ConversationSharedFiles conversationId={conversation.id} />
          </div>
        </Accordion>

        <Accordion title="Pinned messages" badge={pinnedCount > 0 ? pinnedCount : undefined}>
          <div className="pt-2">
            {pinnedMessages.length === 0 ? (
              <p className="text-[13px] text-app-muted">Pinned messages will appear here...</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {pinnedMessages.map((msg) => (
                  <button
                    key={msg.id}
                    className="flex flex-col gap-1 rounded-[12px] border border-[#e2d5d8] bg-[#f8f9fa] px-3 py-2.5 text-left transition-colors hover:bg-[#f0f4f8]"
                    onClick={() => onJumpToMessage?.(msg.id)}
                  >
                    <span className="text-[12px] font-semibold text-accent truncate w-full">{msg.senderName || 'Pinned message'}</span>
                    <span className="text-[13px] text-[#1e293b] line-clamp-2 w-full leading-snug">{msg.content || 'Attachment'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Accordion>

        <div className="px-4 pt-2 pb-6">
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 py-3 text-[#c42c44] transition-colors hover:bg-red-500/10 hover:border-red-500/30"
          >
            <FiLogOut className="text-base" />
            <span className="text-[13px] font-semibold">Leave conversation</span>
          </button>
        </div>
      </div>
    </div>
  );
}

