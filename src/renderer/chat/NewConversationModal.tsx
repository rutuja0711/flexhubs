import { useEffect, useState } from 'react';
import type { SearchPerson } from '../../shared/search';
import { validateSearchInput } from '../../shared/search';
import { loadUserSearch, sendFriendRequest } from '../chatApi';
import { Avatar } from './ChatIcons';
import { SearchField } from './SearchField';

type NewConversationModalProps = {
  selfLabel: string;
  onClose: () => void;
  onMessageUser: (userId: string) => void;
  onMessageSelf: () => void;
};

export function NewConversationModal({
  selfLabel,
  onClose,
  onMessageUser,
  onMessageSelf,
}: NewConversationModalProps) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [username, setUsername] = useState('');
  const [searchError, setSearchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchPerson | null>(null);

  useEffect(() => {
    if (mode !== 'direct') {
      return;
    }

    const validation = validateSearchInput(username);

    if (!validation.ok) {
      setSearchError(validation.error);
      setResult(null);
      return;
    }

    if (!validation.value) {
      setSearchError('');
      setResult(null);
      return;
    }

    setSearchError('');
    setLoading(true);

    const timer = window.setTimeout(() => {
      loadUserSearch(validation.value).then((response) => {
        setLoading(false);

        if (!response.ok) {
          setActionError(response.error);
          setResult(null);
          return;
        }

        setActionError('');
        setResult(response.data[0] ?? null);
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [mode, username]);

  return (
    <>
      <button
        type="button"
        aria-label="Close new conversation"
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-app-border bg-app-surface p-6 shadow-app">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-app-text">New conversation</h2>
            <p className="text-sm text-app-muted">Find someone by their exact username</p>
          </div>
          <button type="button" className="text-app-muted hover:text-app-text" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-[10px] border px-3 py-2 text-sm ${
              mode === 'direct' ? 'border-app-border-strong bg-app-chat-hover text-app-text' : 'border-app-border text-app-muted'
            }`}
            onClick={() => setMode('direct')}
          >
            Direct
          </button>
          <button
            type="button"
            className={`flex-1 rounded-[10px] border px-3 py-2 text-sm ${
              mode === 'group' ? 'border-app-border-strong bg-app-chat-hover text-app-text' : 'border-app-border text-app-muted'
            }`}
            onClick={() => setMode('group')}
          >
            Group
          </button>
        </div>

        {mode === 'direct' ? (
          <>
            <button
              type="button"
              className="mb-4 flex w-full items-center gap-3 rounded-[12px] border border-app-border bg-app-chat-panel px-4 py-3 text-left"
              onClick={onMessageSelf}
            >
              <span className="text-accent-soft">★</span>
              <span>
                <span className="block text-sm font-medium text-app-text">{selfLabel}</span>
                <span className="text-xs text-app-muted">Message yourself</span>
              </span>
            </button>

            <p className="mb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
              Username
            </p>
            <SearchField
              value={username}
              placeholder="Enter username..."
              error={searchError}
              variant="modal"
              onChange={setUsername}
            />
            <p className="mt-2 text-xs text-app-muted">
              Users are not listed. Enter an exact username to start a conversation.
            </p>

            {loading ? <p className="mt-4 text-sm text-app-muted">Searching...</p> : null}

            {result ? (
              <div className="mt-4 rounded-[12px] border border-app-border p-4">
                <div className="mb-4 flex items-center gap-3">
                  <Avatar imageUrl={result.avatarUrl} initials={result.initials} />
                  <div>
                    <p className="font-medium text-app-text">{result.name}</p>
                    <p className="text-sm text-app-muted">{result.status ?? 'Online'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => onMessageUser(result.id)}
                  >
                    Message
                  </button>
                  <button
                    type="button"
                    className="rounded-[10px] border border-app-border px-4 py-2 text-sm text-accent-soft"
                    onClick={() => {
                      void sendFriendRequest(result.id).then((response) => {
                        setActionError(response.ok ? '' : response.error);
                      });
                    }}
                  >
                    Friends
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-app-muted">
            Group creation uses teammate search on the web app for now.
          </p>
        )}

        {actionError ? (
          <p className="mt-3 text-sm text-accent-soft" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
    </>
  );
}
