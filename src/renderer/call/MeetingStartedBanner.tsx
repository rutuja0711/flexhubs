import { FiVideo, FiX } from 'react-icons/fi';
import type { MeetingStartedPayload } from '../../shared/calls';

type MeetingStartedBannerProps = {
  meeting: MeetingStartedPayload;
  onJoin: () => void;
  onDismiss: () => void;
};

export function MeetingStartedBanner({ meeting, onJoin, onDismiss }: MeetingStartedBannerProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9998] flex justify-end px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-4 sm:pb-3 sm:pt-[max(1rem,env(safe-area-inset-top,0px))]">
      <div
        className="pointer-events-auto w-full max-w-[min(100%,22rem)] overflow-hidden rounded-2xl border border-app-border bg-app-elevated shadow-app animate-in slide-in-from-top-2 fade-in duration-200"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-soft">
            <FiVideo className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-sm font-semibold text-app-text">
              {meeting.startedBy.username} started a {meeting.video ? 'video' : 'voice'} meeting
            </p>
            <p className="mt-0.5 truncate text-xs text-app-muted">{meeting.conversationTitle}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss meeting invite"
            className="shrink-0 rounded-lg p-1.5 text-app-muted hover:bg-app-chat-hover hover:text-app-text"
            onClick={onDismiss}
          >
            <FiX className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-app-border px-3 py-2.5 sm:px-4">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
            onClick={onJoin}
          >
            Join
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-border px-3 py-2 text-xs font-semibold text-app-text hover:bg-app-chat-hover"
            onClick={onDismiss}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
