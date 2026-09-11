import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationItem, ConversationKind, DirectChatMetadata } from '../../shared/chat';
import type { TeammateItem } from '../../shared/messages';
import type { GlobalSearchResult, SearchPerson } from '../../shared/search';
import { validateSearchQuery, filterTeammatesWithoutDirectChat } from '../../shared/chat';
import { validateSearchInput } from '../../shared/search';
import { loadGlobalSearch } from '../chatApi';
import { BellIcon, NotificationBadge, PlusIcon } from './ChatIcons';
import { ConversationList } from './ConversationList';
import { GlobalSearchResults } from './GlobalSearchResults';
import { NewConversationModal } from './NewConversationModal';
import { NotificationsPanel } from './NotificationsPanel';
import { SearchField } from './SearchField';
import { TeammatesSection } from './TeammatesSection';
import { FiSettings, FiBox } from 'react-icons/fi';

type ChatTab = 'all' | ConversationKind;

type ChatSidebarProps = {
  workspaceName: string;
  selfLabel: string;
  conversations: ConversationItem[];
  typingPreviews?: Record<string, string>;
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
  onPrefetch?: (id: string) => void;
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
  onNavigate?: (view: import('../../shared/nav').MainView) => void;
  onCreateHub: (name: string, memberIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  onCreateGroup?: (name: string, memberIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  onTogglePin?: (conversationId: string, isPinned: boolean) => void;
  pinningConversationId?: string | null;
  openingTeammateId?: string | null;
  directChatMetadata?: Record<string, DirectChatMetadata>;
};

export function ChatSidebar({
  workspaceName,
  selfLabel,
  conversations,
  typingPreviews = {},
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
  onPrefetch,
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
  onNavigate,
  onCreateHub,
  onCreateGroup,
  onTogglePin,
  pinningConversationId = null,
  openingTeammateId = null,
  directChatMetadata = {},
}: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<ChatTab>('all');
  const [composeMode, setComposeMode] = useState<'direct' | 'hub' | 'group'>('direct');
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState('');
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult | null>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);

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

    const tabItems = conversations.filter((conversation) => {
      if (activeTab === 'all') {
        return true;
      }

      if (activeTab === 'hub') {
        return conversation.kind === 'hub';
      }

      return conversation.kind === 'direct';
    });
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

  const hiddenOnOtherTabCount = useMemo(() => {
    if (isGlobalSearch) {
      return 0;
    }

    if (activeTab === 'all') {
      return 0;
    }

    return conversations.filter((conversation) => {
      if (activeTab === 'direct') {
        return conversation.kind === 'hub';
      }

      return conversation.kind === 'direct';
    }).length;
  }, [activeTab, conversations, isGlobalSearch]);

  const availableTeammates = useMemo(() => {
    if (isGlobalSearch || activeTab !== 'direct') {
      return [];
    }

    const withoutExistingChats = filterTeammatesWithoutDirectChat(
      teammates,
      conversations,
      directChatMetadata,
    );
    const validation = validateSearchQuery(searchQuery);

    if (!validation.ok || !validation.value) {
      return withoutExistingChats;
    }

    const query = validation.value.toLowerCase();

    return withoutExistingChats.filter((teammate) => {
      const haystack = `${teammate.name} ${teammate.username}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeTab, conversations, directChatMetadata, isGlobalSearch, searchQuery, teammates]);

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
    activeTab === 'all'
      ? searchQuery.trim()
        ? 'No chats match your search.'
        : 'No conversations yet.'
      : activeTab === 'direct'
        ? searchQuery.trim()
          ? 'No chats match your search.'
          : 'No recent chats yet.'
        : searchQuery.trim()
          ? 'No hubs match your search.'
          : 'No hubs yet.';

  return (
    <aside className="relative z-[40] flex h-full w-[320px] shrink-0 flex-col border-r border-app-border bg-app-chat-sidebar">
      <div className="border-b border-app-border px-4 py-4">
        <div className="mb-4 flex items-start justify-between gap-3 relative">
          <button 
            className="min-w-0 text-left hover:bg-app-chat-hover p-1 -m-1 rounded-lg transition-colors flex-1"
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
          >
            <h1 className="truncate text-[0.9375rem] font-semibold text-app-text">{workspaceName}</h1>
            <p className="mt-1 text-xs text-app-muted">Workspace</p>
          </button>
          
          {workspaceMenuOpen && (
            <div className="absolute top-10 left-0 w-56 rounded-xl border border-app-border bg-app-elevated py-2 shadow-lg z-50 animate-pop-in origin-top-left">
              <button 
                className="w-full px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover flex items-center gap-2"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  if (onNavigate) onNavigate('profile');
                }}
              >
                <FiSettings /> Profile & settings
              </button>
              <button 
                className="w-full px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover flex items-center gap-2"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  if (onNavigate) onNavigate('organization');
                }}
              >
                <FiBox /> Organization
              </button>
            </div>
          )}
          
          <button
            ref={notificationsButtonRef}
            type="button"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={notificationsOpen}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-visible rounded-lg text-app-muted transition-all duration-200 hover:bg-app-chat-hover hover:text-app-text active:scale-95"
            onClick={onToggleNotifications}
          >
            <BellIcon />
            <NotificationBadge count={unreadCount} ringClass="ring-app-chat-sidebar" />
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-accent text-white transition-all duration-200 hover:bg-accent-hover active:scale-95 hover:shadow-md"
            onClick={() => {
              setComposeMode('direct');
              onNewConversationOpenChange(true);
            }}
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
          <div className="relative flex p-1 rounded-xl bg-app-chat-panel gap-1 z-0">
            {/* Sliding Pill */}
            <div 
              className="absolute top-1 bottom-1 rounded-lg bg-app-elevated shadow-sm border border-app-border/50 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{
                width: activeTab === 'all' ? '46px' : activeTab === 'direct' ? '128px' : '56px',
                transform: `translateX(${activeTab === 'all' ? '0px' : activeTab === 'direct' ? '50px' : '182px'})`
              }}
            />
            <button
              type="button"
              className={`relative z-10 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ${
                activeTab === 'all'
                  ? 'text-app-text'
                  : 'text-app-muted hover:text-app-text'
              }`}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`relative z-10 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ${
                activeTab === 'direct'
                  ? 'text-app-text'
                  : 'text-app-muted hover:text-app-text'
              }`}
              onClick={() => setActiveTab('direct')}
            >
              Direct messages
            </button>
            <button
              type="button"
              className={`relative z-10 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ${
                activeTab === 'hub'
                  ? 'text-app-text'
                  : 'text-app-muted hover:text-app-text'
              }`}
              onClick={() => setActiveTab('hub')}
            >
              Hubs
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
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
          <>
            {filteredConversations.length === 0 && hiddenOnOtherTabCount > 0 ? (
              <p className="px-4 pb-2 text-xs text-app-muted">
                {hiddenOnOtherTabCount} chat{hiddenOnOtherTabCount === 1 ? '' : 's'} on the{' '}
                {activeTab === 'direct' ? 'Hubs' : 'Direct messages'} tab.
              </p>
            ) : null}
            <ConversationList
              conversations={filteredConversations}
              typingPreviews={typingPreviews}
              selectedId={selectedId}
              onSelect={onSelect}
              onPrefetch={onPrefetch}
              onTogglePin={onTogglePin}
              pinningConversationId={pinningConversationId}
              emptyMessage={
                activeTab === 'direct' && availableTeammates.length > 0 && !searchQuery.trim()
                  ? 'Pick a teammate below to start chatting.'
                  : emptyMessage
              }
            />
            {activeTab === 'direct' ? (
              <TeammatesSection
                teammates={availableTeammates}
                openingTeammateId={openingTeammateId}
                onSelect={onTeammateSelect}
              />
            ) : null}
          </>
        ) : null}
      </div>

      {notificationsOpen ? (
        <NotificationsPanel
          notifications={panelNotifications}
          pendingFriends={panelPendingFriends}
          loading={notificationsLoading}
          error={notificationsError}
          anchorRef={notificationsButtonRef}
          onClose={onCloseNotifications}
          onNotificationClick={onNotificationClick}
        />
      ) : null}

      {newConversationOpen ? (
        <NewConversationModal
          selfLabel={selfLabel}
          teammates={teammates}
          initialMode={composeMode}
          onClose={() => onNewConversationOpenChange(false)}
          onMessageSelf={() => {
            onNewConversationOpenChange(false);
            onMessageSelf();
          }}
          onMessageUser={(userId) => {
            onNewConversationOpenChange(false);
            onMessageUser(userId);
          }}
          onCreateHub={onCreateHub}
          onCreateGroup={onCreateGroup}
        />
      ) : null}
    </aside>
  );
}
