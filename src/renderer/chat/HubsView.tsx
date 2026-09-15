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
      <header className="border-b border-app-border/50 px-8 py-6 bg-app-surface/50 backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-app-text tracking-tight">Hubs & Friends</h1>
        <p className="mt-1 text-xs text-app-muted">Browse hubs, manage pending invites, and connect with friends.</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-5 max-w-4xl">
        {loading ? <p className="text-sm text-app-muted">Loading...</p> : null}
        {!loading && error ? (
          <div role="alert" className="rounded-2xl border border-app-border/70 bg-app-card/60 p-6 text-center">
            <p className="mb-3 text-sm text-accent-soft">{error}</p>
            <button type="button" className="rounded-xl border border-app-border bg-app-surface px-4 py-2 text-xs font-semibold text-app-text hover:bg-app-chat-hover transition-colors" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            {invites.length > 0 ? (
              <section className="mb-7">
                <h2 className="mb-3 text-xs font-semibold tracking-wider text-app-muted uppercase">Pending hub invites</h2>
                <div className="space-y-2.5">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-2xl border border-accent/40 bg-accent/10 p-4 shadow-xs"
                    >
                      <div>
                        <p className="font-semibold text-app-text text-sm">{invite.channelName}</p>
                        <p className="text-xs text-app-muted mt-0.5">
                          Invited by <span className="text-app-text">{invite.invitedBy}</span>
                          {invite.createdAt ? ` · ${formatConversationTimestamp(invite.createdAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-app-border bg-app-card/80 px-3.5 py-1.5 text-xs font-medium text-app-muted hover:text-app-text hover:bg-app-inset transition-colors"
                          onClick={() => onDeclineInvite(invite.id)}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-accent-hover"
                          onClick={() => onAcceptInvite(invite.id)}
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mb-7">
              <h2 className="mb-3 text-xs font-semibold tracking-wider text-app-muted uppercase">Browse hubs</h2>
              <div className="space-y-2.5">
                {channels.map((channel) => {
                  const canJoin = !channel.isMember && Boolean(channel.pendingInviteId);
                  const isJoining = joiningChannelId === channel.id;

                  return (
                    <div
                      key={channel.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-app-border/60 bg-app-card/60 p-4 transition-all hover:bg-app-card hover:border-app-border hover:shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-app-text text-sm tracking-tight">{channel.name}</p>
                        {channel.description ? (
                          <p className="text-xs text-app-muted mt-0.5">{channel.description}</p>
                        ) : null}
                        {!channel.isMember && !channel.pendingInviteId ? (
                          <p className="text-[11px] text-app-muted mt-1">Invite-only hub</p>
                        ) : null}
                        {!channel.isMember && channel.pendingInviteId ? (
                          <p className="text-[11px] text-accent-soft font-medium mt-1">Pending invite available</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-app-muted">{channel.memberCount} members</span>
                        {channel.isMember ? (
                          <button
                            type="button"
                            className="rounded-xl bg-gradient-to-r from-accent to-[#632a38] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:brightness-110 active:scale-[0.98] transition-all"
                            onClick={() => onOpenChannel(channel.id)}
                          >
                            Open
                          </button>
                        ) : canJoin ? (
                          <button
                            type="button"
                            disabled={isJoining}
                            className="rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 transition-all"
                            onClick={() => onJoinChannel(channel.id)}
                          >
                            {isJoining ? 'Joining...' : 'Join'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              {channels.length === 0 ? <p className="text-xs text-app-muted py-4">No hubs found.</p> : null}
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold tracking-wider text-app-muted uppercase">Friends</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {friends.map((friend) => (
                  <div key={friend.id} className="rounded-2xl border border-app-border/60 bg-app-card/50 p-3.5 transition-colors hover:bg-app-card">
                    <p className="font-semibold text-app-text text-sm">{friend.name}</p>
                    {friend.username ? <p className="text-xs text-app-muted">@{friend.username}</p> : null}
                  </div>
                ))}
              </div>
              {friends.length === 0 ? <p className="text-xs text-app-muted py-4">No friends yet.</p> : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
