import React from 'react';
import type { CalendarHubOption } from '../../shared/extras';

export type CalendarEventsScope = 'all' | 'createdByMe' | 'sharedWithMe';
export type CalendarEventTypeFilter = 'any' | 'privateOnly' | 'linkedToChat';
export type CalendarWhenFilter = 'allDates' | 'today' | 'thisWeek';

export type CalendarFiltersState = {
  showEvents: boolean;
  showScheduledMessages: boolean;
  eventsScope: CalendarEventsScope;
  eventType: CalendarEventTypeFilter;
  when: CalendarWhenFilter;
  /** Empty = all hubs. */
  hubConversationIds: string[];
};

export const defaultCalendarFilters: CalendarFiltersState = {
  showEvents: true,
  showScheduledMessages: false,
  eventsScope: 'all',
  eventType: 'any',
  when: 'allDates',
  hubConversationIds: [],
};

export function calendarFiltersActive(filters: CalendarFiltersState): boolean {
  return (
    filters.showEvents !== defaultCalendarFilters.showEvents ||
    filters.showScheduledMessages !== defaultCalendarFilters.showScheduledMessages ||
    filters.eventsScope !== defaultCalendarFilters.eventsScope ||
    filters.eventType !== defaultCalendarFilters.eventType ||
    filters.when !== defaultCalendarFilters.when ||
    filters.hubConversationIds.length > 0
  );
}

type CalendarFiltersPopoverProps = {
  filters: CalendarFiltersState;
  hubOptions: CalendarHubOption[];
  onChange: (next: CalendarFiltersState) => void;
  onClose: () => void;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-app-muted">
      {children}
    </p>
  );
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-accent/50 bg-accent/15 text-app-text'
          : 'border-app-border text-app-muted hover:border-accent/30 hover:text-app-text'
      }`}
    >
      {label}
    </button>
  );
}

function RadioRow({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover transition-colors"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          active ? 'border-accent' : 'border-app-border'
        }`}
      >
        {active ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
      </span>
      {label}
    </button>
  );
}

export function CalendarFiltersPopover({
  filters,
  hubOptions,
  onChange,
  onClose,
}: CalendarFiltersPopoverProps) {
  const patch = (partial: Partial<CalendarFiltersState>) => {
    onChange({ ...filters, ...partial });
  };

  const toggleHub = (conversationId: string) => {
    const current = filters.hubConversationIds;
    const next = current.includes(conversationId)
      ? current.filter((id) => id !== conversationId)
      : [...current, conversationId];
    patch({ hubConversationIds: next });
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div className="absolute right-0 mt-2 w-[min(100vw-2rem,17.5rem)] rounded-2xl border border-app-border bg-app-surface shadow-xl z-50 overflow-hidden">
        <div className="border-b border-app-border px-4 py-3">
          <h3 className="text-sm font-semibold text-app-text">Filters</h3>
        </div>

        <SectionLabel>Show</SectionLabel>
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          <ToggleChip
            label="Events"
            active={filters.showEvents}
            onClick={() => patch({ showEvents: !filters.showEvents })}
          />
          <ToggleChip
            label="Scheduled messages"
            active={filters.showScheduledMessages}
            onClick={() => patch({ showScheduledMessages: !filters.showScheduledMessages })}
          />
        </div>

        <div className="border-t border-app-border" />
        <SectionLabel>Events</SectionLabel>
        <RadioRow
          label="All events"
          active={filters.eventsScope === 'all'}
          onClick={() => patch({ eventsScope: 'all' })}
        />
        <RadioRow
          label="Created by me"
          active={filters.eventsScope === 'createdByMe'}
          onClick={() => patch({ eventsScope: 'createdByMe' })}
        />
        <RadioRow
          label="Shared with me"
          active={filters.eventsScope === 'sharedWithMe'}
          onClick={() => patch({ eventsScope: 'sharedWithMe' })}
        />

        <div className="border-t border-app-border" />
        <SectionLabel>Type</SectionLabel>
        <RadioRow
          label="Any"
          active={filters.eventType === 'any'}
          onClick={() => patch({ eventType: 'any' })}
        />
        <RadioRow
          label="Private only"
          active={filters.eventType === 'privateOnly'}
          onClick={() => patch({ eventType: 'privateOnly' })}
        />
        <RadioRow
          label="Linked to a hub"
          active={filters.eventType === 'linkedToChat'}
          onClick={() => patch({ eventType: 'linkedToChat' })}
        />

        {hubOptions.length > 0 ? (
          <>
            <div className="border-t border-app-border" />
            <SectionLabel>Hubs</SectionLabel>
            <p className="px-4 pb-2 text-[11px] text-app-muted leading-snug">
              Show events and schedules tagged to selected hubs. Leave empty for all hubs.
            </p>
            <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto px-4 pb-3">
              {hubOptions.map((hub) => (
                <ToggleChip
                  key={hub.conversationId}
                  label={`#${hub.name}`}
                  active={filters.hubConversationIds.includes(hub.conversationId)}
                  onClick={() => toggleHub(hub.conversationId)}
                />
              ))}
            </div>
            {filters.hubConversationIds.length > 0 ? (
              <div className="px-4 pb-3">
                <button
                  type="button"
                  className="text-xs font-medium text-accent hover:underline"
                  onClick={() => patch({ hubConversationIds: [] })}
                >
                  All hubs
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="border-t border-app-border" />
        <SectionLabel>When</SectionLabel>
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <ToggleChip
            label="All dates"
            active={filters.when === 'allDates'}
            onClick={() => patch({ when: 'allDates' })}
          />
          <ToggleChip
            label="Today"
            active={filters.when === 'today'}
            onClick={() => patch({ when: 'today' })}
          />
          <ToggleChip
            label="This week"
            active={filters.when === 'thisWeek'}
            onClick={() => patch({ when: 'thisWeek' })}
          />
        </div>
      </div>
    </>
  );
}
