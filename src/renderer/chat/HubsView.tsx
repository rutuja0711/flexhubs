import type { ChannelItem, FriendItem, HubInviteItem } from '../../shared/features';
import { formatConversationTimestamp } from './format';

type HubsViewProps = {
  channels: ChannelItem[];
  invites: HubInviteItem[];
  friends: FriendItem[];
  loading: boolean;
  error: string;
  joiningChannelId: string | null;
  onRetry: () => void;
  onAcceptInvite: (inviteId: string) => void;
  onDeclineInvite: (inviteId: string) => void;
  onJoinChannel: (channelId: string) => void;
  onOpenChannel: (channelId: string) => void;
};

export function HubsView({
  channels,
  invites,
  friends,
  loading,
  error,
  joiningChannelId,
  onRetry,
  onAcceptInvite,
  onDeclineInvite,
  onJoinChannel,
  onOpenChannel,
}: HubsViewProps) {
  return (
    <div className="flex h-full flex-col bg-app-chat-bg">
      <header className="border-b border-app-border px-8 py-6">
        <h1 className="text-[1.75rem] font-bold text-app-text">Hubs & friends</h1>
        <p className="mt-1 text-sm text-app-muted">Browse hubs, manage invites, and view friends.</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4">
        {loading ? <p className="text-sm text-app-muted">Loading...</p> : null}
        {!loading && error ? (
          <div role="alert">
            <p className="mb-3 text-sm text-accent-soft">{error}</p>
            <button type="button" className="rounded-[10px] border border-app-border px-3 py-2 text-sm" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            {invites.length > 0 ? (
              <section className="mb-6">
                <h2 className="mb-3 text-sm font-semibold text-app-text">Pending hub invites</h2>
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="mb-2 flex items-center justify-between rounded-[12px] border border-accent/30 bg-accent/5 p-4"
                  >
                    <div>
                      <p className="font-medium text-app-text">{invite.channelName}</p>
                      <p className="text-sm text-app-muted">
                        Invited by {invite.invitedBy}
                        {invite.createdAt ? ` · ${formatConversationTimestamp(invite.createdAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-[10px] border border-app-border px-3 py-2 text-sm text-app-muted"
                        onClick={() => onDeclineInvite(invite.id)}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="rounded-[10px] bg-accent px-3 py-2 text-sm font-semibold text-white"
                        onClick={() => onAcceptInvite(invite.id)}
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold text-app-text">Browse hubs</h2>
              {channels.map((channel) => {
                const canJoin = !channel.isMember && Boolean(channel.pendingInviteId);
                const isJoining = joiningChannelId === channel.id;

                return (
                  <div
                    key={channel.id}
                    className="mb-2 flex items-center justify-between gap-4 rounded-[12px] border border-app-border bg-app-surface p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-app-text">{channel.name}</p>
                      {channel.description ? (
                        <p className="text-sm text-app-muted">{channel.description}</p>
                      ) : null}
                      {!channel.isMember && !channel.pendingInviteId ? (
                        <p className="text-xs text-app-muted">You need an invite to join this hub</p>
                      ) : null}
                      {!channel.isMember && channel.pendingInviteId ? (
                        <p className="text-xs text-accent-soft">You have a pending invite</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-app-muted">{channel.memberCount} members</span>
                      {channel.isMember ? (
                        <button
                          type="button"
                          className="rounded-[10px] bg-accent px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => onOpenChannel(channel.id)}
                        >
                          Open
                        </button>
                      ) : canJoin ? (
                        <button
                          type="button"
                          disabled={isJoining}
                          className="rounded-[10px] bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          onClick={() => onJoinChannel(channel.id)}
                        >
                          {isJoining ? 'Joining...' : 'Join'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {channels.length === 0 ? <p className="text-sm text-app-muted">No hubs found.</p> : null}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-app-text">Friends</h2>
              {friends.map((friend) => (
                <div key={friend.id} className="mb-2 rounded-[12px] border border-app-border p-4">
                  <p className="font-medium text-app-text">{friend.name}</p>
                  {friend.username ? <p className="text-sm text-app-muted">@{friend.username}</p> : null}
                </div>
              ))}
              {friends.length === 0 ? <p className="text-sm text-app-muted">No friends yet.</p> : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
