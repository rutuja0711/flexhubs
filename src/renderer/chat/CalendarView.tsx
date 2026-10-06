import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiCalendar,
  FiMoreHorizontal,
  FiSliders,
} from 'react-icons/fi';
import type { CalendarEventItem } from '../../shared/features';
import type { CalendarHubOption, ScheduledMessageItem } from '../../shared/extras';
import {
  isPendingScheduledMessage,
  resolveEventCreatorAvatarUrl,
  resolveEventCreatorDisplayName,
} from '../../shared/extras';
import {
  getUserAvatarUrl,
  getUserDisplayName,
  getUserId,
  getUserInitials,
  getUserUsername,
} from '../../shared/user';
import { Avatar } from './ChatIcons';
import { loadScheduledMessages } from '../extrasApi';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { NewEventModal } from './NewEventModal';
import {
  CalendarFiltersPopover,
  calendarFiltersActive,
  defaultCalendarFilters,
  type CalendarFiltersState,
} from './CalendarFiltersPopover';
import { filterCalendarEvents, filterScheduledMessages } from './calendarFilterUtils';

type CalendarViewProps = {
  events: CalendarEventItem[];
  loading: boolean;
  error: string;
  user: unknown;
  onRetry: () => void;
  onRefresh: () => void;
  onNotificationsRefresh?: () => void;
  onUnauthorized: (status?: number) => boolean;
  highlightEventId?: string | null;
  onHighlightHandled?: () => void;
  hubOptions?: CalendarHubOption[];
};

export function CalendarView({
  events,
  loading,
  error,
  user,
  onRetry,
  onRefresh,
  onNotificationsRefresh,
  onUnauthorized,
  highlightEventId = null,
  onHighlightHandled,
  hubOptions = [],
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(new Date().getDate());
  const [view, setView] = useState("Month");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEventItem | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<CalendarFiltersState>(defaultCalendarFilters);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessageItem[]>([]);

  const loadScheduled = useCallback(async () => {
    const result = await loadScheduledMessages();
    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      return;
    }
    setScheduledMessages(result.data.filter(isPendingScheduledMessage));
  }, [onUnauthorized]);

  useEffect(() => {
    void loadScheduled();
  }, [loadScheduled, events.length]);
  
  const toast = useToast();
  const confirm = useConfirm();

  const userId = getUserId(user);
  const username = getUserUsername(user);
  const displayName = getUserDisplayName(user);
  const viewerAvatarUrl = getUserAvatarUrl(user);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const startingEmptyCells = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };
  
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };
  
  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.getDate());
  };

  const monthYearString = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const handleDelete = async (event: CalendarEventItem) => {
    const confirmed = await confirm({
      title: 'Delete event',
      message: `Delete "${event.title}"? This cannot be undone.`,
      confirmLabel: 'Delete event',
      tone: 'danger',
    });
    if (!confirmed) return;
    const { deleteCalendarEvent } = await import('../extrasApi');
    const result = await deleteCalendarEvent(event.id);
    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }
    toast.success('Event deleted.');
    onRefresh();
    setModalOpen(false);
  };

  const getCreatorName = (event: CalendarEventItem) =>
    resolveEventCreatorDisplayName(event, userId, username, displayName);

  const getCreatorInitial = (event: CalendarEventItem) => {
    if (userId && event.createdById && userId === event.createdById) {
      return getUserInitials(user);
    }

    const name = getCreatorName(event);
    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    }

    return name.trim().slice(0, 2).toUpperCase() || '?';
  };

  const getCreatorAvatarUrl = (event: CalendarEventItem) =>
    resolveEventCreatorAvatarUrl(event, userId, viewerAvatarUrl);

  const filteredEvents = useMemo(
    () =>
      filterCalendarEvents(events, {
        searchQuery,
        scope: filters.eventsScope,
        eventType: filters.eventType,
        when: filters.when,
        hubConversationIds: filters.hubConversationIds,
        hubOptions,
        userId,
        username,
        displayName,
      }),
    [
      events,
      searchQuery,
      filters.eventsScope,
      filters.eventType,
      filters.when,
      filters.hubConversationIds,
      hubOptions,
      userId,
      username,
      displayName,
    ],
  );

  const filteredScheduled = useMemo(
    () =>
      filterScheduledMessages(scheduledMessages, {
        searchQuery,
        when: filters.when,
        hubConversationIds: filters.hubConversationIds,
        hubOptions,
      }),
    [scheduledMessages, searchQuery, filters.when, filters.hubConversationIds, hubOptions],
  );

  const visibleEvents = filters.showEvents ? filteredEvents : [];
  const visibleScheduled = filters.showScheduledMessages ? filteredScheduled : [];

  const getEventsForDate = (dateNum: number) => {
    return visibleEvents.filter((e) => {
      if (!e.startsAt) return false;
      const d = new Date(e.startsAt);
      return (
        d.getFullYear() === currentDate.getFullYear() &&
        d.getMonth() === currentDate.getMonth() &&
        d.getDate() === dateNum
      );
    });
  };

  const getScheduledForDate = (dateNum: number) => {
    return visibleScheduled.filter((item) => {
      if (!item.scheduledAt) return false;
      const d = new Date(item.scheduledAt);
      return (
        d.getFullYear() === currentDate.getFullYear() &&
        d.getMonth() === currentDate.getMonth() &&
        d.getDate() === dateNum
      );
    });
  };

  const filtersAreActive = calendarFiltersActive(filters);

  const getEventColor = (id?: string) => {
    const colors = [
      { bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-500', hover: 'hover:bg-blue-500/20' },
      { bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-500', hover: 'hover:bg-green-500/20' },
      { bg: 'bg-purple-500/10', border: 'border-purple-500/30', dot: 'bg-purple-500', hover: 'hover:bg-purple-500/20' },
      { bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-500', hover: 'hover:bg-amber-500/20' },
      { bg: 'bg-pink-500/10', border: 'border-pink-500/30', dot: 'bg-pink-500', hover: 'hover:bg-pink-500/20' },
      { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', dot: 'bg-cyan-500', hover: 'hover:bg-cyan-500/20' },
      { bg: 'bg-accent/10', border: 'border-accent/30', dot: 'bg-accent', hover: 'hover:bg-accent/20' },
    ];
    if (!id) return colors[0];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const selectedEvents = selectedDate !== null ? getEventsForDate(selectedDate) : [];
  const selectedScheduled =
    selectedDate !== null ? getScheduledForDate(selectedDate) : [];

  const modalInitialDate = useMemo(
    () =>
      selectedDate !== null
        ? new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate)
        : null,
    [currentDate, selectedDate],
  );
  
  const selectedDateStr = selectedDate !== null 
    ? new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate).toLocaleDateString("default", { weekday: "short", day: "numeric", month: "short" }) 
    : "";

  return (
    <div className="flex flex-col h-full bg-app-chat-bg min-h-0 text-app-text font-sans overflow-hidden">
      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-6 bg-app-surface border-b border-app-border shrink-0 transition-colors">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-app-muted mt-1">
            Plan your work, meetings and stay in sync with your team.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 rounded-full border border-app-border text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all bg-app-surface-input"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              aria-expanded={filterOpen}
              aria-label="Calendar filters"
              onClick={() => setFilterOpen(!filterOpen)}
              className={`p-2 border border-app-border rounded-full hover:bg-app-inset transition-colors ${filterOpen || filtersAreActive ? 'bg-app-inset text-app-text' : 'bg-app-surface text-app-muted'}`}
            >
              <FiSliders className="h-4 w-4 hover:text-app-text" />
            </button>
            {filterOpen ? (
              <CalendarFiltersPopover
                filters={filters}
                hubOptions={hubOptions}
                onChange={setFilters}
                onClose={() => setFilterOpen(false)}
              />
            ) : null}
          </div>
          <button 
            onClick={() => { setEditEvent(null); setModalOpen(true); }}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-sm"
          >
            <FiCalendar className="h-4 w-4" />
            New event
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden p-6 gap-6 max-w-[1600px] mx-auto w-full">
        {/* LEFT PANE: CALENDAR GRID */}
        <div className="flex-1 bg-app-surface rounded-2xl shadow-sm border border-app-border flex flex-col overflow-hidden transition-colors">
          {/* Grid Toolbar */}
          <div className="flex items-center justify-between p-4 border-b border-app-border shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-app-inset rounded-full border border-app-border p-1">
                <button onClick={handlePrevMonth} className="p-1.5 hover:bg-app-card rounded-full transition-colors text-app-muted hover:text-app-text">
                  <FiChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={handleToday} className="px-3 text-sm font-medium text-app-text hover:text-accent">
                  Today
                </button>
                <button onClick={handleNextMonth} className="p-1.5 hover:bg-app-card rounded-full transition-colors text-app-muted hover:text-app-text">
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>
              <h2 className="text-lg font-bold">{monthYearString}</h2>
            </div>
            
            <div className="flex items-center bg-app-inset rounded-full border border-app-border p-1 text-sm font-medium">
              {["Month", "Week", "Day", "Agenda"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 rounded-full transition-all ${
                    view === v ? "bg-accent text-white shadow-sm" : "text-app-muted hover:text-app-text"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Body */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {view === "Month" && (
              <>
                <div className="grid grid-cols-7 border-b border-app-border bg-app-inset/50 shrink-0">
                  {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
                    <div key={day} className="py-3 text-center text-xs font-semibold text-app-muted tracking-wider">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                  {Array.from({ length: startingEmptyCells }).map((_, i) => (
                    <div key={`empty-${i}`} className="border-r border-b border-app-border bg-app-inset/30 p-2" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const date = i + 1;
                    const isSelected = selectedDate === date;
                    const dayEvents = getEventsForDate(date);
                    const dayScheduled = getScheduledForDate(date);
                    const isToday = new Date().getDate() === date && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();

                    return (
                      <div 
                        key={date} 
                        onClick={() => setSelectedDate(date)}
                        className={`border-r border-b border-app-border p-2 transition-colors relative min-h-[100px] cursor-pointer ${isSelected ? 'bg-accent/10' : 'hover:bg-app-inset/50'}`}
                      >
                        <span className={`inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full ${isToday ? 'bg-accent text-white shadow-sm' : isSelected ? 'bg-accent/20 text-accent' : 'text-app-text'}`}>
                          {date}
                        </span>
                        <div className="mt-1 flex flex-col gap-1">
                          {dayEvents.map(e => (
                             <div 
                               key={e.id} 
                               onClick={(ev) => { ev.stopPropagation(); setEditEvent(e); setModalOpen(true); }}
                               className="px-2 py-1 text-[10px] rounded border border-accent/20 bg-accent/5 text-app-text font-medium truncate flex items-center gap-1 shadow-sm hover:bg-accent/10 transition-colors"
                             >
                               <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0"></span>
                               {e.title}
                             </div>
                          ))}
                          {dayScheduled.map((item) => (
                            <div
                              key={item.id}
                              onClick={(ev) => ev.stopPropagation()}
                              className="px-2 py-1 text-[10px] rounded border border-amber-500/30 bg-amber-500/10 text-app-text font-medium truncate flex items-center gap-1"
                              title={item.content}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              {item.conversationName}: {item.content.trim().slice(0, 24) || 'Scheduled message'}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* View Placeholders for Week/Day/Agenda */}
            {view === "Week" && (
              <div className="flex-1 flex w-full">
                 {Array.from({ length: 7 }).map((_, i) => {
                   // Calculate the days for the current week starting Monday
                   const currentDay = currentDate.getDay();
                   const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
                   const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - distanceToMonday + i);
                   const isToday = new Date().getDate() === date.getDate() && new Date().getMonth() === date.getMonth();
                   const dayEvents = visibleEvents.filter(e => {
                     const d = new Date(e.startsAt);
                     return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
                   });
                   const dayScheduled = visibleScheduled.filter((item) => {
                     const d = new Date(item.scheduledAt);
                     return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
                   });
                   const dayStr = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i];
                   
                   return (
                     <div key={i} className="flex-1 border-r border-app-border flex flex-col">
                        <div className="p-3 text-center border-b border-app-border bg-app-surface sticky top-0 z-10">
                           <div className="text-xs font-semibold text-app-muted">{dayStr}</div>
                           <div className={`text-lg font-bold mt-1 ${isToday ? 'text-accent' : ''}`}>{date.getDate()}</div>
                           <button 
                             onClick={() => { setSelectedDate(date.getDate()); setEditEvent(null); setModalOpen(true); }}
                             className="text-[11px] font-semibold text-accent mt-2 hover:underline"
                           >
                             Add event
                           </button>
                        </div>
                        <div className="flex-1 p-1 flex flex-col gap-1">
                          {dayEvents.map(e => {
                            const color = getEventColor(e.id);
                            return (
                              <div 
                                key={e.id}
                                onClick={() => { setEditEvent(e); setModalOpen(true); }}
                                className={`px-2 py-1.5 text-xs rounded border ${color.border} ${color.bg} text-app-text font-medium truncate flex items-center gap-1.5 cursor-pointer ${color.hover}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${color.dot} shrink-0`}></span>
                                {e.title}
                              </div>
                            );
                          })}
                          {dayScheduled.map((item) => (
                            <div
                              key={item.id}
                              className="px-2 py-1.5 text-xs rounded border border-amber-500/30 bg-amber-500/10 text-app-text font-medium truncate"
                              title={item.content}
                            >
                              {item.conversationName}
                            </div>
                          ))}
                        </div>
                     </div>
                   );
                 })}
              </div>
            )}
            {view === "Day" && (
               <div className="flex-1 flex flex-col">
                 <div className="p-4 border-b border-app-border bg-app-surface text-lg font-bold text-app-text">
                   {selectedDateStr || 'Select a day'}
                 </div>
                 <div className="flex-1 p-4 flex flex-col gap-2">
                 {selectedEvents.length > 0 || selectedScheduled.length > 0 ? (
                   <>
                    {selectedEvents.map(e => (
                      <div 
                        key={e.id} 
                        onClick={() => { setEditEvent(e); setModalOpen(true); }}
                        className="px-4 py-3 border border-accent/30 bg-accent/5 rounded-xl cursor-pointer hover:bg-accent/10 transition-colors flex items-center gap-3"
                      >
                         <span className="text-sm font-semibold text-app-text">{new Date(e.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                         <h3 className="font-medium flex-1">{e.title}</h3>
                         <Avatar
                           imageUrl={getCreatorAvatarUrl(e)}
                           initials={getCreatorInitial(e)}
                           size="sm"
                         />
                      </div>
                    ))}
                    {selectedScheduled.map((item) => (
                      <div
                        key={item.id}
                        className="px-4 py-3 border border-amber-500/30 bg-amber-500/10 rounded-xl flex flex-col gap-1"
                      >
                        <span className="text-sm font-semibold text-app-text">
                          {new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {item.conversationName}
                        </span>
                        <p className="text-xs text-app-muted line-clamp-2">{item.content}</p>
                      </div>
                    ))}
                   </>
                 ) : (
                    <div className="text-app-muted text-sm py-4">No events on this day.</div>
                 )}
                 </div>
               </div>
            )}
            {view === "Agenda" && (
               <div className="flex-1 flex flex-col p-6 overflow-y-auto max-w-4xl">
                 <div className="flex flex-col gap-6">
                   {/* Group events by date for Agenda view */}
                   {Array.from(
                     new Set([
                       ...visibleEvents.map((e) => new Date(e.startsAt).toDateString()),
                       ...visibleScheduled.map((s) => new Date(s.scheduledAt).toDateString()),
                     ]),
                   ).sort((a,b) => new Date(a).getTime() - new Date(b).getTime()).map(dateString => {
                     const dateEvents = visibleEvents.filter(e => new Date(e.startsAt).toDateString() === dateString);
                     const dateScheduled = visibleScheduled.filter(
                       (s) => new Date(s.scheduledAt).toDateString() === dateString,
                     );
                     const d = new Date(dateString);
                     const title = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                     
                     return (
                       <div key={dateString}>
                         <h3 className="text-sm font-semibold text-app-muted mb-3">{title}</h3>
                         <div className="flex flex-col gap-2">
                           {dateEvents.map(e => {
                             const color = getEventColor(e.id);
                             return (
                               <div 
                                 key={e.id} 
                                 onClick={() => { setEditEvent(e); setModalOpen(true); }}
                                 className={`px-4 py-3 border ${color.border} ${color.bg} rounded-xl flex items-center justify-between cursor-pointer ${color.hover} transition-colors`}
                               >
                                  <div className="flex items-center gap-3">
                                    <span className={`w-2 h-2 rounded-full ${color.dot} shrink-0`}></span>
                                    <span className="text-xs font-semibold text-app-text whitespace-nowrap">
                                      {new Date(e.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <h3 className="font-medium text-sm text-app-text">{e.title}</h3>
                                </div>
                                <Avatar
                                  imageUrl={getCreatorAvatarUrl(e)}
                                  initials={getCreatorInitial(e)}
                                  size="sm"
                                />
                             </div>
                           );
                           })}
                           {dateScheduled.map((item) => (
                             <div
                               key={item.id}
                               className="px-4 py-3 border border-amber-500/30 bg-amber-500/10 rounded-xl flex items-center justify-between"
                             >
                               <div className="flex items-center gap-3 min-w-0">
                                 <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                 <span className="text-xs font-semibold text-app-text whitespace-nowrap">
                                   {new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 </span>
                                 <h3 className="font-medium text-sm text-app-text truncate">
                                   {item.conversationName}: {item.content.trim().slice(0, 80)}
                                 </h3>
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: SIDEBAR */}
        <div className="w-[320px] flex flex-col gap-6 shrink-0 overflow-y-auto pr-2 pb-6">
          
          {/* Mini Calendar */}
          <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border p-5 shrink-0 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-app-inset rounded-full text-app-muted"><FiChevronLeft className="w-4 h-4" /></button>
              <h3 className="font-semibold text-sm">{monthYearString}</h3>
              <button onClick={handleNextMonth} className="p-1 hover:bg-app-inset rounded-full text-app-muted"><FiChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-y-2 text-center text-xs">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
                <span key={d} className="font-medium text-app-muted">{d}</span>
              ))}
              {Array.from({ length: startingEmptyCells }).map((_, i) => (
                <span key={`empty-mini-${i}`} className="py-1"></span>
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const date = i + 1;
                const isSelected = selectedDate === date;
                const isToday = new Date().getDate() === date && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
                const hasEvent =
                  getEventsForDate(date).length > 0 || getScheduledForDate(date).length > 0;

                return (
                  <span key={date} 
                    onClick={() => setSelectedDate(date)}
                    className={`py-1 cursor-pointer rounded-full relative transition-colors ${
                      isToday ? 'bg-accent text-white font-medium shadow-sm' : 
                      isSelected ? 'bg-accent/20 text-accent font-medium' : 'text-app-text hover:bg-app-inset'
                    }`}
                  >
                    {date}
                    {hasEvent && !isToday && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full"></span>}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Events for Selected Date */}
          <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border p-5 shrink-0 transition-colors flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-app-muted">Events</h3>
                <p className="text-xs font-semibold mt-1">{selectedDateStr || 'Select a date'}</p>
              </div>
              <span className="text-xs font-medium bg-app-inset px-2 py-1 rounded-md">
                {selectedEvents.length + selectedScheduled.length} item
                {selectedEvents.length + selectedScheduled.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            {selectedEvents.length > 0 || selectedScheduled.length > 0 ? (
               <>
               {selectedEvents.map(e => {
                 const creatorName = getCreatorName(e);
                 const timeStr = new Date(e.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                 const color = getEventColor(e.id);

                 return (
                   <div 
                     key={e.id} 
                     onClick={() => { setEditEvent(e); setModalOpen(true); }}
                     className="flex items-start gap-3 p-3 rounded-xl bg-app-card hover:bg-app-inset transition-colors border border-transparent hover:border-app-border group cursor-pointer"
                   >
                     <div className={`mt-1 w-2 h-2 rounded-full ${color.dot} shrink-0`}></div>
                     <div className="flex-1 min-w-0">
                       <h4 className="text-sm font-semibold truncate">{e.title}</h4>
                       <p className="text-xs text-app-muted mt-0.5">
                         {timeStr}
                         {' • '}
                         {e.conversationName ||
                           e.taggedHubs?.[0]?.name ||
                           (e.conversationId || (e.taggedHubs?.length ?? 0) > 0 ? 'Hub event' : 'Private')}
                       </p>
                       <div className="flex items-center gap-2 mt-2">
                         <Avatar
                           imageUrl={getCreatorAvatarUrl(e)}
                           initials={getCreatorInitial(e)}
                           size="xs"
                         />
                         <span className="text-[10px] font-medium text-app-muted">{creatorName}</span>
                       </div>
                     </div>
                     <button className="opacity-0 group-hover:opacity-100 p-1.5 text-app-muted hover:text-app-text hover:bg-app-card rounded-full transition-all">
                       <FiMoreHorizontal className="w-4 h-4" />
                     </button>
                   </div>
                 );
               })}
               {selectedScheduled.map((item) => {
                 const timeStr = new Date(item.scheduledAt).toLocaleTimeString([], {
                   hour: '2-digit',
                   minute: '2-digit',
                 });
                 return (
                   <div
                     key={item.id}
                     className="flex items-start gap-3 p-3 rounded-xl bg-app-card border border-amber-500/20"
                   >
                     <div className="mt-1 w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                     <div className="flex-1 min-w-0">
                       <h4 className="text-sm font-semibold truncate">{item.conversationName}</h4>
                       <p className="text-xs text-app-muted mt-0.5">{timeStr} · Scheduled message</p>
                       <p className="text-xs text-app-text mt-1 line-clamp-2">{item.content}</p>
                     </div>
                   </div>
                 );
               })}
               </>
            ) : (
               <div className="flex flex-col items-center justify-center p-4 text-center">
                  <FiCalendar className="w-6 h-6 text-app-muted mb-2" />
                  <p className="text-sm text-app-muted mb-3">No events on this day</p>
                  <button 
                    onClick={() => { setEditEvent(null); setModalOpen(true); }}
                    className="text-xs font-semibold bg-app-inset text-app-text px-3 py-1.5 rounded-lg hover:bg-app-card transition-colors"
                  >
                    Create event
                  </button>
               </div>
            )}
          </div>
        </div>
      </div>

      <NewEventModal
        key={editEvent?.id ?? 'new-event'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditEvent(null); }}
        onCreated={() => {
          toast.success('Event saved.');
          onRefresh();
          void loadScheduled();
        }}
        onDelete={() => editEvent && handleDelete(editEvent)}
        onUnauthorized={onUnauthorized}
        editEvent={editEvent}
        initialDate={modalInitialDate}
        hubOptions={hubOptions}
      />
    </div>
  );
}
