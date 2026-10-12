import type { ReactNode } from 'react';
import { FiChevronDown, FiMic, FiPhone, FiPhoneOff, FiVolume2, FiX } from 'react-icons/fi';
import type { CallSession } from '../callManager';
import { useCallRingingDevices } from './useCallRingingDevices';

type CallRingingViewProps = {
  session: CallSession;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
};

function DeviceSelect({
  id,
  value,
  onChange,
  disabled,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-lg border border-app-border bg-app-surface py-2 pl-3 pr-8 text-xs text-app-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {children}
      </select>
      <FiChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-muted"
        aria-hidden
      />
    </div>
  );
}

export function CallRingingView({
  session,
  busy,
  onAccept,
  onReject,
  onCancel,
}: CallRingingViewProps) {
  const title = session.peerLabel || 'Call';
  const initial = title.slice(0, 1).toUpperCase() || '?';
  const phase = session.phase;
  const isIncomingCallee =
    (phase === 'incoming' || phase === 'connecting') && !session.isInitiator;
  const isOutgoingCaller = phase === 'outgoing' || (phase === 'connecting' && session.isInitiator);

  const showDevicePanel = phase === 'incoming' || phase === 'outgoing';

  const {
    micAccess,
    audioInputs,
    audioOutputs,
    selectedInputId,
    selectedOutputId,
    onInputChange,
    onOutputChange,
    labelForAudioInputDevice,
    labelForAudioOutputDevice,
  } = useCallRingingDevices(showDevicePanel);

  const statusLabel =
    phase === 'connecting'
      ? 'Connecting...'
      : isIncomingCallee
        ? session.video
          ? 'Incoming video call'
          : 'Incoming voice call'
        : isOutgoingCaller
          ? 'Calling'
          : 'In call';

  const showMicReadyBadge = micAccess === 'ready';
  const deviceControlsDisabled = busy || phase === 'connecting';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex justify-end px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-4 sm:pb-3 sm:pt-[max(1rem,env(safe-area-inset-top,0px))]">
      <div
        className="pointer-events-auto w-full max-w-[min(100%,22rem)] overflow-hidden rounded-2xl border border-app-border bg-app-elevated shadow-app animate-in slide-in-from-top-2 fade-in duration-200"
        role="dialog"
        aria-label={statusLabel}
      >
        <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
          <div className="relative shrink-0">
            {isIncomingCallee || isOutgoingCaller ? (
              <span
                className="absolute -inset-1 rounded-full bg-accent/15 animate-pulse"
                aria-hidden="true"
              />
            ) : null}
            {session.peerAvatar ? (
              <img
                src={session.peerAvatar}
                alt=""
                className="relative h-11 w-11 rounded-full border border-app-border object-cover"
              />
            ) : (
              <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent-soft">
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-sm font-semibold text-app-text">{title}</p>
            <p className="mt-0.5 text-xs text-app-muted">{statusLabel}</p>
          </div>

          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1.5 text-app-muted hover:bg-app-chat-hover hover:text-app-text"
            onClick={isIncomingCallee ? onReject : onCancel}
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {showDevicePanel ? (
          <div className="space-y-3 border-t border-app-border px-3 py-3 sm:px-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-app-text">
                  <FiMic className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  Microphone
                </div>
                {showMicReadyBadge ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    Ready
                  </span>
                ) : null}
              </div>
              <DeviceSelect
                id="call-ringing-mic"
                value={selectedInputId}
                disabled={deviceControlsDisabled}
                onChange={onInputChange}
              >
                <option value="default">System Default Mic</option>
                {audioInputs.map((device, index) => (
                  <option key={device.deviceId || `input-${index}`} value={device.deviceId}>
                    {labelForAudioInputDevice(device, index)}
                  </option>
                ))}
              </DeviceSelect>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-app-text">
                <FiVolume2 className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                Speaker
              </div>
              <DeviceSelect
                id="call-ringing-speaker"
                value={selectedOutputId}
                disabled={deviceControlsDisabled}
                onChange={onOutputChange}
              >
                <option value="default">System Default Speaker</option>
                {audioOutputs.map((device, index) => (
                  <option key={device.deviceId || `output-${index}`} value={device.deviceId}>
                    {labelForAudioOutputDevice(device, index)}
                  </option>
                ))}
              </DeviceSelect>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-app-border px-3 py-2.5 sm:px-4">
          {isIncomingCallee && phase === 'incoming' ? (
            <>
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                onClick={onAccept}
              >
                <FiPhone className="h-3.5 w-3.5" />
                Accept
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                onClick={onReject}
              >
                <FiPhoneOff className="h-3.5 w-3.5" />
                Decline
              </button>
            </>
          ) : null}

          {isIncomingCallee && phase === 'connecting' ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
              onClick={onReject}
            >
              <FiPhoneOff className="h-3.5 w-3.5" />
              Cancel
            </button>
          ) : null}

          {isOutgoingCaller ? (
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3 py-2.5 text-xs font-semibold text-white hover:opacity-90 sm:w-auto"
              onClick={onCancel}
            >
              <FiPhoneOff className="h-3.5 w-3.5" />
              {phase === 'outgoing' ? 'Cancel call' : 'End call'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
