import { FiUserPlus } from 'react-icons/fi';
import type { HubMemberSummary } from './hubMemberUtils';

export type MeetingParticipantRow = {
  identity: string;
  userId: string;
  label: string;
  avatarUrl: string | null;
  isLocal?: boolean;
};

type MeetingParticipantsSidebarProps = {
  inCall: MeetingParticipantRow[];
  hubMembersNotInCall: HubMemberSummary[];
  hubMembersLoading?: boolean;
  declinedUserIds: ReadonlySet<string>;
  invitedUserIds: ReadonlySet<string>;
  canInvite: boolean;
  inviteBusyUserId: string | null;
  onInvite: (userId: string) => void;
};

function AvatarBubble({
  label,
  avatarUrl,
  size = 'md',
}: {
  label: string;
  avatarUrl: string | null;
  size?: 'md' | 'sm';
}) {
  const initial = label.trim().slice(0, 1).toUpperCase() || '?';
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm';

  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt="" className={`${sizeClass} shrink-0 rounded-full object-cover`} />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-accent/15 font-semibold text-accent-soft`}
    >
      {initial}
    </div>
  );
}

function ParticipantListItem({ row }: { row: MeetingParticipantRow }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2">
      <AvatarBubble label={row.label} avatarUrl={row.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {row.isLocal ? 'You' : row.label}
        </p>
        <p className="text-xs text-white/45">In call</p>
      </div>
    </li>
  );
}

export function MeetingParticipantsSidebar({
  inCall,
  hubMembersNotInCall,
  hubMembersLoading = false,
  declinedUserIds,
  invitedUserIds,
  canInvite,
  inviteBusyUserId,
  onInvite,
}: MeetingParticipantsSidebarProps) {
  return (
    <aside className="flex h-full w-[min(100%,320px)] shrink-0 flex-col border-l border-white/10 bg-[#0b0c10]">
      <div className="border-b border-white/10 px-4 py-4">
        <h2 className="text-sm font-semibold text-white">Participants</h2>
        <p className="mt-0.5 text-xs text-white/45">{inCall.length} in call</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-white/35">
          In call
        </p>
        {inCall.length === 0 ? (
          <p className="px-2 text-sm text-white/45">No one else has joined yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {inCall.map((row) => (
              <ParticipantListItem key={row.identity} row={row} />
            ))}
          </ul>
        )}

        {canInvite || hubMembersNotInCall.length > 0 || hubMembersLoading ? (
          <>
            <p className="mt-5 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-white/35">
              Hub members not in call
            </p>
            {hubMembersLoading && hubMembersNotInCall.length === 0 ? (
              <p className="px-2 text-sm text-white/45">Loading hub members…</p>
            ) : null}
            {!hubMembersLoading && hubMembersNotInCall.length === 0 ? (
              <p className="px-2 text-sm text-white/45">
                {canInvite
                  ? 'Everyone in this hub is in the call.'
                  : 'No other hub members to show.'}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {hubMembersNotInCall.map((member) => {
                const declined = declinedUserIds.has(member.id);
                const invited = invitedUserIds.has(member.id);
                const busy = inviteBusyUserId === member.id;

                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]"
                  >
                    <AvatarBubble label={member.name} avatarUrl={member.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{member.name}</p>
                      {declined ? (
                        <p className="text-xs text-white/40">Declined</p>
                      ) : invited ? (
                        <p className="text-xs text-white/40">Invited</p>
                      ) : null}
                    </div>
                    {canInvite && !declined ? (
                      <button
                        type="button"
                        disabled={busy || invited}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/15 disabled:cursor-default disabled:opacity-50"
                        onClick={() => onInvite(member.id)}
                      >
                        <FiUserPlus className="text-sm" aria-hidden="true" />
                        {busy ? '…' : invited ? 'Invited' : 'Invite'}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
    </aside>
  );
}
