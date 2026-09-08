import {
  FiMaximize2,
  FiMic,
  FiMicOff,
  FiMinimize2,
  FiMonitor,
  FiPhoneOff,
  FiVideo,
  FiVideoOff,
} from 'react-icons/fi';

type CallControlsProps = {
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  showCamera?: boolean;
  showScreenShare?: boolean;
  showExpand?: boolean;
  expanded?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onEnd: () => void;
  onToggleExpanded?: () => void;
  compact?: boolean;
};

export function CallControls({
  micEnabled,
  cameraEnabled,
  screenShareEnabled,
  showCamera = true,
  showScreenShare = true,
  showExpand = false,
  expanded = true,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onEnd,
  onToggleExpanded,
  compact = false,
}: CallControlsProps) {
  const buttonClass = compact
    ? 'inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20'
    : 'inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20';

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${compact ? '' : 'gap-3'}`}>
      {showExpand && onToggleExpanded ? (
        <button
          type="button"
          aria-label={expanded ? 'Minimize call' : 'Expand call'}
          className={buttonClass}
          onClick={onToggleExpanded}
        >
          {expanded ? <FiMinimize2 /> : <FiMaximize2 />}
        </button>
      ) : null}

      <button
        type="button"
        aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
        className={buttonClass}
        onClick={onToggleMic}
      >
        {micEnabled ? <FiMic /> : <FiMicOff />}
      </button>

      {showCamera ? (
        <button
          type="button"
          aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          className={buttonClass}
          onClick={onToggleCamera}
        >
          {cameraEnabled ? <FiVideo /> : <FiVideoOff />}
        </button>
      ) : null}

      {showScreenShare ? (
        <button
          type="button"
          aria-label={screenShareEnabled ? 'Stop screen sharing' : 'Share screen'}
          className={`${buttonClass} ${screenShareEnabled ? '!bg-accent text-white' : ''}`}
          onClick={onToggleScreenShare}
        >
          <FiMonitor />
        </button>
      ) : null}

      <button
        type="button"
        className={
          compact
            ? 'inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white hover:opacity-90'
            : 'inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90'
        }
        onClick={onEnd}
        aria-label="End call"
      >
        {compact ? <FiPhoneOff /> : <><FiPhoneOff /> End</>}
      </button>
    </div>
  );
}
