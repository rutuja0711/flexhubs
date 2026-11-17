import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiPhone, FiSend, FiVideo, FiX } from 'react-icons/fi';
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

type UserProfileFullModalProps = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarInitials?: string;
  currentUserId: string | null;
  presenceByUserId?: ReadonlyMap<string, PresenceStatus>;
  viewerSharePresence?: boolean;
  blockedUserIds?: ReadonlySet<string>;
  blockedByPeerIds?: ReadonlySet<string>;
  onClose: () => void;
  onSendMessage?: (userId: string, displayName: string, text: string) => void | Promise<void>;
  onVoiceCall?: (userId: string, displayName: string) => void;
  onVideoCall?: (userId: string, displayName: string) => void;
  callBusy?: boolean;
};

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

export function UserProfileFullModal({
  userId,
  displayName: anchorName,
  avatarUrl: anchorAvatar,
  avatarInitials: anchorInitials,
  currentUserId,
  presenceByUserId,
  viewerSharePresence = true,
  blockedUserIds,
  blockedByPeerIds,
  onClose,
  onSendMessage,
  onVoiceCall,
  onVideoCall,
  callBusy = false,
}: UserProfileFullModalProps) {
  const [profile, setProfile] = useState<ContactUserProfile | null>(null);
  const [rawPayload, setRawPayload] = useState<unknown>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const redactIdentity = shouldRedactUserIdentity(
    userId,
    blockedUserIds ?? new Set(),
    blockedByPeerIds ?? new Set(),
  );

  const displayName = redactIdentity ? 'Blocked user' : profile?.name ?? anchorName;
  const avatarUrl = redactIdentity ? null : profile?.avatarUrl ?? anchorAvatar ?? null;
  const avatarInitials = profile?.avatarInitials ?? anchorInitials ?? displayName.slice(0, 2).toUpperCase();

  const peerPresenceVisible =
    !redactIdentity &&
    canViewPeerPresence(
      { id: currentUserId ?? '', sharePresence: viewerSharePresence },
      { id: userId, sharePresence: profile?.sharePresence ?? true },
    );

  const presenceStatus = peerPresenceVisible
    ? sidebarPresenceStatusForPeer(
        presenceByUserId ?? new Map(),
        userId,
        mapContactPresenceStatus(profile?.status ?? null),
      )
  : null;

  const presenceLabel = formatContactPresenceLabel(
    presenceStatus,
    profile?.lastSeenAt ?? null,
    profile?.sharePresence ?? true,
  );

  const deviceLabel =
    presenceStatus === 'online' && !redactIdentity ? readUserClientDevice(rawPayload) : null;

  const isSelf = userId === currentUserId;

  const handleSendMessage = () => {
    const text = messageDraft.trim();
    if (!text || !onSendMessage || sendingMessage) {
      return;
    }

    setSendingMessage(true);
    setMessageDraft('');
    void Promise.resolve(onSendMessage(userId, displayName, text)).finally(() => {
      setSendingMessage(false);
    });
    onClose();
  };

  useEffect(() => {
    let cancelled = false;

    void loadUserProfile(userId).then((result) => {
      if (cancelled || !result.ok) {
        return;
      }

      setRawPayload(result.data);
      setProfile(normalizeContactUser(result.data));
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
          aria-label="Close"
        >
          <FiX />
        </button>

        <ProfileIdentityHeader
          displayName={displayName}
          avatarUrl={avatarUrl}
          avatarInitials={avatarInitials}
          bannerUrl={redactIdentity ? null : profile?.coverBannerUrl}
          presenceStatus={presenceStatus}
          showPresence={peerPresenceVisible}
          coverHeightClass="h-[140px]"
          size="lg"
        />

        <div className="px-6 pb-6 pt-3 text-center">
          <h2 className="text-xl font-bold text-app-text">{displayName}</h2>
          {!redactIdentity ? (
            <p className="mt-1 text-sm text-app-muted">
              {peerPresenceVisible ? presenceLabel : 'Offline'}
              {deviceLabel ? ` · ${deviceLabel}` : ''}
            </p>
          ) : null}
          {!redactIdentity && profile?.username ? (
            <p className="mt-1 text-sm text-app-muted">@{profile.username}</p>
          ) : null}
          {!redactIdentity && profile?.designation ? (
            <p className="mt-2 text-sm font-medium text-app-text">{profile.designation}</p>
          ) : null}
          {!redactIdentity && profile?.organizationName ? (
            <p className="text-sm text-app-muted">{profile.organizationName}</p>
          ) : null}
          {!redactIdentity && profile?.tagline ? (
            <p className="mt-2 text-sm italic text-app-muted">"{profile.tagline}"</p>
          ) : null}
          {!redactIdentity && profile?.email && userId !== currentUserId ? (
            <p className="mt-3 text-sm text-app-muted">{profile.email}</p>
          ) : null}

          {!isSelf && !redactIdentity ? (
            <div className="mt-5 w-full border-t border-app-border/60 pt-4">
              <div className="flex gap-2">
                <ActionTile
                  label="Audio"
                  disabled={callBusy || !onVoiceCall}
                  icon={<FiPhone className="text-lg text-[#972c44]" aria-hidden />}
                  onClick={() => {
                    if (!onVoiceCall) {
                      return;
                    }
                    onClose();
                    onVoiceCall(userId, displayName);
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
                    onVideoCall(userId, displayName);
                  }}
                />
              </div>

              <div className="mt-3">
                <label className="sr-only" htmlFor="profile-full-message">
                  Message {displayName}
                </label>
                <div className="flex items-center gap-1.5">
                  <textarea
                    id="profile-full-message"
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
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}