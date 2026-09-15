import { useEffect, type ReactNode } from 'react';
import { FiChevronDown, FiMaximize2, FiMinimize2, FiMove } from 'react-icons/fi';
import type { CallSession } from '../callManager';
import { CallControls } from './CallControls';
import { useViewportDraggable } from './useViewportDraggable';

export type CallPanelLayout = 'minimized' | 'floating' | 'fullscreen';

type CallFloatingPanelProps = {
  session: CallSession;
  layout: CallPanelLayout;
  durationLabel: string;
  statusLabel: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  showVideoControls: boolean;
  showCamera?: boolean;
  showScreenShare?: boolean;
  children: ReactNode;
  onLayoutChange: (layout: CallPanelLayout) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onEnd: () => void;
};

function WindowChrome({
  layout,
  onMinimize,
  onToggleFullscreen,
}: {
  layout: CallPanelLayout;
  onMinimize: () => void;
  onToggleFullscreen: () => void;
}) {
  const buttonClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20';

  return (
    <div className="flex items-center gap-1.5">
      {layout !== 'minimized' ? (
        <button
          type="button"
          aria-label="Minimize call to corner"
          className={buttonClass}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onMinimize();
          }}
        >
          <FiChevronDown />
        </button>
      ) : null}
      {layout === 'minimized' ? null : (
        <button
          type="button"
          aria-label={layout === 'fullscreen' ? 'Exit full screen' : 'Open full screen'}
          className={buttonClass}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFullscreen();
          }}
        >
          {layout === 'fullscreen' ? <FiMinimize2 /> : <FiMaximize2 />}
        </button>
      )}
    </div>
  );
}

export function CallFloatingPanel({
  session,
  layout,
  durationLabel,
  statusLabel,
  micEnabled,
  cameraEnabled,
  screenShareEnabled,
  showVideoControls,
  showCamera,
  showScreenShare,
  children,
  onLayoutChange,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onEnd,
}: CallFloatingPanelProps) {
  const title = session.peerLabel || (session.isGroup ? 'Meeting' : 'Call');
  const initial = title.slice(0, 1).toUpperCase() || '?';
  const callTypeLabel = session.video || showVideoControls ? 'Video call' : 'Voice call';
  const cameraControlVisible = showCamera ?? showVideoControls;
  const screenShareControlVisible = showScreenShare ?? showVideoControls;
  const isDraggable = layout !== 'fullscreen';
  const { panelRef, panelStyle, isDragging, startDrag, moveDrag, endDrag, ensureDefaultPosition } =
    useViewportDraggable(isDraggable);

  useEffect(() => {
    if (layout !== 'fullscreen') {
      ensureDefaultPosition();
    }
  }, [ensureDefaultPosition, layout]);

  const dragHandleProps = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  if (layout === 'minimized') {
    return (
      <div
        ref={panelRef}
        style={panelStyle}
        className="pointer-events-auto fixed z-[9999] flex h-[min(280px,calc(100dvh-1.5rem))] w-[min(320px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101114] shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <div
          className={`flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/20 px-2 py-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          {...dragHandleProps}
        >
          <FiMove className="shrink-0 text-white/45" aria-hidden="true" />
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={() => onLayoutChange('floating')}
          >
            {session.peerAvatar ? (
              <img src={session.peerAvatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent-soft">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{title}</p>
              <p className="truncate text-xs text-white/55">
                {durationLabel || statusLabel} · {callTypeLabel}
              </p>
            </div>
          </button>
          <button
            type="button"
            aria-label="Expand call"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onLayoutChange('floating');
            }}
          >
            <FiMaximize2 />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

        <div className="shrink-0 border-t border-white/10 bg-[#101114] px-3 py-2">
          <CallControls
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            screenShareEnabled={screenShareEnabled}
            showCamera={cameraControlVisible}
            showScreenShare={screenShareControlVisible}
            compact
            onToggleMic={onToggleMic}
            onToggleCamera={onToggleCamera}
            onToggleScreenShare={onToggleScreenShare}
            onEnd={onEnd}
          />
        </div>
      </div>
    );
  }

  const shellClass =
    layout === 'fullscreen'
      ? 'pointer-events-auto fixed inset-0 z-[99999] flex h-[100dvh] w-screen max-h-none max-w-none flex-col overflow-hidden rounded-none border-0 bg-[#090a0d]'
      : 'pointer-events-auto fixed z-[9999] flex h-[min(500px,calc(100dvh-1.5rem))] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#101114] shadow-[0_24px_80px_rgba(0,0,0,0.45)]';

  return (
    <div ref={panelRef} style={layout === 'floating' ? panelStyle : undefined} className={shellClass}>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3">
        <div
          className={`flex min-w-0 flex-1 items-center gap-2 ${
            layout === 'floating' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
          }`}
          {...(layout === 'floating' ? dragHandleProps : {})}
        >
          {layout === 'floating' ? <FiMove className="shrink-0 text-white/45" aria-hidden="true" /> : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-white/55">
              {durationLabel || statusLabel} · {callTypeLabel}
            </p>
          </div>
        </div>
        <div className="shrink-0 pl-2" onPointerDown={(event) => event.stopPropagation()}>
          <WindowChrome
            layout={layout}
            onMinimize={() => onLayoutChange('minimized')}
            onToggleFullscreen={() =>
              onLayoutChange(layout === 'fullscreen' ? 'floating' : 'fullscreen')
            }
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      <div className="relative z-10 shrink-0 border-t border-white/10 bg-[#101114] px-4 py-3">
        <CallControls
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          screenShareEnabled={screenShareEnabled}
          showCamera={cameraControlVisible}
          showScreenShare={screenShareControlVisible}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onToggleScreenShare={onToggleScreenShare}
          onEnd={onEnd}
        />
      </div>
    </div>
  );
}
