import type { MessagePoll } from '../../shared/messages';

type PollMessageProps = {
  poll: MessagePoll;
  disabled?: boolean;
  onVote?: (optionId: string) => void;
};

export function PollMessage({ poll, disabled = false, onVote }: PollMessageProps) {
  const totalVotes = poll.totalVotes || poll.options.reduce((sum, option) => sum + option.voteCount, 0);
  const userVoted = poll.options.some((option) => option.votedByMe);
  const singleChoiceLocked = !poll.allowMultiple && userVoted;

  return (
    <div className="min-w-[220px] space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-app-muted">Poll</p>
        <p className="mt-1 text-sm font-semibold text-inherit">{poll.question}</p>
        <p className="mt-1 text-xs text-app-muted">
          {poll.allowMultiple ? 'Select one or more options' : 'Select one option'}
          {totalVotes > 0 ? ` · ${totalVotes} vote${totalVotes === 1 ? '' : 's'}` : ''}
        </p>
      </div>

      <div className="space-y-2">
        {poll.options.length === 0 ? (
          <p className="rounded-xl border border-dashed border-app-border/60 px-3 py-2 text-sm text-app-muted">
            Poll options are loading...
          </p>
        ) : (
          poll.options.map((option) => {
          const percent = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
          const isInteractive = !disabled && Boolean(onVote) && !singleChoiceLocked;

          return (
            <button
              key={option.id}
              type="button"
              disabled={!isInteractive}
              className={[
                'relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors duration-150',
                'outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                isInteractive ? 'cursor-pointer' : 'cursor-default',
                option.votedByMe
                  ? 'border-accent bg-accent/10'
                  : [
                      'border-app-border/60 bg-black/10',
                      isInteractive
                        ? 'active:bg-black/20 [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent/40 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-black/15'
                        : '',
                    ].join(' '),
              ].join(' ')}
              onClick={(event) => {
                onVote?.(option.id);
                event.currentTarget.blur();
              }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-accent/15 transition-all"
                style={{ width: `${percent}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{option.text}</span>
                <span className="shrink-0 text-xs text-app-muted">
                  {option.voteCount > 0 ? `${option.voteCount} · ${percent}%` : '0%'}
                </span>
              </div>
            </button>
          );
        })
        )}
      </div>
    </div>
  );
}
