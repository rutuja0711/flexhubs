import type { PresenceStatus } from '../../shared/chat';
import { UserProfileFullModal } from './UserProfileFullModal';
import { UserProfilePopup, type UserProfileAnchor } from './UserProfilePopup';

export type UserProfileOverlayState =
  | {
      mode: 'popup';
      anchor: UserProfileAnchor;
      position: { top: number; left: number };
      contextTitle?: string;
    }
  | {
      mode: 'full';
      anchor: UserProfileAnchor;
    }
  | null;

type UserProfileOverlayHostProps = {
  state: UserProfileOverlayState;
  onClose: () => void;
  currentUserId: string | null;
  presenceByUserId?: ReadonlyMap<string, PresenceStatus>;
  viewerSharePresence?: boolean;
  blockedUserIds?: ReadonlySet<string>;
  blockedByPeerIds?: ReadonlySet<string>;
  callBusy?: boolean;
  onSendMessage?: (userId: string, displayName: string, text: string) => void | Promise<void>;
  onVoiceCall?: (userId: string, displayName: string) => void;
  onVideoCall?: (userId: string, displayName: string) => void;
  onRefreshPresence?: (userId: string) => void;
  onViewFullProfile?: (anchor: UserProfileAnchor) => void;
};

export function UserProfileOverlayHost({
  state,
  onClose,
  currentUserId,
  presenceByUserId,
  viewerSharePresence,
  blockedUserIds,
  blockedByPeerIds,
  callBusy,
  onSendMessage,
  onVoiceCall,
  onVideoCall,
  onRefreshPresence,
  onViewFullProfile,
}: UserProfileOverlayHostProps) {
  if (!state) {
    return null;
  }

  if (state.mode === 'full') {
    return (
      <UserProfileFullModal
        userId={state.anchor.userId}
        displayName={state.anchor.displayName}
        avatarUrl={state.anchor.avatarUrl}
        avatarInitials={state.anchor.avatarInitials}
        currentUserId={currentUserId}
        presenceByUserId={presenceByUserId}
        viewerSharePresence={viewerSharePresence}
        blockedUserIds={blockedUserIds}
        blockedByPeerIds={blockedByPeerIds}
        onClose={onClose}
        onSendMessage={onSendMessage}
        onVoiceCall={onVoiceCall}
        onVideoCall={onVideoCall}
        callBusy={callBusy}
      />
    );
  }

  return (
    <UserProfilePopup
      anchor={state.anchor}
      position={state.position}
      onClose={onClose}
      contextTitle={state.contextTitle}
      currentUserId={currentUserId}
      presenceByUserId={presenceByUserId}
      viewerSharePresence={viewerSharePresence}
      blockedUserIds={blockedUserIds}
      blockedByPeerIds={blockedByPeerIds}
      callBusy={callBusy}
      onSendMessage={onSendMessage}
      onVoiceCall={onVoiceCall}
      onVideoCall={onVideoCall}
      onRefreshPresence={onRefreshPresence}
      onViewProfile={(userId, displayName) => {
        onViewFullProfile?.({
          userId,
          displayName,
          avatarUrl: state.anchor.avatarUrl,
          avatarInitials: state.anchor.avatarInitials,
        });
      }}
    />
  );
}