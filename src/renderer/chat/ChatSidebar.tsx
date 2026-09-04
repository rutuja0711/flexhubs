import { useEffect, useMemo, useState } from 'react';
import type { ConversationItem, ConversationKind } from '../../shared/chat';
import type { TeammateItem } from '../../shared/messages';
import type { GlobalSearchResult, SearchPerson } from '../../shared/search';
import { validateSearchQuery } from '../../shared/chat';
import { validateSearchInput } from '../../shared/search';
import { loadGlobalSearch } from '../chatApi';
import { BellIcon, PlusIcon } from './ChatIcons';
import { ConversationList } from './ConversationList';
import { GlobalSearchResults } from './GlobalSearchResults';
import { NewConversationModal } from './NewConversationModal';
import { NotificationsPanel } from './NotificationsPanel';
import { SearchField } from './SearchField';
import { TeammatesSection } from './TeammatesSection';

type ChatTab = ConversationKind;

type ChatSidebarProps = {
  workspaceName: string;
  selfLabel: string;
  conversations: ConversationItem[];
  teammates: TeammateItem[];
  unreadCount: number;
  loading: boolean;
  error: string;
  selectedId: string | null;
  notificationsOpen: boolean;
  notificationsLoading: boolean;
  notificationsError: string;
  panelNotifications: import('../../shared/messages').NotificationItem[];
  panelPendingFriends: import('../../shared/messages').PendingFriendItem[];
  onSelect: (id: string) => void;
  onRetry: () => void;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onTeammateSelect: (memberId: string) => void;
  onSelectPerson: (person: SearchPerson) => void;
  onMessageSelf: () => void;
  onNotificationClick: (notification: import('../../shared/messages').NotificationItem) => void;
  newConversationOpen: boolean;
  onNewConversationOpenChange: (open: boolean) => void;
  onMessageUser: (userId: string) => void;
};

export function ChatSidebar({
  workspaceName,
  selfLabel,
  conversations,
  teammates,
  unreadCount,
  loading,
  error,
  selectedId,
  notificationsOpen,
  notificationsLoading,
  notificationsError,
  panelNotifications,
  panelPendingFriends,
  onSelect,
  onRetry,
  onToggleNotifications,
  onCloseNotifications,
  onTeammateSelect,
  onSelectPerson,
  onMessageSelf,
  onNotificationClick,
  newConversationOpen,
  onNewConversationOpenChange,
  onMessageUser,
}: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<ChatTab>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState('');
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult | null>(null);

  const isGlobalSearch = useMemo(() => {
    const validation = validateSearchInput(searchQuery);
    return validation.ok && validation.value.length >= 2;
  }, [searchQuery]);

  useEffect(() => {
    if (!isGlobalSearch) {
      setGlobalResults(null);
      setGlobalSearchError('');
      setGlobalSearchLoading(false);
      return;
    }

    const validation = validateSearchInput(searchQuery);

    if (!validation.ok) {
      return;
    }

    setGlobalSearchLoading(true);
    setGlobalSearchError('');

    const timer = window.setTimeout(() => {
      void loadGlobalSearch(validation.value).then((response) => {
        setGlobalSearchLoading(false);

        if (!response.ok) {
          setGlobalSearchError(response.error);
          setGlobalResults(null);
          return;
        }

        setGlobalResults(response.data);
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isGlobalSearch, searchQuery]);

  const filteredConversations = useMemo(() => {
    if (isGlobalSearch) {
      return [];
    }

    const tabItems = conversations.filter((conversation) => conversation.kind === activeTab);
    const validation = validateSearchQuery(searchQuery);

    if (!validation.ok || !validation.value) {
      return tabItems;
    }

    const query = validation.value.toLowerCase();

    return tabItems.filter((conversation) => {
      const haystack = `${conversation.title} ${conversation.subtitle}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeTab, conversations, isGlobalSearch, searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (!value.trim()) {
      setSearchError('');
      return;
    }

    const validation = validateSearchInput(value);
    setSearchError(validation.ok ? '' : validation.error);
  };

  const emptyMessage =
    activeTab === 'direct'
      ? searchQuery.trim()
        ? 'No direct messages match your search.'
        : 'No direct messages yet.'
      : searchQuery.trim()
        ? 'No hubs match your search.'
        : 'No hubs yet.';

  return (
    <aside className="relative flex w-[320px] shrink-0 flex-col border-r border-app-border bg-app-chat-sidebar">
      <div className="border-b border-app-border px-4 py-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[0.9375rem] font-semibold text-app-text">{workspaceName}</h1>
            <p className="text-xs text-app-muted">Workspace</p>
          </div>
          <button
            type="button"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={notificationsOpen}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
            onClick={onToggleNotifications}
          >
            <BellIcon />
            {unreadCount > 0 ? (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <SearchField
            value={searchQuery}
            placeholder="Search people & chats"
            error={searchError}
            variant="sidebar"
            onChange={handleSearchChange}
          />
          <button
            type="button"
            aria-label="New conversation"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-accent text-white transition-colors hover:bg-accent-hover active:bg-accent-active"
            onClick={() => onNewConversationOpenChange(true)}
          >
            <PlusIcon />
          </button>
        </div>
        {searchError ? (
          <p className="mt-2 text-xs text-accent-soft" role="alert">
            {searchError}
          </p>
        ) : null}
      </div>

      {!isGlobalSearch ? (
        <div className="border-b border-app-border px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-app-text">Chats</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'direct'
                  ? 'border border-accent text-accent-soft'
                  : 'text-app-muted hover:bg-app-chat-hover hover:text-app-text'
              }`}
              onClick={() => setActiveTab('direct')}
            >
              Direct messages
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'hub'
                  ? 'border border-accent text-accent-soft'
                  : 'text-app-muted hover:bg-app-chat-hover hover:text-app-text'
              }`}
              onClick={() => setActiveTab('hub')}
            >
              Hubs
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-app-muted" role="status">
            Loading conversations...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="px-4 py-6" role="alert">
            <p className="mb-3 text-sm leading-snug text-accent-soft">{error}</p>
            <button
              type="button"
              className="rounded-[10px] border border-app-border bg-app-surface px-3 py-2 text-sm font-medium text-app-text transition-colors hover:border-app-border-strong"
              onClick={onRetry}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && isGlobalSearch ? (
          globalSearchLoading ? (
            <p className="px-4 py-8 text-center text-sm text-app-muted" role="status">
              Searching...
            </p>
          ) : globalSearchError ? (
            <p className="px-4 py-6 text-sm text-accent-soft" role="alert">
              {globalSearchError}
            </p>
          ) : globalResults ? (
            <GlobalSearchResults
              results={globalResults}
              onSelectPerson={onSelectPerson}
              onSelectChat={onSelect}
            />
          ) : null
        ) : null}

        {!loading && !error && !isGlobalSearch ? (
          <ConversationList
            conversations={filteredConversations}
            selectedId={selectedId}
            onSelect={onSelect}
            emptyMessage={emptyMessage}
          />
        ) : null}
      </div>

      {!isGlobalSearch ? <TeammatesSection teammates={teammates} onSelect={onTeammateSelect} /> : null}

      {notificationsOpen ? (
        <NotificationsPanel
          notifications={panelNotifications}
          pendingFriends={panelPendingFriends}
          loading={notificationsLoading}
          error={notificationsError}
          onClose={onCloseNotifications}
          onNotificationClick={onNotificationClick}
        />
      ) : null}

      {newConversationOpen ? (
        <NewConversationModal
          selfLabel={selfLabel}
          onClose={() => onNewConversationOpenChange(false)}
          onMessageSelf={() => {
            onNewConversationOpenChange(false);
            onMessageSelf();
          }}
          onMessageUser={(userId) => {
            onNewConversationOpenChange(false);
            onMessageUser(userId);
          }}
        />
      ) : null}
    </aside>
  );
}
