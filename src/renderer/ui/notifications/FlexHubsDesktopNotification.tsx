import React from 'react';
import { NotificationCard, NotificationAvatar, NotificationTimestamp } from './DesktopNotificationSystem';
import { AppLogoMark } from '../../brand/AppLogo';

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
};

function displayPreview(data: FlexHubsNotificationData): string {
  const parts = [data.subtitle, data.body].filter((value) => value && value.trim());
  return parts.join(' · ').trim();
}

export function FlexHubsDesktopNotification({
  data,
  variant = 'toast',
}: {
  data: FlexHubsNotificationData;
  variant?: 'toast' | 'activity';
}) {
  const preview = displayPreview(data);
  const compactAvatar = variant === 'activity';

  return (
    <NotificationCard
      id={data.id}
      timestamp={data.timestamp}
      priority={data.priority}
      isUnread={data.isUnread}
      variant={variant}
      onClick={data.onClick}
      className={variant === 'toast' ? 'items-center gap-3' : undefined}
    >
      {data.isSystem ? (
        <div
          className={`relative z-0 flex shrink-0 items-center justify-center rounded-[12px] bg-accent/10 ${
            compactAvatar ? 'h-10 w-10' : 'h-12 w-12'
          }`}
        >
          <AppLogoMark className={compactAvatar ? 'h-5 w-5' : 'h-6 w-6'} />
        </div>
      ) : (
        <NotificationAvatar
          initials={data.avatarInitials}
          avatarUrl={data.avatarUrl}
          compact={compactAvatar}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-app-text">{data.title}</p>
          <NotificationTimestamp timestamp={data.timestamp} isUnread={data.isUnread} />
        </div>
        {preview ? (
          <p className="line-clamp-2 text-[13px] leading-snug text-app-muted">{preview}</p>
        ) : null}
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
