import { useState } from 'react';
import { FiMessageSquare, FiUserPlus } from 'react-icons/fi';
import { shouldRedactUserIdentity } from '../../shared/blocking';
import type { TeammateItem } from '../../shared/messages';
import { Avatar } from './ChatIcons';

type TeammatesSectionProps = {
  teammates: TeammateItem[];
  openingTeammateId?: string | null;
  blockedUserIds?: ReadonlySet<string>;
  blockedByPeerIds?: ReadonlySet<string>;
  onSelect: (memberId: string) => void;
  onAddFriend: (memberId: string) => Promise<void>;
};

export function TeammatesSection({
  teammates,
  openingTeammateId = null,
  blockedUserIds,
  blockedByPeerIds,
  onSelect,
  onAddFriend,
}: TeammatesSectionProps) {
  const blockedUsers = blockedUserIds ?? new Set<string>();
  const blockedByPeers = blockedByPeerIds ?? new Set<string>();
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null);

  if (teammates.length === 0) {
    return null;
  }

  const handleAddFriend = async (memberId: string) => {
    if (pendingFriendId) {
      return;
    }

    setPendingFriendId(memberId);

    try {
      await onAddFriend(memberId);
    } catch {
      // Parent shows error toast.
    } finally {
      setPendingFriendId(null);
    }
  };

  return (
    <div className="border-t border-app-border/40 px-3 py-3.5">
      <p className="mb-2 px-2 text-[0.6875rem] font-semibold tracking-wider text-app-muted/75 uppercase">
        Start a chat with a teammate
      </p>
      <div className="flex flex-col gap-0.5 pb-2">
        {teammates.map((teammate) => {
          const isOpening = openingTeammateId === teammate.id;
          const isSendingFriendRequest = pendingFriendId === teammate.id;
          const redactIdentity = shouldRedactUserIdentity(
            teammate.id,
            blockedUsers,
            blockedByPeers,
          );

          return (
            <div
              key={teammate.id}
              className={`flex items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2 transition-all duration-200 ${
                isOpening ? 'border-app-border/50 bg-app-chat-hover' : 'hover:bg-app-chat-hover/70 hover:border-app-border/40'
              }`}
            >
              <Avatar
                imageUrl={redactIdentity ? null : teammate.avatarUrl}
                initials={teammate.initials}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-app-text">{teammate.name}</p>
                {isOpening ? (
                  <p className="mt-0.5 truncate text-[11px] text-accent-soft">Opening chat...</p>
                ) : !redactIdentity && teammate.statusMessage ? (
                  <p className="mt-0.5 truncate text-[11px] text-app-muted">{teammate.statusMessage}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`Add ${teammate.name} as friend`}
                  title="Add friend"
                  disabled={isSendingFriendRequest}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-accent transition-colors hover:bg-accent/10 disabled:cursor-wait disabled:opacity-60"
                  onClick={() => {
                    void handleAddFriend(teammate.id);
                  }}
                >
                  <FiUserPlus className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Message ${teammate.name}`}
                  title="Message"
                  disabled={isOpening}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text disabled:cursor-wait disabled:opacity-60"
                  onClick={() => onSelect(teammate.id)}
                >
                  <FiMessageSquare className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
