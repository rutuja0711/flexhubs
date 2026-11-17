import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiPhone, FiSend, FiUser, FiVideo, FiX } from 'react-icons/fi';
import type { PresenceStatus } from '../../shared/chat';
import { shouldRedactUserIdentity } from '../../shared/blocking';
import {
  formatContactPresenceLabel,
  mapContactPresenceStatus,
  normalizeContactUser,
  type ContactUserProfile,
} from '../../shared/contact';
import { canViewPeerPresence } from '../../shared/presencePrivacy';
import { sidebarPresenceStatusForPeer } from '../../shared/presence';
import { readUserClientDevice } from '../../shared/profileBanner';
import { loadUserProfile } from '../chatApi';
import { ProfileIdentityHeader } from './ProfileIdentityHeader';

export type UserProfileAnchor = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarInitials?: string;
};

export type UserProfilePopupProps = {
  anchor: UserProfileAnchor;
  position: { top: number; left: number };
  onClose: () => void;
  contextTitle?: string;
  currentUserId: string | null;
  presenceByUserId?: ReadonlyMap<string, PresenceStatus>;
  viewerSharePresence?: boolean;
  blockedUserIds?: ReadonlySet<string>;
  blockedByPeerIds?: ReadonlySet<string>;
  onSendMessage?: (userId: string, displayName: string, text: string) => void | Promise<void>;
  onVoiceCall?: (userId: string, displayName: string) => void;
  onVideoCall?: (userId: string, displayName: string) => void;
  onViewProfile?: (userId: string, displayName: string) => void;
  onRefreshPresence?: (userId: string) => void;
  callBusy?: boolean;
};

const PANEL_WIDTH = 340;

function ActionTile({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-app-border bg-app-surface/80 px-2 py-3 text-center transition-all active:scale-[0.98] hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-app-border/80">
        {icon}
      </span>
      <span className="text-[11px] font-semibold text-app-text">{label}</span>
    </button>
  );
}

export function UserProfilePopup({
  anchor,
  position,
  onClose,
  contextTitle,
  currentUserId,
  presenceByUserId,
  viewerSharePresence = true,
  blockedUserIds,
  blockedByPeerIds,
  onSendMessage,
  onVoiceCall,
  onVideoCall,
  onViewProfile,
  onRefreshPresence,
  callBusy = false,
}: UserProfilePopupProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [adjusted, setAdjusted] = useState(position);
  const [visible, setVisible] = useState(false);
  const [profile, setProfile] = useState<ContactUserProfile | null>(null);
  const [rawProfilePayload, setRawProfilePayload] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const redactIdentity = shouldRedactUserIdentity(
    anchor.userId,
    blockedUserIds ?? new Set(),
    blockedByPeerIds ?? new Set(),
  );

  const displayName = redactIdentity ? 'Blocked user' : profile?.name ?? anchor.displayName;
  const avatarUrl = redactIdentity ? null : profile?.avatarUrl ?? anchor.avatarUrl ?? null;
  const avatarInitials = profile?.avatarInitials ?? anchor.avatarInitials ?? displayName.slice(0, 2).toUpperCase();
  const bannerUrl = redactIdentity ? null : profile?.coverBannerUrl ?? null;

  const peerPresenceVisible =
    !redactIdentity &&
    canViewPeerPresence(
      { id: currentUserId ?? '', sharePresence: viewerSharePresence },
      { id: anchor.userId, sharePresence: profile?.sharePresence ?? true },
    );

  const presenceStatus: PresenceStatus | null = useMemo(() => {
    if (!peerPresenceVisible) {
      return null;
    }

    return sidebarPresenceStatusForPeer(
      presenceByUserId ?? new Map(),
      anchor.userId,
      mapContactPresenceStatus(profile?.status ?? null),
    );
  }, [anchor.userId, peerPresenceVisible, presenceByUserId, profile?.status]);

  const presenceLabel = formatContactPresenceLabel(
    presenceStatus,
    profile?.lastSeenAt ?? null,
    profile?.sharePresence ?? true,
  );

  const deviceLabel =
    presenceStatus === 'online' && !redactIdentity
      ? readUserClientDevice(rawProfilePayload)
      : null;

  const isSelf = anchor.userId === currentUserId;

  const handleSendMessage = () => {
    const text = messageDraft.trim();
    if (!text || !onSendMessage || sendingMessage) {
      return;
    }

    setSendingMessage(true);
    setMessageDraft('');
    void Promise.resolve(onSendMessage(anchor.userId, displayName, text)).finally(() => {
      setSendingMessage(false);
    });
    onClose();
  };

  useEffect(() => {
    onRefreshPresence?.(anchor.userId);
  }, [anchor.userId, onRefreshPresence]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void loadUserProfile(anchor.userId).then((result) => {
      if (cancelled) {
        return;
      }

      setLoading(false);

      if (!result.ok) {
        return;
      }

      setRawProfilePayload(result.data);
      setProfile(normalizeContactUser(result.data));
    });

    return () => {
      cancelled = true;
    };
  }, [anchor.userId]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const padding = 12;
    let top = position.top;
    let left = position.left + 8;

    if (left + rect.width > window.innerWidth - padding) {
      left = Math.max(padding, position.left - rect.width - 8);
    }

    if (top + rect.height > window.innerHeight - padding) {
      top = Math.max(padding, position.top - rect.height - 8);
    }

    if (top < padding) {
      top = padding;
    }

    if (left < padding) {
      left = padding;
    }

    setAdjusted({ top, left });
  }, [loading, position.left, position.top, profile?.email]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current?.contains(event.target as Node)) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed z-[10000] overflow-hidden rounded-2xl border border-app-border/80 bg-app-surface shadow-2xl shadow-black/25 backdrop-blur-xl transition-all duration-200 ease-out dark:border-white/10 dark:bg-[#121318]/98 ${
        visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-1 opacity-0 scale-[0.98]'
      }`}
      style={{ top: adjusted.top, left: adjusted.left, width: PANEL_WIDTH, maxHeight: 'min(90vh, 580px)' }}
      role="dialog"
      aria-label={`${displayName} profile`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/50"
        aria-label="Close profile"
      >
        <FiX />
      </button>

      <ProfileIdentityHeader
        displayName={displayName}
        avatarUrl={avatarUrl}
        avatarInitials={avatarInitials}
        bannerUrl={bannerUrl}
        presenceStatus={presenceStatus}
        showPresence={!redactIdentity && peerPresenceVisible}
        coverHeightClass="h-[112px]"
        size="lg"
      />

      <div className="px-4 pb-3 text-center">
        <h3 className="text-[17px] font-bold tracking-tight text-app-text">{displayName}</h3>
        {!redactIdentity ? (
          <p className="mt-1 text-[13px] text-app-muted">
            {peerPresenceVisible ? presenceLabel : 'Offline'}
            {deviceLabel ? ` · ${deviceLabel}` : ''}
          </p>
        ) : null}
        {!redactIdentity && profile?.designation ? (
          <p className="mt-1 text-[12px] font-medium text-app-text/90">{profile.designation}</p>
        ) : null}
        {!redactIdentity && (profile?.organizationName || contextTitle) ? (
          <p className="mt-0.5 text-[12px] text-app-muted">
            {profile?.organizationName ?? contextTitle}
          </p>
        ) : null}
        {!redactIdentity && profile?.email && anchor.userId !== currentUserId ? (
          <p className="mt-2 truncate text-[12px] text-app-muted">{profile.email}</p>
        ) : null}
        {loading ? (
          <p className="mt-2 text-[11px] text-app-muted animate-pulse">Loading profile…</p>
        ) : null}
      </div>

      {!isSelf ? (
        <div className="overflow-y-auto border-t border-app-border/60">
          {redactIdentity ? (
            <p className="px-4 py-3 text-center text-xs text-app-muted">Messaging is unavailable for blocked users.</p>
          ) : (
            <>
              <div className="flex gap-2 px-4 py-3">
                <ActionTile
                  label="Audio"
                  disabled={callBusy || !onVoiceCall}
                  icon={<FiPhone className="text-lg text-[#972c44]" aria-hidden />}
                  onClick={() => {
                    if (!onVoiceCall) {
                      return;
                    }
                    onClose();
                    onVoiceCall(anchor.userId, displayName);
                  }}
                />
                <ActionTile
                  label="Video"
                  disabled={callBusy || !onVideoCall}
                  icon={<FiVideo className="text-lg text-[#972c44]" aria-hidden />}
                  onClick={() => {
                    if (!onVideoCall) {
                      return;
                    }
                    onClose();
                    onVideoCall(anchor.userId, displayName);
                  }}
                />
                <ActionTile
                  label="View profile"
                  disabled={!onViewProfile}
                  icon={<FiUser className="text-lg text-[#972c44]" aria-hidden />}
                  onClick={() => {
                    if (!onViewProfile) {
                      return;
                    }
                    onViewProfile(anchor.userId, displayName);
                  }}
                />
              </div>

              <div className="border-t border-app-border/60 px-4 py-2.5">
                <label className="sr-only" htmlFor="profile-popup-message">
                  Message {displayName}
                </label>
                <div className="flex items-center gap-1.5">
                  <textarea
                    ref={messageRef}
                    id="profile-popup-message"
                    rows={1}
                    value={messageDraft}
                    disabled={!onSendMessage || sendingMessage}
                    placeholder="Write a message…"
                    className="h-10 min-h-10 max-h-16 w-0 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-app-border bg-app-chat-bg px-2.5 py-2 text-[13px] leading-5 text-app-text placeholder:text-app-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
                    onChange={(event) => setMessageDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!onSendMessage || sendingMessage || !messageDraft.trim()}
                    aria-label="Send message"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => void handleSendMessage()}
                  >
                    <FiSend className="text-base" aria-hidden />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}