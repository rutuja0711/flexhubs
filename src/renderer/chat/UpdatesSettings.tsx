import { useCallback, useEffect, useRef, useState } from 'react';
import { FiDownloadCloud, FiRefreshCcw, FiCheckCircle, FiAlertCircle, FiPause, FiPlay } from 'react-icons/fi';

type UpdateState =
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'paused'
  | 'ready'
  | 'error'
  | 'offline';

type CheckUpdatesResult = {
  ok: boolean;
  status?: 'skipped' | 'up-to-date' | 'available' | 'ready';
  skipped?: boolean;
  data?: { version?: string; releaseNotes?: unknown };
  error?: string;
  currentVersion?: string;
};

const AUTO_RESTART_MINUTES = 15;
const DEFERRED_RESTART_STORAGE_PREFIX = 'flexhubs-update-deferred-restart:';

function deferredRestartStorageKey(version: string): string {
  return `${DEFERRED_RESTART_STORAGE_PREFIX}${version.trim()}`;
}

function readDeferredRestartChoice(version: string): boolean {
  try {
    return sessionStorage.getItem(deferredRestartStorageKey(version)) === '1';
  } catch {
    return false;
  }
}

function writeDeferredRestartChoice(version: string, deferred: boolean): void {
  try {
    const key = deferredRestartStorageKey(version);

    if (deferred) {
      sessionStorage.setItem(key, '1');
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function formatVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

function parseVersionParts(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => {
      const match = part.match(/^\d+/);
      return match ? Number(match[0]) : 0;
    });
}

function isVersionNewer(latest: string, current: string): boolean {
  const a = parseVersionParts(latest);
  const b = parseVersionParts(current);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left > right) {
      return true;
    }
    if (left < right) {
      return false;
    }
  }

  return false;
}

function normalizeReleaseNotes(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }
        if (entry && typeof entry === 'object' && 'note' in entry) {
          return String((entry as { note?: string }).note ?? '');
        }
        return '';
      })
      .filter(Boolean)
      .join('');

    if (joined.trim()) {
      return joined;
    }
  }

  return '';
}

export function UpdatesSettings() {
  const [updateState, setUpdateState] = useState<UpdateState>('up-to-date');
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [latestVersion, setLatestVersion] = useState<string>('');
  const [releaseNotes, setReleaseNotes] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [legacyInstallerUpdater, setLegacyInstallerUpdater] = useState(false);
  const [restartModalOpen, setRestartModalOpen] = useState(false);
  const [deferredRestartActive, setDeferredRestartActive] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const isElectron = !!window.electronAPI;
  const currentVersionRef = useRef('');
  const updateStateRef = useRef<UpdateState>('up-to-date');
  const checkInFlightRef = useRef(false);
  const checkRequestIdRef = useRef(0);

  useEffect(() => {
    currentVersionRef.current = currentVersion;
  }, [currentVersion]);

  useEffect(() => {
    updateStateRef.current = updateState;
  }, [updateState]);

  const openRestartModal = useCallback((targetVersion?: string) => {
    const version = targetVersion?.trim() || latestVersion.trim();

    if (version && readDeferredRestartChoice(version)) {
      setDeferredRestartActive(true);
      setRestartModalOpen(false);
      return;
    }

    setRestartModalOpen(true);
  }, [latestVersion]);

  const applyCheckResult = useCallback((result: CheckUpdatesResult) => {
    if (result.currentVersion) {
      setCurrentVersion(formatVersion(result.currentVersion));
    }

    const activeDownloadState =
      updateStateRef.current === 'downloading' || updateStateRef.current === 'paused';

    if (activeDownloadState && result.status !== 'ready') {
      if (result.data?.version) {
        setLatestVersion(formatVersion(String(result.data.version)));
      }
      const notes = normalizeReleaseNotes(result.data?.releaseNotes);
      if (notes) {
        setReleaseNotes(notes);
      }
      return;
    }

    if (!result.ok) {
      setUpdateState('error');
      setErrorMessage(result.error?.trim() || 'Unable to check for updates right now.');
      return;
    }

    setErrorMessage('');

    if (result.status === 'skipped' || result.skipped) {
      setUpdateState('up-to-date');
      return;
    }

    if (result.status === 'ready') {
      setUpdateState('ready');
      if (result.data?.version) {
        setLatestVersion(formatVersion(String(result.data.version)));
      }
      openRestartModal(
        result.data?.version ? formatVersion(String(result.data.version)) : latestVersion,
      );
      return;
    }

    if (result.status === 'available') {
      const latest = result.data?.version ? formatVersion(String(result.data.version)) : '';
      const current = result.currentVersion
        ? formatVersion(result.currentVersion)
        : currentVersionRef.current;

      if (!latest || !isVersionNewer(latest, current)) {
        setUpdateState('up-to-date');
        setLatestVersion(current);
        return;
      }

      setUpdateState('available');
      setLatestVersion(latest);
      const notes = normalizeReleaseNotes(result.data?.releaseNotes);
      if (notes) {
        setReleaseNotes(notes);
      }
      return;
    }

    if (result.status === 'up-to-date') {
      setUpdateState('up-to-date');
      if (result.data?.version) {
        setLatestVersion(formatVersion(String(result.data.version)));
      } else if (result.currentVersion) {
        setLatestVersion(formatVersion(result.currentVersion));
      }
      return;
    }

    setUpdateState('up-to-date');
  }, [openRestartModal]);

  const syncDownloadStatus = useCallback(async () => {
    const status = await window.electronAPI.getUpdateDownloadStatus?.();
    if (!status) {
      return;
    }

    if (status.paused || status.phase === 'paused') {
      setUpdateState('paused');
      setDownloadProgress(status.progress);
      if (status.version) {
        setLatestVersion(formatVersion(status.version));
      }
      return;
    }

    if (status.phase === 'downloading') {
      setUpdateState('downloading');
      setDownloadProgress(status.progress);
      if (status.version) {
        setLatestVersion(formatVersion(status.version));
      }
    }
  }, []);

  const checkForUpdates = useCallback(async (showCheckingImmediately = false) => {
    if (!window.electronAPI) {
      return;
    }

    if (checkInFlightRef.current) {
      return;
    }

    if (!navigator.onLine) {
      setUpdateState('offline');
      return;
    }

    const requestId = checkRequestIdRef.current + 1;
    checkRequestIdRef.current = requestId;
    checkInFlightRef.current = true;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let minWaitPromise = Promise.resolve();

    if (showCheckingImmediately) {
      setUpdateState('checking');
      minWaitPromise = new Promise((resolve) => setTimeout(resolve, 400));
    } else {
      timeout = setTimeout(() => {
        if (checkRequestIdRef.current === requestId) {
          setUpdateState('checking');
        }
      }, 600);
    }

    try {
      const result = (await window.electronAPI.checkForUpdates()) as CheckUpdatesResult;
      await minWaitPromise;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (checkRequestIdRef.current !== requestId) {
        return;
      }
      applyCheckResult(result);
      await syncDownloadStatus();
    } catch {
      await minWaitPromise;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (checkRequestIdRef.current !== requestId) {
        return;
      }
      setUpdateState('error');
      setErrorMessage('Unable to check for updates right now.');
    } finally {
      if (checkRequestIdRef.current === requestId) {
        checkInFlightRef.current = false;
      }
    }
  }, [applyCheckResult, syncDownloadStatus]);

  const retryUpdateCheck = useCallback(async () => {
    setErrorMessage('');
    await window.electronAPI.resetUpdateDownloadState?.();
    setDownloadProgress(0);
    await checkForUpdates(true);
  }, [checkForUpdates]);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) {
      setUpdateState('offline');
      return;
    }

    const api = window.electronAPI;

    const init = async () => {
      try {
        const version = await api.getAppVersion();
        if (typeof version === 'string' && version.trim()) {
          const formatted = formatVersion(version);
          setCurrentVersion(formatted);
          setLatestVersion((current) => current || formatted);
        }
      } catch {
        setCurrentVersion('');
      }

      try {
        const capabilities = await api.getUpdaterCapabilities?.();
        setLegacyInstallerUpdater(capabilities?.inAppPatchOnly !== true);
      } catch {
        setLegacyInstallerUpdater(true);
      }

      try {
        const pending = await api.getPendingUpdateInstall?.();
        if (pending?.ready && pending.version) {
          const pendingVersion = formatVersion(pending.version);
          setUpdateState('ready');
          setLatestVersion(pendingVersion);

          const scheduled = await api.isDeferredUpdateRestartScheduled?.();
          if (scheduled?.scheduled) {
            setDeferredRestartActive(true);
          }

          openRestartModal(pendingVersion);
          return;
        }
      } catch {
        // Fall through to normal update check.
      }

      await syncDownloadStatus();
      await checkForUpdates(true);
    };

    void init();

    const unsubChecking = api.onUpdaterEvent('checking', () => {
      if (checkInFlightRef.current) {
        setUpdateState('checking');
      }
    });

    const unsubAvailable = api.onUpdaterEvent('update-available', (info: { version?: string; releaseNotes?: string }) => {
      const latest = info?.version ? formatVersion(info.version) : '';
      const current = currentVersionRef.current;

      if (!latest || !isVersionNewer(latest, current)) {
        return;
      }

      setUpdateState('available');
      setLatestVersion(latest);
      const notes = normalizeReleaseNotes(info?.releaseNotes);
      if (notes) {
        setReleaseNotes(notes);
      }
    });

    const unsubNotAvailable = api.onUpdaterEvent('update-not-available', (info: { version?: string }) => {
      setUpdateState('up-to-date');
      if (info?.version) {
        setLatestVersion(formatVersion(info.version));
      }
    });

    const unsubProgress = api.onUpdaterEvent('download-progress', (progress: { percent?: number }) => {
      setUpdateState('downloading');
      setDownloadProgress(Math.floor(progress.percent || 0));
    });

    const unsubPaused = api.onUpdaterEvent('download-paused', (payload: { progress?: number; version?: string }) => {
      setUpdateState('paused');
      setDownloadProgress(Math.floor(payload?.progress || 0));
      if (payload?.version) {
        setLatestVersion(formatVersion(payload.version));
      }
    });

    const unsubDownloaded = api.onUpdaterEvent('update-downloaded', (info: { version?: string }) => {
      setUpdateState('ready');
      setErrorMessage('');
      setDownloadProgress(100);
      if (info?.version) {
        setLatestVersion(formatVersion(info.version));
      }
      openRestartModal(info?.version ? formatVersion(info.version) : undefined);
    });

    const unsubError = api.onUpdaterEvent('error', (payload: { error?: string }) => {
      if (typeof payload?.error === 'string' && payload.error.trim()) {
        setUpdateState('error');
        setErrorMessage(payload.error.trim());
      }
    });

    return () => {
      unsubChecking();
      unsubAvailable();
      unsubNotAvailable();
      unsubProgress();
      unsubPaused();
      unsubDownloaded();
      unsubError();
    };
  }, [checkForUpdates, isElectron, openRestartModal, syncDownloadStatus]);

  useEffect(() => {
    if (updateState !== 'checking') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (updateStateRef.current !== 'checking') {
        return;
      }

      checkInFlightRef.current = false;
      setUpdateState('up-to-date');
      setErrorMessage('');
    }, 50_000);

    return () => window.clearTimeout(timeoutId);
  }, [updateState]);

  const openReleasePage = () => {
    void window.electronAPI.openDesktopReleasePage?.();
  };

  const downloadUpdate = async () => {
    setErrorMessage('');
    setUpdateState('downloading');
    setDownloadProgress(0);
    const result = await window.electronAPI.downloadUpdate();
    if (result.paused) {
      setUpdateState('paused');
      return;
    }
    if (!result.ok) {
      setUpdateState('error');
      setErrorMessage(result.error?.trim() || 'Update download failed. Try again or use Manual download.');
      return;
    }

    setUpdateState('ready');
    openRestartModal(latestVersion);
  };

  const pauseDownload = async () => {
    setErrorMessage('');
    const result = await window.electronAPI.pauseUpdateDownload?.();
    if (!result?.ok) {
      setErrorMessage(result?.error?.trim() || 'Could not pause the download.');
    }
  };

  const resumeDownload = async () => {
    if (resumeBusy) {
      return;
    }

    setResumeBusy(true);
    setErrorMessage('');
    setUpdateState('downloading');

    try {
      const resume = window.electronAPI.resumeUpdateDownload;
      const result = resume
        ? await resume()
        : await window.electronAPI.downloadUpdate();

      if (result?.paused) {
        setUpdateState('paused');
        return;
      }

      if (!result?.ok) {
        setUpdateState('paused');
        setErrorMessage(result?.error?.trim() || 'Could not resume the download.');
        return;
      }

      setUpdateState('ready');
      openRestartModal(latestVersion);
    } finally {
      setResumeBusy(false);
    }
  };

  const restartDownloadFromScratch = async () => {
    setErrorMessage('');
    await window.electronAPI.resetUpdateDownloadState?.();
    setDownloadProgress(0);
    setUpdateState('available');
    await downloadUpdate();
  };

  const restartNow = async () => {
    setErrorMessage('');
    writeDeferredRestartChoice(latestVersion, false);
    await window.electronAPI.cancelDeferredUpdateRestart?.();
    setDeferredRestartActive(false);
    setRestartModalOpen(false);

    const result = await window.electronAPI.quitAndInstallUpdate();

    if (result && result.ok === false) {
      setUpdateState('ready');
      setErrorMessage(result.error?.trim() || 'Could not restart to apply the update.');
      openRestartModal(latestVersion);
    }
  };

  const restartLater = async () => {
    setErrorMessage('');
    writeDeferredRestartChoice(latestVersion, true);
    await window.electronAPI.scheduleDeferredUpdateRestart?.();
    setDeferredRestartActive(true);
    setRestartModalOpen(false);
  };

  if (!isElectron) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-app-muted">
        Updates are managed via the browser.
      </div>
    );
  }

  const versionLabel = currentVersion || 'Unknown';
  const latestLabel = latestVersion || versionLabel;
  const showDownloadAction = updateState === 'available';
  const showPauseAction = updateState === 'downloading';
  const showResumeAction = updateState === 'paused';
  const hasUpdate =
    Boolean(latestVersion && currentVersion) && isVersionNewer(latestVersion, currentVersion);

  const whatsNewTitle = hasUpdate
    ? `What's new in ${latestLabel}`
    : `What's new in ${latestLabel}`;

  return (
    <div className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-app-text">
          Update Center flexhubs  <span className="font-semibold text-app-muted">({versionLabel})</span>
        </h2>
        <p className="mt-2 text-sm text-app-muted">
          Latest version: <span className="font-medium text-app-text">{latestLabel}</span>
        </p>
      </div>

      {legacyInstallerUpdater ? (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-app-text">
          This build uses an older update flow. Use <strong>Manual download</strong> once to install the latest
          version, then in-app updates will work normally.
        </div>
      ) : null}

      <div className="rounded-xl border border-app-border bg-app-surface p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-3">
          {updateState === 'checking' && <FiRefreshCcw className="animate-spin text-xl text-accent" />}
          {updateState === 'up-to-date' && <FiCheckCircle className="text-xl text-green-500" />}
          {(updateState === 'available' || updateState === 'downloading' || updateState === 'paused') && (
            <FiDownloadCloud className={`text-xl text-accent ${updateState === 'downloading' ? 'animate-pulse' : ''}`} />
          )}
          {updateState === 'ready' && <FiCheckCircle className="text-xl text-accent" />}
          {updateState === 'error' && <FiAlertCircle className="text-xl text-red-500" />}
          {updateState === 'offline' && <FiAlertCircle className="text-xl text-orange-500" />}

          <p className="text-sm font-medium text-app-text">
            {updateState === 'checking' && 'Checking for updates…'}
            {updateState === 'up-to-date' && "You're up to date."}
            {updateState === 'available' && 'A new update is ready to download.'}
            {updateState === 'downloading' && 'Downloading and installing update…'}
            {updateState === 'paused' && 'Update download paused.'}
            {updateState === 'ready' && 'Update installed — restart when you are ready.'}
            {updateState === 'error' && 'Update failed'}
            {updateState === 'offline' && "You're offline"}
          </p>
        </div>

        {updateState === 'offline' && (
          <p className="mb-4 text-sm text-app-text">
            You&apos;re currently offline. Connect to the internet and check again.
          </p>
        )}

        {updateState === 'error' && errorMessage && (
          <p className="mb-4 text-sm text-app-text">{errorMessage}</p>
        )}

        {updateState === 'paused' && errorMessage && (
          <p className="mb-4 text-sm text-red-400">{errorMessage}</p>
        )}

        {(updateState === 'downloading' || updateState === 'paused') && (
          <div className="mb-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-app-muted">
                {updateState === 'paused' ? 'Paused' : 'Download progress'}
              </span>
              <div className="flex items-center gap-2">
                {showPauseAction && (
                  <button
                    type="button"
                    onClick={() => void pauseDownload()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-xs font-medium text-app-text transition-colors hover:bg-app-chat-hover"
                  >
                    <FiPause aria-hidden />
                    Pause
                  </button>
                )}
                {showResumeAction && (
                  <button
                    type="button"
                    disabled={resumeBusy}
                    onClick={() => void resumeDownload()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiPlay aria-hidden />
                    {resumeBusy ? 'Resuming…' : 'Resume'}
                  </button>
                )}
                <span className="font-medium text-accent">{downloadProgress}%</span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-app-border">
              <div
                className="h-full bg-accent transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            {updateState === 'paused' ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-app-muted">
                  Progress is saved on this device. Resume continues the download (the bar may restart while the
                  cached file is reused).
                </p>
                <button
                  type="button"
                  onClick={() => void restartDownloadFromScratch()}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Restart download from 0%
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-app-muted">
                The update installs while it downloads. You&apos;ll be asked to restart when it&apos;s done.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 rounded-xl border border-app-border bg-app-chat-bg/50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-app-text">{whatsNewTitle}</h3>
            {releaseNotes ? (
              <div
                className="prose prose-sm prose-invert max-w-none text-sm text-app-text"
                dangerouslySetInnerHTML={{ __html: releaseNotes }}
              />
            ) : (
              <p className="text-sm text-app-muted">
                {hasUpdate
                  ? 'Release notes for this version will appear here when available.'
                  : 'You already have the latest improvements for this version.'}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2 md:w-44">
            {showDownloadAction && (
              <button
                type="button"
                onClick={() => void downloadUpdate()}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-accent-hover"
              >
                Download
              </button>
            )}

          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {(updateState === 'checking' ||
            updateState === 'up-to-date' ||
            updateState === 'error' ||
            updateState === 'offline' ||
            updateState === 'available') && (
            <button
              type="button"
              onClick={() => (updateState === 'error' ? void retryUpdateCheck() : void checkForUpdates(true))}
              disabled={updateState === 'checking'}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
                updateState === 'checking'
                  ? 'cursor-not-allowed bg-app-chat-hover/50 text-app-muted'
                  : 'bg-app-chat-hover text-app-text hover:bg-app-border'
              }`}
            >
              {updateState === 'error' ? 'Retry' : updateState === 'checking' ? 'Checking…' : 'Check for updates'}
            </button>
          )}

          {updateState === 'error' && (
            <button
              type="button"
              onClick={openReleasePage}
              className="rounded-xl border border-app-border bg-app-surface px-5 py-2.5 text-sm font-medium text-app-text transition-colors hover:bg-app-chat-hover"
            >
              Manual download
            </button>
          )}

          {updateState === 'ready' && (
            <>
              <button
                type="button"
                onClick={() => void restartNow()}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-accent-hover"
              >
                Restart now
              </button>
              {!deferredRestartActive ? (
                <button
                  type="button"
                  onClick={() => void restartLater()}
                  className="rounded-xl bg-app-chat-hover px-5 py-2.5 text-sm font-medium text-app-text transition-colors hover:bg-app-border"
                >
                  Later
                </button>
              ) : null}
            </>
          )}

        </div>

        {deferredRestartActive && updateState === 'ready' && (
          <p className="mt-3 text-xs text-app-muted">
            FlexHubs will restart automatically in {AUTO_RESTART_MINUTES} minutes to apply the update.
          </p>
        )}
      </div>

      {restartModalOpen && updateState === 'ready' ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-restart-title"
          >
            <h3 id="update-restart-title" className="text-lg font-semibold text-app-text">
              Restart to finish
            </h3>
            <p className="mt-2 text-sm text-app-muted">
              {latestLabel} is downloaded and installed. Restart FlexHubs to start using it.
            </p>
            <p className="mt-3 text-sm text-app-text">
              Choose <strong>Later</strong> to keep working — the app will restart automatically in{' '}
              {AUTO_RESTART_MINUTES} minutes.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => void restartLater()}
                className="rounded-xl bg-app-chat-hover px-5 py-2.5 text-sm font-medium text-app-text transition-colors hover:bg-app-border"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => void restartNow()}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-accent-hover"
              >
                Restart now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
