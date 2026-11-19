import { buildTypingIndicatorPhrase } from '../../shared/realtime';
import type { ChatTypingParticipant } from '../features/chat/lib/chatPageHelpers';
import { Avatar } from './ChatIcons';

const MAX_TYPING_AVATARS = 3;

function TypingDots({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const dotClass = compact ? 'h-[4px] w-[4px]' : 'h-[5px] w-[5px]';

  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`.trim()} aria-hidden="true">
      <span
        className={`${dotClass} animate-bounce rounded-full bg-accent/90 [animation-delay:-0.2s]`}
      />
      <span
        className={`${dotClass} animate-bounce rounded-full bg-accent/90 [animation-delay:-0.1s]`}
      />
      <span className={`${dotClass} animate-bounce rounded-full bg-accent/90`} />
    </span>
  );
}

type ChatTypingIndicatorProps = {
  participants: ChatTypingParticipant[];
  className?: string;
  /** Compact row style for conversation sidebar; default is in-thread. */
  variant?: 'thread' | 'sidebar';
};

export function ChatTypingIndicator({
  participants,
  className = '',
  variant = 'thread',
}: ChatTypingIndicatorProps) {
  if (participants.length === 0) {
    return null;
  }

  const accessibleLabel = `${buildTypingIndicatorPhrase(
    participants.map((person) => person.displayName),
  )}...`;
  const avatarParticipants = participants.slice(0, MAX_TYPING_AVATARS);
  const sidebar = variant === 'sidebar';
  const typingText = participants.length === 1 ? 'is typing' : 'are typing';

  return (
    <div
      className={`max-w-full items-center ${
        sidebar ? 'mt-0.5 flex w-full gap-2 py-0.5' : 'inline-flex gap-2.5 py-1'
      } ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={accessibleLabel}
    >
      <div className={`flex shrink-0 items-center ${sidebar ? 'gap-1' : 'gap-1.5'}`}>
        {avatarParticipants.map((person) => (
          <Avatar
            key={person.userId}
            imageUrl={person.avatarUrl}
            initials={person.avatarInitials}
            size={sidebar ? 'xs' : 'sm'}
            loading="eager"
          />
        ))}
      </div>
      <p
        className={`min-w-0 leading-snug text-app-muted ${sidebar ? 'truncate text-[11px]' : 'text-sm'}`}
      >
        <span className="text-app-text/85">{typingText}</span>
        <TypingDots className="ml-1 align-middle" compact={sidebar} />
      </p>
    </div>
  );
}