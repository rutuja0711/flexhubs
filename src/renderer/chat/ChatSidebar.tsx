import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationItem, DirectChatMetadata, PresenceStatus } from '../../shared/chat';
import type { ProfileSettings } from '../../shared/profile';
import { NotificationStatusBanner } from './NotificationStatusBanner';
import type { TeammateItem } from '../../shared/messages';
import type { GlobalSearchResult, SearchPerson } from '../../shared/search';
import { validateSearchQuery, filterTeammatesForSidebar, prepareSidebarConversationList, sortSidebarTeammates, type SidebarConversationTab } from '../../shared/chat';
import { validateSearchInput } from '../../shared/search';
import { loadGlobalSearch } from '../chatApi';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../theme/ThemeProvider';
import { PlusIcon, BuildingIcon } from './ChatIcons';
import { ConversationList } from './ConversationList';
import type { ConversationContextMenuActions } from './ConversationContextMenu';
import { GlobalSearchResults } from './GlobalSearchResults';
import { NewConversationModal } from './NewConversationModal';
import { SearchField } from './SearchField';
import { TeammatesSection } from './TeammatesSection';
type ChatTab = SidebarConversationTab;

const EMPTY_PRESENCE_MAP = new Map<string, PresenceStatus>();

type ChatSidebarProps = {
  workspaceName: string;
  organizationNavEnabled?: boolean;
  selfLabel: string;
  conversations: ConversationItem[];
  typingPreviews?: Record<string, string>;
  teammates: TeammateItem[];
  loading: boolean;
  error: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPrefetch?: (id: string) => void;
  onRetry: () => void;
  onTeammateSelect: (memberId: string) => void;
  onTeammateAddFriend: (memberId: string) => Promise<void>;
  onSelectPerson: (person: SearchPerson) => void;
  onMessageSelf: () => void;
  newConversationOpen: boolean;
  onNewConversationOpenChange: (open: boolean) => void;
  onMessageUser: (userId: string) => void;
  onNavigate?: (view: import('../../shared/nav').MainView) => void;
  onCreateHub: (name: string, memberIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  onCreateGroup?: (name: string, memberIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  conversationMenuActions?: ConversationContextMenuActions;
  conversationMenuBusy?: boolean;
  blockedUserIds?: ReadonlySet<string>;
  blockedByPeerIds?: ReadonlySet<string>;
  onPrepareConversationContextMenu?: () => void;
  openingTeammateId?: string | null;
  directChatMetadata?: Record<string, DirectChatMetadata>;
  presenceByUserId?: ReadonlyMap<string, PresenceStatus>;
  viewerUserId?: string | null;
  viewerSharePresence?: boolean;
  notificationSettings?: ProfileSettings | null;
  onOpenNotificationSettings?: () => void;
};

export function ChatSidebar({
  workspaceName,
  organizationNavEnabled = true,
  selfLabel,
  conversations,
  typingPreviews = {},
  teammates,
  loading,
  error,
  selectedId,
  onSelect,
  onPrefetch,
  onRetry,
  onTeammateSelect,
  onTeammateAddFriend,
  onSelectPerson,
  onMessageSelf,
  newConversationOpen,
  onNewConversationOpenChange,
  onMessageUser,
  onNavigate,
  onCreateHub,
  onCreateGroup,
  conversationMenuActions,
  conversationMenuBusy = false,
  blockedUserIds,
  blockedByPeerIds,
  onPrepareConversationContextMenu,
  openingTeammateId = null,
  directChatMetadata = {},
  presenceByUserId = EMPTY_PRESENCE_MAP,
  viewerUserId = null,
  viewerSharePresence = true,
  notificationSettings = null,
  onOpenNotificationSettings,
}: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<ChatTab>('all');
  const [composeMode, setComposeMode] = useState<'direct' | 'hub' | 'group'>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState('');
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult | null>(null);
  const { theme, toggleTheme } = useTheme();
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<ChatTab, HTMLButtonElement | null>>({
    all: null,
    direct: null,
    hub: null,
  });
  const [tabIndicator, setTabIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  useEffect(() => {
    const updateIndicator = () => {
      const activeEl = tabRefs.current[activeTab];
      const container = tabContainerRef.current;
      if (activeEl && container) {
        setTabIndicator({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
          ready: true,
        });
      }
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);

    const container = tabContainerRef.current;
    const observer =
      container && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateIndicator();
          })
        : null;
    if (container && observer) {
      observer.observe(container);
    }

    return () => {
      window.removeEventListener('resize', updateIndicator);
      observer?.disconnect();
    };
  }, [activeTab]);

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

    const tabItems = prepareSidebarConversationList(conversations, {
      tab: activeTab,
      selectedId,
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
  }, [activeTab, conversations, isGlobalSearch, searchQuery, selectedId]);

  const showTeammatesSection = activeTab === 'all' || activeTab === 'direct';

  const availableTeammates = useMemo(() => {
    if (isGlobalSearch || !showTeammatesSection) {
      return [];
    }

    const withoutExistingChats = filterTeammatesForSidebar(teammates, conversations);
    const validation = validateSearchQuery(searchQuery);

    if (!validation.ok || !validation.value) {
      return sortSidebarTeammates(withoutExistingChats, presenceByUserId);
    }

    const query = validation.value.toLowerCase();

    return sortSidebarTeammates(withoutExistingChats, presenceByUserId).filter((teammate) => {
      const haystack = `${teammate.name} ${teammate.username}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [conversations, isGlobalSearch, presenceByUserId, searchQuery, showTeammatesSection, teammates]);

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
    <aside className="relative z-[40] flex h-full w-[330px] shrink-0 flex-col border-r border-app-border bg-app-chat-sidebar transition-colors">
      <div className="border-b border-app-border px-4 py-3.5">
        <div className="mb-3.5">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              title={workspaceName}
              className={`group min-w-0 flex-1 rounded-xl p-1.5 -m-1.5 text-left transition-colors ${
                organizationNavEnabled ? 'hover:bg-app-chat-hover/80' : 'cursor-default'
              }`}
              disabled={!organizationNavEnabled}
              onClick={() => {
                if (organizationNavEnabled) {
                  onNavigate?.('organization');
                }
              }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-chat-hover/90 text-accent-soft ring-1 ring-app-border/40">
                  <BuildingIcon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-sm font-semibold tracking-tight text-app-text">
                    {workspaceName}
                  </h1>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-app-muted/80">
                    Workspace
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-app-muted transition-all duration-200 hover:bg-app-chat-hover hover:text-app-text active:scale-95"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? (
                <FiSun className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <FiMoon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </div>
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm shadow-accent/30 transition-all duration-200 hover:shadow-accent-glow hover:scale-105 active:scale-95"
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
        <div className="border-b border-app-border px-4 py-2">
          <p className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-app-muted">Chats</p>
          <div
            ref={tabContainerRef}
            className="relative z-0 grid grid-cols-3 gap-0.5 overflow-hidden rounded-full border border-app-border/80 bg-app-surface-input/70 p-0.5 shadow-inner shadow-black/5 dark:bg-app-inset/90"
          >
            <div
              className="pointer-events-none absolute left-0 top-0.5 bottom-0.5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-all duration-250 ease-[cubic-bezier(0.2,0.8,0.2,1)] dark:bg-app-elevated dark:ring-white/5"
              style={{
                transform: `translateX(${tabIndicator.left}px)`,
                width: `${tabIndicator.width}px`,
                opacity: tabIndicator.ready ? 1 : 0,
              }}
              aria-hidden="true"
            />
            <button
              ref={(el) => {
                tabRefs.current.all = el;
              }}
              type="button"
              title="All"
              className={`relative z-10 min-w-0 truncate select-none rounded-full px-1.5 py-1.5 text-center text-[10px] font-semibold leading-none tracking-tight transition-colors duration-200 ${
                activeTab === 'all'
                  ? 'text-app-text'
                  : 'text-app-muted hover:text-app-text'
              }`}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
            <button
              ref={(el) => {
                tabRefs.current.direct = el;
              }}
              type="button"
              title="Direct messages"
              className={`relative z-10 min-w-0 truncate select-none rounded-full px-1.5 py-1.5 text-center text-[10px] font-semibold leading-none tracking-tight transition-colors duration-200 ${
                activeTab === 'direct'
                  ? 'text-app-text'
                  : 'text-app-muted hover:text-app-text'
              }`}
              onClick={() => setActiveTab('direct')}
            >
              Messages
            </button>
            <button
              ref={(el) => {
                tabRefs.current.hub = el;
              }}
              type="button"
              title="Hubs"
              className={`relative z-10 min-w-0 truncate select-none rounded-full px-1.5 py-1.5 text-center text-[10px] font-semibold leading-none tracking-tight transition-colors duration-200 ${
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

      {notificationSettings && onOpenNotificationSettings ? (
        <NotificationStatusBanner
          settings={notificationSettings}
          onOpenSettings={onOpenNotificationSettings}
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {loading && conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-app-muted" role="status">
            Loading conversations...
          </div>
        ) : null}

        {!loading && error && conversations.length === 0 ? (
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

        {(!loading || conversations.length > 0) && !error && isGlobalSearch ? (
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

        {(!loading || conversations.length > 0) && !error && !isGlobalSearch ? (
          <>
            <ConversationList
              conversations={filteredConversations}
              presenceByUserId={presenceByUserId}
              viewerUserId={viewerUserId}
              viewerSharePresence={viewerSharePresence}
              typingPreviews={typingPreviews}
              selectedId={selectedId}
              onSelect={onSelect}
              onPrefetch={onPrefetch}
              menuActions={conversationMenuActions}
              menuBusy={conversationMenuBusy}
              blockedUserIds={blockedUserIds}
              onPrepareContextMenu={onPrepareConversationContextMenu}
              emptyMessage={
                showTeammatesSection && availableTeammates.length > 0 && !searchQuery.trim()
                  ? 'Pick a teammate below to start chatting.'
                  : emptyMessage
              }
            />
            {showTeammatesSection ? (
              <TeammatesSection
                teammates={availableTeammates}
                openingTeammateId={openingTeammateId}
                blockedUserIds={blockedUserIds}
                blockedByPeerIds={blockedByPeerIds}
                presenceByUserId={presenceByUserId}
                onSelect={onTeammateSelect}
                onAddFriend={onTeammateAddFriend}
              />
            ) : null}
          </>
        ) : null}
      </div>

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
