import React from 'react';
import type { MessageItem } from '../../../shared/messages';
import {
  NotificationCard,
  NotificationAvatar,
  NotificationTimestamp,
  NotificationMedia,
  NotificationMediaThumbnail,
  NotificationFile,
  NotificationVoiceNote,
  NotificationActions,
  NotificationActionBtn,
} from './DesktopNotificationSystem';
import { FiCheck, FiVideo, FiPhoneMissed, FiCalendar, FiUsers } from 'react-icons/fi';
import { AppLogoMark } from '../../brand/AppLogo';
import { RemoteImage } from '../../RemoteImage';

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
  avatarIcon?: React.ReactNode;
  media?: Array<{ kind: 'image' | 'video' | 'file' | 'audio'; url: string; previewUrl?: string | null; name?: string; size?: string; duration?: string }>;
  linkPreview?: { title: string; url: string; domain: string };
  pollPreview?: { options: Array<{ label: string; percentage: number }> };
  reaction?: { emoji: string; count: number };
  actions?: Array<{ label: string; primary?: boolean; onClick: () => void }>;
  onClick?: () => void;
  onDismiss?: () => void;
  isSystem?: boolean; // Replaces avatar with FlexHubs logo entirely
};

export function FlexHubsDesktopNotification({ data }: { data: FlexHubsNotificationData }) {
  const { onClick, onDismiss } = data;

  // Derive specialized render states
  const hasActions = data.actions && data.actions.length > 0;
  const imageMedia = data.media?.filter((m) => m.kind === 'image') || [];
  const videoMedia = data.media?.filter((m) => m.kind === 'video') || [];
  const fileMedia = data.media?.filter((m) => m.kind === 'file') || [];
  const audioMedia = data.media?.filter((m) => m.kind === 'audio') || [];

  return (
    <NotificationCard
      id={data.id}
      timestamp={data.timestamp}
      priority={data.priority}
      isUnread={data.isUnread}
      onClick={() => {
        onClick?.();
        onDismiss?.();
      }}
    >
      {data.isSystem ? (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-accent/10 shadow-sm relative z-0">
          <AppLogoMark className="h-6 w-6" />
        </div>
      ) : (
        <NotificationAvatar initials={data.avatarInitials} avatarUrl={data.avatarUrl} icon={data.avatarIcon} />
      )}

      <div className="flex flex-1 flex-col justify-center min-w-0 mt-0.5">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <div className="flex flex-col min-w-0">
            <p className="truncate font-semibold text-[#f0f2f5] text-[15px] leading-tight">
              {data.title}
            </p>
            {data.subtitle && <span className="text-[12.5px] font-medium text-app-muted/90 truncate mt-0.5">{data.subtitle}</span>}
          </div>
          <NotificationTimestamp timestamp={data.timestamp} isUnread={data.isUnread} />
        </div>

        {data.body && (
          <p className="line-clamp-2 text-[13px] text-app-muted/90 max-w-full leading-relaxed mt-0.5 break-words">
            {data.body}
          </p>
        )}

        {/* REACTION */}
        {data.reaction && (
          <div className="mt-1.5 flex items-center gap-1.5 rounded-full bg-app-chat-hover/50 px-2 py-0.5 w-fit border border-app-border/40">
            <span className="text-sm">{data.reaction.emoji}</span>
            <span className="text-[11px] font-bold text-app-text">{data.reaction.count}</span>
          </div>
        )}

        {/* POLL */}
        {data.pollPreview && (
          <div className="mt-2 flex flex-col gap-1.5">
            {data.pollPreview.options.slice(0, 2).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-app-chat-hover rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${opt.percentage}%` }} />
                </div>
                <span className="text-[10px] text-app-muted w-6 text-right">{opt.percentage}%</span>
              </div>
            ))}
          </div>
        )}

        {/* LINK PREVIEW */}
        {data.linkPreview && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-app-border/60 bg-app-chat-hover/30 p-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent/10">
              <AppLogoMark className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-app-text">{data.linkPreview.title}</p>
              <p className="text-[10px] text-accent truncate">{data.linkPreview.domain}</p>
            </div>
          </div>
        )}

        {/* VOICE NOTE */}
        {audioMedia.length > 0 && <NotificationVoiceNote durationStr={audioMedia[0].duration || '0:00'} />}

        {/* FILES */}
        {fileMedia.length > 0 && (
          <div className="flex flex-col gap-1">
             {fileMedia.slice(0, 2).map((file, i) => (
                <NotificationFile key={i} name={file.name || 'File'} size={file.size} />
             ))}
             {fileMedia.length > 2 && <span className="text-[10px] text-app-muted ml-1">+{fileMedia.length - 2} more files</span>}
          </div>
        )}

        {/* IMAGES & VIDEOS */}
        {(imageMedia.length > 0 || videoMedia.length > 0) && (
          <NotificationMedia>
            {videoMedia.slice(0, 1).map((vid, i) => (
              <NotificationMediaThumbnail key={`v-${i}`} src={vid.previewUrl || vid.url} isVideo />
            ))}
            {imageMedia.slice(0, 3 - videoMedia.length).map((img, i) => (
              <NotificationMediaThumbnail key={`i-${i}`} src={img.previewUrl || img.url} />
            ))}
            {imageMedia.length + videoMedia.length > 3 && (
              <NotificationMediaThumbnail count={(imageMedia.length + videoMedia.length) - 3} />
            )}
          </NotificationMedia>
        )}

        {/* LARGE IMAGE PREVIEW OVERRIDE (If type is large_media) */}
        {data.type === 'large_media' && imageMedia.length > 0 && (
          <div className="mt-2 h-24 w-full rounded-lg overflow-hidden border border-app-border">
            <RemoteImage src={imageMedia[0].previewUrl || imageMedia[0].url} className="h-full w-full object-cover" />
          </div>
        )}

        {/* ACTIONS */}
        {hasActions && (
          <NotificationActions>
            {data.actions!.map((action, i) => (
              <NotificationActionBtn key={i} primary={action.primary} onClick={action.onClick}>
                {action.label}
              </NotificationActionBtn>
            ))}
          </NotificationActions>
        )}
      </div>
    </NotificationCard>
  );
}

// ============================================================================
// Transformer Utility (Converts MessageItem -> FlexHubsNotificationData)
// ============================================================================
export function mapMessageToNotificationData(
  message: MessageItem,
  conversationTitle?: string,
  groupContext?: boolean
): FlexHubsNotificationData {
  let type: NotificationPayloadType = 'text_message';
  let subtitle: string | undefined = undefined;

  const media = message.media.map(m => ({
    kind: m.kind === 'gif' || m.kind === 'sticker' ? 'image' : m.kind,
    url: m.url,
    previewUrl: m.previewUrl,
    name: m.name,
  })) as FlexHubsNotificationData['media'];

  if (media && media.length > 0) {
    if (media.some(m => m.kind === 'video')) type = 'video_attachment';
    else if (media.some(m => m.kind === 'file')) type = media.length > 1 ? 'multiple_files' : 'document_attachment';
    else type = 'image_attachment';
  }

  // Handle Thread Reply
  if (message.threadRootId && !message.isOwn) {
    type = 'thread_reply';
    subtitle = 'Replied to thread';
  }

  // Handle Mentions
  if (message.content.includes('@')) {
    // Basic mention detection
    type = 'mention';
  }

  // Group context
  if (groupContext && conversationTitle) {
    type = 'group_chat';
    subtitle = conversationTitle;
  }

  return {
    id: message.id,
    type,
    priority: type === 'mention' || type === 'thread_reply' ? 'high' : 'medium',
    title: message.senderName,
    subtitle,
    body: message.content,
    timestamp: message.createdAt,
    avatarInitials: message.senderInitials,
    media,
  };
}
