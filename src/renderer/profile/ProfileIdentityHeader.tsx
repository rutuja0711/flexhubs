import { FiEdit2 } from 'react-icons/fi';
import type { PresenceStatus } from '../../shared/chat';
import { presenceDotClass } from '../../shared/contact';
import { Avatar } from '../chat/ChatIcons';
import { ProfileCoverImage } from './ProfileCoverImage';

type ProfileIdentityHeaderProps = {
  displayName: string;
  avatarUrl?: string | null;
  avatarInitials: string;
  bannerUrl?: string | null;
  bannerPlaceholderUrl?: string | null;
  onBannerPrimaryLoaded?: () => void;
  presenceStatus?: PresenceStatus | null;
  showPresence?: boolean;
  editable?: boolean;
  onEditCover?: () => void;
  onEditAvatar?: () => void;
  onAvatarImagePreview?: (imageUrl: string) => void;
  coverHeightClass?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Edge-to-edge banner (conversation panel / sidebar). */
  flush?: boolean;
  /** When false, only the banner is shown (e.g. settings layout with avatar below). */
  showAvatar?: boolean;
};

export function ProfileIdentityHeader({
  displayName,
  avatarUrl,
  avatarInitials,
  bannerUrl,
  bannerPlaceholderUrl,
  onBannerPrimaryLoaded,
  presenceStatus = null,
  showPresence = true,
  editable = false,
  onEditCover,
  onEditAvatar,
  onAvatarImagePreview,
  coverHeightClass = 'h-[88px] sm:h-[104px]',
  size = 'lg',
  flush = false,
  showAvatar = true,
}: ProfileIdentityHeaderProps) {
  const avatarSize = size === 'sm' ? 'md' : size === 'md' ? 'lg' : 'xl';
  const overlapSpacer =
    avatarSize === 'xl' ? 'h-12' : avatarSize === 'lg' ? 'h-10' : 'h-8';

  return (
    <div className="relative w-full">
      <div className={`relative w-full ${coverHeightClass}`}>
        <ProfileCoverImage
          bannerUrl={bannerUrl}
          placeholderUrl={bannerPlaceholderUrl}
          onPrimaryLoaded={onBannerPrimaryLoaded}
          alt={`${displayName} cover`}
          roundedTop={!flush}
        />
        {onEditCover ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEditCover();
            }}
            className="absolute right-2.5 top-2.5 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black/70"
            aria-label="Edit cover photo"
          >
            <FiEdit2 className="text-[15px]" aria-hidden />
          </button>
        ) : null}
        {showAvatar ? (
          <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
            <div className="relative">
              <div className="rounded-full border-4 border-app-surface bg-app-surface shadow-lg">
                <Avatar
                  imageUrl={avatarUrl ?? null}
                  initials={avatarInitials}
                  size={avatarSize}
                  loading="eager"
                  onImageClick={onAvatarImagePreview}
                />
              </div>
              {onEditAvatar ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditAvatar();
                  }}
                  className="absolute bottom-0.5 right-0.5 z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 border-app-surface bg-app-surface text-app-text shadow-md transition-colors hover:bg-app-chat-hover"
                  aria-label="Change profile photo"
                >
                  <FiEdit2 className="text-[13px]" aria-hidden />
                </button>
              ) : null}
              {showPresence && presenceStatus ? (
                <span
                  className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-[3px] border-app-surface ${presenceDotClass(
                    presenceStatus,
                  )}`}
                  aria-hidden
                />
              ) : showPresence ? (
                <span
                  className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-[3px] border-app-surface bg-app-muted"
                  aria-hidden
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {showAvatar ? <div className={overlapSpacer} aria-hidden /> : null}
    </div>
  );
}