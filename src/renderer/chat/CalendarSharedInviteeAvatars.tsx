import type { CalendarEventInvitee } from '../../shared/extras';
import { Avatar } from './ChatIcons';

export function formatInviteeResponseStatus(status: string | null | undefined): string {
  const normalized = (status ?? 'PENDING').toUpperCase();
  if (normalized === 'ACCEPTED') {
    return 'Accepted';
  }
  if (normalized === 'DECLINED' || normalized === 'REJECTED') {
    return 'Declined';
  }
  return 'Pending';
}

function initialsFromInvitee(invitee: Pick<CalendarEventInvitee, 'name' | 'username'>): string {
  const label = invitee.name?.trim() || invitee.username?.trim() || '?';
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

type CalendarSharedInviteeAvatarsProps = {
  invitees: CalendarEventInvitee[];
  onItemClick?: (event: React.MouseEvent) => void;
};

export function CalendarSharedInviteeAvatars({
  invitees,
  onItemClick,
}: CalendarSharedInviteeAvatarsProps) {
  if (!invitees.length) {
    return null;
  }

  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {invitees.map((invitee, index) => (
        <li key={invitee.userId ?? invitee.username ?? `invite-${index}`}>
          <span className="group/invitee relative inline-flex" onClick={onItemClick}>
            <Avatar
              imageUrl={invitee.avatarUrl ?? null}
              initials={initialsFromInvitee(invitee)}
              size="xs"
            />
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-app-border bg-app-elevated px-2 py-1 text-[10px] font-semibold text-app-text opacity-0 shadow-lg transition-opacity group-hover/invitee:opacity-100"
            >
              {formatInviteeResponseStatus(invitee.status)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
