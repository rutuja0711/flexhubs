import { useCallback, useEffect, useState } from 'react';
import { FiLayout, FiMonitor, FiX } from 'react-icons/fi';
import type { ScreenCaptureSource, ScreenCaptureSourceKind } from '../../shared/screenShare';
import { listScreenCaptureSources } from '../screenShareApi';

type ScreenSharePickerProps = {
  open: boolean;
  onClose: () => void;
  onShare: (source: ScreenCaptureSource) => void;
};

type PickerStep = 'choose-type' | 'pick-source';

export function ScreenSharePicker({ open, onClose, onShare }: ScreenSharePickerProps) {
  const [step, setStep] = useState<PickerStep>('choose-type');
  const [sourceKind, setSourceKind] = useState<ScreenCaptureSourceKind>('screen');
  const [sources, setSources] = useState<ScreenCaptureSource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setStep('choose-type');
    setSourceKind('screen');
    setSources([]);
    setSelectedId(null);
    setLoading(false);
    setError('');
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const loadSources = useCallback(async (kind: ScreenCaptureSourceKind) => {
    setLoading(true);
    setError('');
    setSelectedId(null);

    const result = await listScreenCaptureSources(kind);

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSources(result.data);

    if (result.data.length === 0) {
      setError(
        kind === 'screen'
          ? 'No displays were found. Check Screen Recording permission in System Settings.'
          : 'No application windows were found.',
      );
    }
  }, []);

  const handleChooseType = (kind: ScreenCaptureSourceKind) => {
    setSourceKind(kind);
    setStep('pick-source');
    void loadSources(kind);
  };

  const handleShare = () => {
    const source = sources.find((item) => item.id === selectedId);

    if (!source) {
      return;
    }

    onShare(source);
  };

  const friendlyError =
    error && /screen recording|screen capture|permission|enable/i.test(error)
      ? 'Enable Screen Recording in System Settings → Privacy & Security, then try again.'
      : error;

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close screen share picker"
        className="fixed inset-0 z-[99998] bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="pointer-events-auto fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[99999] w-[min(calc(100vw-1.5rem),24rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#101114] shadow-[0_16px_48px_rgba(0,0,0,0.45)] sm:right-4">
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Share your screen</h2>
            <p className="mt-1 text-sm text-white/55">
              {step === 'choose-type'
                ? 'Choose what you want others to see'
                : sourceKind === 'screen'
                  ? 'Select a display to share'
                  : 'Select a window to share'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close screen share picker"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <FiX />
          </button>
        </div>

        {step === 'choose-type' ? (
          <div className="space-y-2 p-3">
            <button
              type="button"
              className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/5"
              onClick={() => handleChooseType('screen')}
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white">
                <FiMonitor className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">Entire screen</span>
                <span className="block text-xs text-white/55">Share your full display</span>
              </span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/5"
              onClick={() => handleChooseType('window')}
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white">
                <FiLayout className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">Application window</span>
                <span className="block text-xs text-white/55">Share one app or browser tab</span>
              </span>
            </button>
          </div>
        ) : (
          <div className="p-4">
            <button
              type="button"
              className="mb-3 text-xs font-medium text-white/60 hover:text-white"
              onClick={() => {
                setStep('choose-type');
                setSources([]);
                setSelectedId(null);
                setError('');
              }}
            >
              ← Back
            </button>

            {loading ? (
              <p className="py-8 text-center text-sm text-white/55">Loading sources...</p>
            ) : friendlyError ? (
              <p className="py-6 text-center text-sm leading-relaxed text-red-300/95">{friendlyError}</p>
            ) : (
              <div className="grid max-h-[min(360px,50vh)] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                {sources.map((source) => {
                  const selected = selectedId === source.id;

                  return (
                    <button
                      key={source.id}
                      type="button"
                      className={`overflow-hidden rounded-xl border text-left transition-colors ${
                        selected
                          ? 'border-accent bg-accent/10 ring-2 ring-accent/40'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                      onClick={() => setSelectedId(source.id)}
                    >
                      <div className="aspect-video w-full overflow-hidden bg-black/40">
                        {source.thumbnailDataUrl ? (
                          <img
                            src={source.thumbnailDataUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-white/40">
                            No preview
                          </div>
                        )}
                      </div>
                      <p className="truncate px-2 py-2 text-xs font-medium text-white">{source.name}</p>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedId || loading}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleShare}
              >
                Share
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
