import React, { type ReactNode } from 'react';
import {
  NotificationCard,
  NotificationAvatar,
  NotificationActions,
  NotificationActionBtn,
  NotificationMedia,
  NotificationMediaThumbnail,
  NotificationTimestamp,
} from './DesktopNotificationSystem';
import { AppLogoMark } from '../../brand/AppLogo';
import { formatNotificationRelativeTime } from './notificationTime';
import { FiPhone, FiVideo, FiX } from 'react-icons/fi';

export type NotificationPayloadType =
  | 'text_message'
  | 'image_attachment'
  | 'video_attachment'
  | 'document_attachment'
  | 'voice_note'
  | 'poll'
  | 'mention'
  | 'thread_reply'
  | 'reaction'
  | 'friend_request'
  | 'hub_invite'
  | 'calendar_event'
  | 'missed_call'
  | 'status_change'
  | 'message_deleted'
  | 'system_notification'
  | 'multiple_files'
  | 'text_link'
  | 'large_media'
  | 'mixed_content'
  | 'org_invite'
  | 'calendar_reminder'
  | 'scheduled_message'
  | 'plan_compliance'
  | 'meeting_invite'
  | 'group_chat'
  | 'hub_message'
  | 'file_download'
  | 'deleted_account';

export type FlexHubsNotificationData = {
  id: string;
  type: NotificationPayloadType;
  priority?: 'high' | 'medium' | 'low';
  title: string;
  subtitle?: string;
  body?: string;
  timestamp: string | Date;
  isUnread?: boolean;
  avatarInitials?: string;
  avatarUrl?: string | null;
  onClick?: () => void;
  isSystem?: boolean;
  onDismiss?: () => void;
  onReply?: () => void;
  onMarkRead?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  persistUntilAction?: boolean;
  primaryAction?: { label: string; onClick: () => void };
  mediaPreviewUrl?: string | null;
  mediaPreviewCount?: number;
  mediaIsVideo?: boolean;
};

function isIncomingCallType(type: NotificationPayloadType, title: string, body: string): boolean {
  const haystack = `${title} ${body}`.toLowerCase();
  return type === 'meeting_invite' || haystack.includes('calling you');
}

function isMediaAttachmentType(type: NotificationPayloadType): boolean {
  return (
    type === 'image_attachment' ||
    type === 'large_media' ||
    type === 'video_attachment' ||
    type === 'multiple_files' ||
    type === 'mixed_content'
  );
}

function attachmentPreviewLabel(body: string | undefined, type: NotificationPayloadType): string {
  const trimmed = body?.trim();
  if (trimmed) {
    return trimmed;
  }

  if (type === 'video_attachment') {
    return 'Sent a video';
  }

  if (type === 'multiple_files' || type === 'mixed_content') {
    return 'Sent files';
  }

  return 'Sent an image';
}

function MessageMediaPreview({ data }: { data: FlexHubsNotificationData }) {
  if (!data.mediaPreviewUrl) {
    return null;
  }

  const extraCount =
    data.mediaPreviewCount && data.mediaPreviewCount > 1 ? data.mediaPreviewCount - 1 : undefined;

  return (
    <NotificationMedia>
      <NotificationMediaThumbnail
        src={data.mediaPreviewUrl}
        count={extraCount}
        isVideo={data.mediaIsVideo}
      />
    </NotificationMedia>
  );
}

function highlightMention(text: string): ReactNode {
  const parts = text.split(/(@you|@You)/gi);
  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) =>
    /^@you$/i.test(part) ? (
      <mark key={index} className="rounded bg-accent/25 px-0.5 font-semibold text-accent-soft not-italic">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function ToastHeader({
  timestamp,
  onDismiss,
  solidSurface,
}: {
  timestamp: string | Date;
  onDismiss?: () => void;
  solidSurface?: boolean;
}) {
  const borderClass = solidSurface ? 'border-[#2a3344]' : 'border-app-border/40 dark:border-white/10';
  const labelClass = solidSurface ? 'text-[#8b95a8]' : 'text-app-muted';
  const dismissHover = solidSurface
    ? 'hover:bg-[#1a2233] hover:text-[#f0f3f9]'
    : 'hover:bg-app-inset hover:text-app-text';

  return (
    <div className={`mb-2.5 flex items-center gap-2 border-b ${borderClass} pb-2`}>
      <AppLogoMark className="h-5 w-5 shrink-0" />
      <span className={`min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-[0.12em] ${labelClass}`}>
        FlexHubs
      </span>
      <span className={`shrink-0 text-[11px] font-medium ${labelClass}`}>
        {formatNotificationRelativeTime(timestamp)}
      </span>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss notification"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${labelClass} transition-colors ${dismissHover}`}
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        >
          <FiX className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function MessagePreview({ data, solidSurface }: { data: FlexHubsNotificationData; solidSurface?: boolean }) {
  const textPrimary = solidSurface ? 'text-[#f0f3f9]' : 'text-app-text';
  const textMuted = solidSurface ? 'text-[#9aa3b5]' : 'text-app-muted';
  if (data.type === 'group_chat' && data.subtitle) {
    return (
      <>
        <p className={`truncate text-sm font-semibold ${textPrimary}`}>{data.subtitle}</p>
        <p className={`mt-0.5 line-clamp-2 text-[13px] leading-snug ${textMuted}`}>
          <span className={`font-medium ${textPrimary}`}>{data.title}</span>
          {data.body ? `: ${data.body}` : ''}
        </p>
      </>
    );
  }

  if (data.type === 'mention') {
    return (
      <>
        <p className={`truncate text-sm font-semibold ${textPrimary}`}>
          {data.subtitle ? `${data.title} in ${data.subtitle}` : data.title}
        </p>
        {data.body ? (
          <p className={`mt-0.5 line-clamp-2 text-[13px] leading-snug ${textMuted}`}>
            {highlightMention(data.body)}
          </p>
        ) : null}
      </>
    );
  }

  if (data.type === 'friend_request') {
    return (
      <>
        <p className={`truncate text-sm font-semibold ${textPrimary}`}>{data.title}</p>
        <p className={`mt-0.5 text-[13px] ${textMuted}`}>{data.body || 'Sent you a friend request'}</p>
      </>
    );
  }

  if (isIncomingCallType(data.type, data.title, data.body ?? '')) {
    const video = `${data.title} ${data.body ?? ''}`.toLowerCase().includes('video');
    return (
      <>
        <p className={`truncate text-sm font-semibold ${textPrimary}`}>{data.title}</p>
        <p className={`mt-0.5 flex items-center gap-1.5 text-[13px] ${textMuted}`}>
          {video ? <FiVideo className="shrink-0 text-accent-soft" /> : <FiPhone className="shrink-0 text-accent-soft" />}
          {video ? 'Incoming video call' : 'Incoming voice call'}
        </p>
      </>
    );
  }

  if (data.isSystem || data.type === 'system_notification') {
    return (
      <>
        <p className={`truncate text-sm font-semibold ${textPrimary}`}>{data.title}</p>
        {data.body ? <p className={`mt-0.5 line-clamp-2 text-[13px] leading-snug ${textMuted}`}>{data.body}</p> : null}
      </>
    );
  }

  return (
    <>
      <p className={`truncate text-sm font-semibold ${textPrimary}`}>{data.title}</p>
      {isMediaAttachmentType(data.type) ? (
        <p className={`mt-0.5 text-[13px] italic leading-snug ${textMuted}`}>
          {attachmentPreviewLabel(data.body, data.type)}
        </p>
      ) : data.body ? (
        <p className={`mt-0.5 line-clamp-2 text-[13px] leading-snug ${textMuted}`}>&ldquo;{data.body}&rdquo;</p>
      ) : null}
      <MessageMediaPreview data={data} />
    </>
  );
}

function ToastActions({ data, solidSurface }: { data: FlexHubsNotificationData; solidSurface?: boolean }) {
  const secondary = solidSurface ?? false;

  if (data.type === 'friend_request') {
    return (
      <NotificationActions>
        <NotificationActionBtn primary solidSurface={secondary} onClick={() => data.onAccept?.()}>
          Accept
        </NotificationActionBtn>
        <NotificationActionBtn solidSurface={secondary} onClick={() => data.onDecline?.()}>
          Decline
        </NotificationActionBtn>
      </NotificationActions>
    );
  }

  if (isIncomingCallType(data.type, data.title, data.body ?? '')) {
    return (
      <NotificationActions>
        <NotificationActionBtn primary solidSurface={secondary} onClick={() => data.onAccept?.()}>
          Accept
        </NotificationActionBtn>
        <NotificationActionBtn solidSurface={secondary} onClick={() => data.onDecline?.()}>
          Decline
        </NotificationActionBtn>
      </NotificationActions>
    );
  }

  if (data.primaryAction) {
    return (
      <NotificationActions>
        <NotificationActionBtn primary solidSurface={secondary} onClick={() => data.primaryAction?.onClick()}>
          {data.primaryAction.label}
        </NotificationActionBtn>
      </NotificationActions>
    );
  }

  if (
    data.type === 'text_message' ||
    data.type === 'group_chat' ||
    data.type === 'mention' ||
    data.type === 'thread_reply' ||
    data.type === 'hub_message'
  ) {
    return (
      <NotificationActions>
        <NotificationActionBtn primary solidSurface={secondary} onClick={() => data.onReply?.()}>
          Reply
        </NotificationActionBtn>
        <NotificationActionBtn solidSurface={secondary} onClick={() => data.onMarkRead?.()}>
          Mark read
        </NotificationActionBtn>
      </NotificationActions>
    );
  }

  return null;
}

export function FlexHubsDesktopNotification({
  data,
  variant = 'toast',
}: {
  data: FlexHubsNotificationData;
  variant?: 'toast' | 'activity' | 'desktop';
}) {
  if (variant === 'activity') {
    const preview = data.body?.trim() || data.subtitle?.trim() || '';
    const extraMediaCount =
      data.mediaPreviewCount && data.mediaPreviewCount > 1 ? data.mediaPreviewCount - 1 : undefined;

    return (
      <NotificationCard
        id={data.id}
        timestamp={data.timestamp}
        priority={data.priority}
        isUnread={data.isUnread}
        variant="activity"
        onClick={data.onClick}
        className="w-full"
      >
        {data.isSystem ? (
          <AppLogoMark className="h-10 w-10 shrink-0" />
        ) : (
          <NotificationAvatar initials={data.avatarInitials} avatarUrl={data.avatarUrl} compact />
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold text-app-text">{data.title}</p>
          {preview ? (
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-app-muted">{preview}</p>
          ) : null}
          {data.mediaPreviewUrl ? (
            <NotificationMedia>
              <NotificationMediaThumbnail
                src={data.mediaPreviewUrl}
                count={extraMediaCount}
                isVideo={data.mediaIsVideo}
              />
            </NotificationMedia>
          ) : null}
        </div>
        <NotificationTimestamp timestamp={data.timestamp} isUnread={data.isUnread} />
      </NotificationCard>
    );
  }

  const showAvatar = !data.isSystem && data.type !== 'system_notification';
  const callType = isIncomingCallType(data.type, data.title, data.body ?? '');
  const cardVariant = variant === 'desktop' ? 'desktop' : 'toast';
  const solidSurface = variant === 'desktop';
  const textPrimary = solidSurface ? 'text-[#f0f3f9]' : 'text-app-text';
  const textMuted = solidSurface ? 'text-[#9aa3b5]' : 'text-app-muted';

  return (
    <NotificationCard
      id={data.id}
      timestamp={data.timestamp}
      priority={data.priority}
      isUnread={data.isUnread}
      variant={cardVariant}
      onClick={variant === 'desktop' ? undefined : data.onClick}
      className="flex-col gap-0 p-0"
    >
      <div className="w-full px-3.5 pt-3">
        <ToastHeader timestamp={data.timestamp} onDismiss={data.onDismiss} solidSurface={solidSurface} />
      </div>
      <div className={`flex w-full items-start gap-3 px-3.5 pb-3 ${solidSurface ? textPrimary : ''}`}>
        {showAvatar ? (
          <NotificationAvatar
            initials={data.avatarInitials}
            avatarUrl={data.avatarUrl}
            icon={
              callType ? (
                `${data.title} ${data.body ?? ''}`.toLowerCase().includes('video') ? (
                  <FiVideo />
                ) : (
                  <FiPhone />
                )
              ) : undefined
            }
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center">
            <AppLogoMark className="h-10 w-10" />
          </div>
        )}
        <div className={`min-w-0 flex-1 pt-0.5 ${textMuted}`}>
          <div className={textPrimary}>
            <MessagePreview data={data} solidSurface={solidSurface} />
          </div>
          <ToastActions data={data} solidSurface={solidSurface} />
        </div>
      </div>
    </NotificationCard>
  );
}

export {
  mapMessageToNotificationData,
  mapNotificationItemToFlexHubsData,
  mapActivityListItemToFlexHubsData,
  mapPendingFriendToFlexHubsData,
  resolveNotificationPresentationType,
} from './notificationPresentation';
