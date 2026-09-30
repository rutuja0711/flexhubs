import { useState, useEffect } from 'react';
import { 
  FiPhone, 
  FiPhoneOff, 
  FiVideo, 
  FiPhoneIncoming, 
  FiPhoneOutgoing, 
  FiMoreHorizontal, 
  FiList
} from 'react-icons/fi';
import type { CallHistoryItem } from '../../shared/calls';
import { formatCallHistoryTitle } from '../../shared/calls';
import { Avatar } from './ChatIcons';

type CallHistoryFilter = 'all' | 'missed' | 'incoming' | 'outgoing' | 'video' | 'cancelled';

type CallHistoryViewProps = {
  items: CallHistoryItem[];
  loading: boolean;
  error: string;
  filter: string;
  currentUserId: string | null;
  onFilterChange: (filter: any) => void;
  onRetry: () => void;
  onOpenConversation: (item: CallHistoryItem) => void;
  onCall: (item: CallHistoryItem, video: boolean) => void;
  onDeleteCall: (item: CallHistoryItem) => void;
};

const FILTERS: { id: CallHistoryFilter; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: FiList },
  { id: 'missed', label: 'Missed', icon: FiPhoneOff },
  { id: 'incoming', label: 'Incoming', icon: FiPhoneIncoming },
  { id: 'outgoing', label: 'Outgoing', icon: FiPhoneOutgoing },
  { id: 'video', label: 'Video', icon: FiVideo },
  { id: 'cancelled', label: 'Cancelled', icon: FiPhoneOff },
];

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function formatDuration(sec: number) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CallHistoryView({
  items,
  loading,
  error,
  currentUserId,
  onRetry,
  onOpenConversation,
  onCall,
  onDeleteCall,
  onFilterChange,
}: CallHistoryViewProps) {
  const [localFilter, setLocalFilter] = useState<CallHistoryFilter>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClick = () => setMenuOpenId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleFilterClick = (f: CallHistoryFilter) => {
    setLocalFilter(f);
    if (f === 'missed') {
      onFilterChange('missed');
    } else {
      onFilterChange('all');
    }
  };

  const processedItems = items.filter(item => {
    if (localFilter === 'missed') return item.outcome === 'missed';
    if (localFilter === 'incoming') return item.initiatorId !== currentUserId;
    if (localFilter === 'outgoing') return item.initiatorId === currentUserId;
    if (localFilter === 'video') return item.mode === 'video';
    if (localFilter === 'cancelled') return item.outcome === 'cancelled' || item.outcome === 'declined';
    return true;
  });

  const grouped = processedItems.reduce((acc, item) => {
    const d = new Date(item.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey = '';
    let groupDate = '';
    
    if (d.toDateString() === today.toDateString()) {
      groupKey = 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday';
    } else {
      groupKey = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
    }
    
    groupDate = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

    if (!acc[groupKey]) {
      acc[groupKey] = { label: groupKey, date: groupDate, items: [] };
    }
    acc[groupKey].items.push(item);
    return acc;
  }, {} as Record<string, { label: string; date: string; items: CallHistoryItem[] }>);


  return (
    <div className="flex h-full flex-col bg-app-chat-bg text-app-text">
      {/* Header */}
      <header className="px-8 py-6">
        <h1 className="text-xl font-bold text-app-text">Call history</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="rounded-2xl border border-app-border bg-app-surface shadow-sm flex flex-col">
          {/* Filters */}
          <div className="flex gap-2 border-b border-app-border/50 px-6 py-4">
            {FILTERS.map((f) => {
              const isActive = localFilter === f.id;
              const Icon = f.icon;
              
              return (
                <button
                  key={f.id}
                  onClick={() => handleFilterClick(f.id)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
                    isActive 
                      ? 'bg-[#972c44] text-white' 
                      : 'bg-app-bg text-app-text hover:bg-app-chat-hover border border-app-border/40'
                  }`}
                >
                  <Icon className={isActive ? 'text-white/80' : 'text-app-muted'} />
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="flex flex-col">
            {loading && items.length === 0 ? <p className="p-6 text-sm text-app-muted">Loading...</p> : null}
            
            {Object.entries(grouped).map(([key, group]) => (
              <div key={key} className="flex flex-col">
                <div className="flex items-center justify-between border-b border-app-border/40 px-6 py-3 bg-app-bg/30">
                  <h2 className="text-[14px] font-bold text-app-text">{group.label}</h2>
                  <span className="text-[13px] text-app-muted">{group.date}</span>
                </div>
                
                <div className="flex flex-col">
                  {group.items.map((item, index) => {
                    const isMissed = item.outcome === 'missed' || item.outcome === 'declined' || item.outcome === 'cancelled';
                    const isIncoming = item.initiatorId !== currentUserId;
                    const isVideo = item.mode === 'video';
                    
                    let StatusIcon = FiPhoneOutgoing;
                    let iconColor = 'text-green-500';
                    if (isMissed) {
                      StatusIcon = FiPhoneOff;
                      iconColor = 'text-red-500';
                    } else if (isIncoming) {
                      StatusIcon = isVideo ? FiVideo : FiPhoneIncoming;
                      iconColor = 'text-green-500';
                    } else {
                      StatusIcon = isVideo ? FiVideo : FiPhoneOutgoing;
                      iconColor = 'text-green-500';
                    }

                    if (!isMissed && isIncoming && isVideo) {
                      StatusIcon = FiVideo;
                      iconColor = 'text-app-muted';
                    }
                    
                    const title = formatCallHistoryTitle(item);
                    
                    let subtitle = '';
                    if (isMissed) {
                      subtitle = `Missed ${isVideo ? 'video' : 'audio'} call`;
                    } else if (item.outcome === 'cancelled') {
                      subtitle = `Cancelled ${isVideo ? 'video' : 'audio'} call`;
                    } else if (isIncoming) {
                      subtitle = `Incoming ${isVideo ? 'video' : 'audio'} call`;
                    } else {
                      subtitle = `Outgoing ${isVideo ? 'video' : 'audio'} call`;
                    }

                    return (
                      <div key={item.id} className={`group flex items-center gap-4 px-6 py-4 hover:bg-app-surface/50 transition-colors ${index !== group.items.length - 1 ? 'border-b border-app-border/30' : ''}`}>
                        <div className="relative shrink-0">
                          <Avatar imageUrl={null} initials={title.substring(0, 2).toUpperCase()} size="md" />
                          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-app-bg bg-green-500"></div>
                        </div>
                        
                        <div className="flex flex-col flex-1 min-w-0">
                          <p className="truncate text-[14px] font-bold text-app-text">{title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <StatusIcon className={`h-3.5 w-3.5 ${isMissed ? 'text-red-500' : 'text-app-muted'}`} />
                            <p className={`text-[12px] truncate ${isMissed ? 'text-red-500' : 'text-app-muted'}`}>
                              {subtitle}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-8 shrink-0">
                          <p className="text-[13px] text-app-muted w-12 text-center">{formatDuration(item.durationSec)}</p>
                          <p className="text-[13px] text-app-muted w-16 text-right">{formatTime(item.createdAt)}</p>
                          <div className="flex items-center gap-2 relative">
                            <button 
                              onClick={() => onCall(item, isVideo)}
                              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-app-border bg-app-bg text-app-text hover:bg-app-chat-hover transition-colors"
                            >
                              {isVideo ? <FiVideo className="h-4 w-4" /> : <FiPhone className="h-4 w-4" />}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === item.id ? null : item.id);
                              }}
                              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-app-border bg-app-bg text-app-text hover:bg-app-chat-hover transition-colors"
                            >
                              <FiMoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuOpenId === item.id && (
                              <div className="absolute right-0 top-10 w-48 rounded-lg border border-app-border bg-app-surface py-1 shadow-lg z-50 overflow-hidden">
                                <button
                                  className="w-full px-4 py-2 text-left text-[13px] font-medium text-app-text hover:bg-app-chat-hover transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(null);
                                    onOpenConversation(item);
                                  }}
                                >
                                  Open conversation
                                </button>
                                <button
                                  className="w-full px-4 py-2 text-left text-[13px] font-medium text-red-500 hover:bg-app-chat-hover transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(null);
                                    onDeleteCall?.(item);
                                  }}
                                >
                                  Delete call history
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
