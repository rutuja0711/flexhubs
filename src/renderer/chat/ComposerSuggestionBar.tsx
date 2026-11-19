import type { ChatTypingParticipant } from '../features/chat/lib/chatPageHelpers';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import { QuickReplySuggestions } from './QuickReplySuggestions.tsx';

type ComposerSuggestionBarProps = {
  typingParticipants?: ChatTypingParticipant[];
  suggestions?: string[];
  onSelectSuggestion: (text: string) => void;
  /** Same as message hover “Reply with AI” on the latest incoming message. */
  onAiReply?: () => void;
  aiReplyLoading?: boolean;
  className?: string;
};

export function ComposerSuggestionBar({
  typingParticipants = [],
  suggestions = [],
  onSelectSuggestion,
  onAiReply,
  aiReplyLoading = false,
  className = '',
}: ComposerSuggestionBarProps) {
  const showTyping = typingParticipants.length > 0;
  const showSuggestions = suggestions.length > 0;
  const showAiReply = Boolean(onAiReply);

  if (!showTyping && !showSuggestions && !showAiReply) {
    return null;
  }

  return (
    <div
      className={`flex min-h-9 items-center gap-3 px-6 pb-0.5 pt-1 ${className}`.trim()}
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        {showTyping ? <ChatTypingIndicator participants={typingParticipants} className="py-0" /> : null}
      </div>
      {showSuggestions || showAiReply ? (
        <QuickReplySuggestions
          layout="inline"
          suggestions={showSuggestions ? suggestions : []}
          onSelect={onSelectSuggestion}
          onAiReply={onAiReply}
          aiReplyLoading={aiReplyLoading}
        />
      ) : null}
    </div>
  );
}