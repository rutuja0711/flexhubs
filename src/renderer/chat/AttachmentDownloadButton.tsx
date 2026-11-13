import { FiCheck, FiDownload, FiRefreshCw } from 'react-icons/fi';
import { SendingProgressRing } from '../ui/SendingProgressRing';

type AttachmentDownloadButtonProps = {
  isOwn?: boolean;
  isSending?: boolean;
  showSendProgress?: boolean;
  showDownloadProgress?: boolean;
  ringProgress?: number | null;
  ringIndeterminate?: boolean;
  downloadError?: boolean;
  downloaded?: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
};

export function AttachmentDownloadButton({
  isOwn = false,
  isSending = false,
  showSendProgress = false,
  showDownloadProgress = false,
  ringProgress = null,
  ringIndeterminate = false,
  downloadError = false,
  downloaded = false,
  onClick,
  size = 'md',
}: AttachmentDownloadButtonProps) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const ringSize = size === 'sm' ? 28 : 32;
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const surface = isOwn
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/18'
    : 'border-app-border/60 bg-app-inset/40 text-app-text hover:border-accent/35 hover:bg-accent/10';

  return (
    <button
      type="button"
      aria-label={
        showSendProgress
          ? 'Uploading file'
          : showDownloadProgress
            ? 'Downloading file'
            : downloadError
              ? 'Retry download'
              : downloaded && !isSending
                ? 'Download again'
                : 'Download file'
      }
      disabled={isSending && !showSendProgress}
      className={`relative flex ${dim} shrink-0 items-center justify-center rounded-full border transition active:scale-95 ${surface} ${
        isSending && !showSendProgress ? 'cursor-default opacity-50' : ''
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {showSendProgress || showDownloadProgress ? (
        <SendingProgressRing
          progress={ringIndeterminate ? null : ringProgress}
          size={ringSize}
          showLabel={!ringIndeterminate && typeof ringProgress === 'number' && ringProgress < 100}
          className={isOwn ? 'text-white' : 'text-accent'}
        />
      ) : downloadError ? (
        <FiRefreshCw className={iconClass} strokeWidth={2} />
      ) : downloaded && !isSending ? (
        <FiCheck className={iconClass} strokeWidth={2.5} />
      ) : (
        <FiDownload className={iconClass} strokeWidth={2} />
      )}
    </button>
  );
}
