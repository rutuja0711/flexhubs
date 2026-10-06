import { FiX } from 'react-icons/fi';
import type { MeetingStartedPayload } from '../../shared/calls';

type MeetingStartedBannerProps = {
  meeting: MeetingStartedPayload;
  onJoin: () => void;
  onDismiss: () => void;
};

export function MeetingStartedBanner({ meeting, onJoin, onDismiss }: MeetingStartedBannerProps) {
  return (
    <div
      className="shrink-0 border-b border-app-border bg-app-elevated/95 px-4 py-2.5 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-app-text">
            {meeting.startedBy.username} started a {meeting.video ? 'video' : 'voice'} meeting
          </p>
          <p className="truncate text-xs text-app-muted">{meeting.conversationTitle}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 sm:py-2 sm:text-sm"
          onClick={onJoin}
        >
          Join
        </button>
        <button
          type="button"
          className="shrink-0 rounded-xl border border-app-border px-2.5 py-1.5 text-xs font-semibold text-app-text hover:bg-app-chat-hover sm:px-3 sm:py-2 sm:text-sm"
          onClick={onDismiss}
        >
          Decline
        </button>
        <button
          type="button"
          aria-label="Dismiss meeting invite"
          className="shrink-0 rounded-lg p-2 text-app-muted hover:bg-app-chat-hover hover:text-app-text"
          onClick={onDismiss}
        >
          <FiX aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
