import { useCallback, useEffect, useState } from 'react';
import { FiDownloadCloud, FiRefreshCcw, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

type UpdateState = 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error' | 'offline';

type CheckUpdatesResult = {
  ok: boolean;
  status?: 'skipped' | 'up-to-date' | 'available';
  skipped?: boolean;
  data?: { version?: string; releaseNotes?: unknown };
  error?: string;
  currentVersion?: string;
};

function formatVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

export function UpdatesSettings() {
  const [updateState, setUpdateState] = useState<UpdateState>('up-to-date');
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [latestVersion, setLatestVersion] = useState<string>('');
  const [releaseNotes, setReleaseNotes] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const isElectron = !!window.electronAPI;

  const applyCheckResult = useCallback((result: CheckUpdatesResult) => {
    if (result.currentVersion) {
      setCurrentVersion(formatVersion(result.currentVersion));
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

    if (result.status === 'available') {
      setUpdateState('available');
      if (result.data?.version) {
        setLatestVersion(formatVersion(String(result.data.version)));
      }
      if (typeof result.data?.releaseNotes === 'string') {
        setReleaseNotes(result.data.releaseNotes);
      }
      return;
    }

    if (result.status === 'up-to-date') {
      setUpdateState('up-to-date');
      if (result.data?.version) {
        setLatestVersion(formatVersion(String(result.data.version)));
      }
      return;
    }

    setUpdateState('up-to-date');
  }, []);

  const checkForUpdates = useCallback(async (showCheckingImmediately = false) => {
    if (!window.electronAPI) {
      return;
    }

    if (!navigator.onLine) {
      setUpdateState('offline');
      return;
    }

    // Only show checking state immediately if requested (e.g. manual click)
    // Otherwise, delay it to prevent flashing on fast auto-checks
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let minWaitPromise = Promise.resolve();
    
    if (showCheckingImmediately) {
      setUpdateState('checking');
      minWaitPromise = new Promise(resolve => setTimeout(resolve, 800));
    } else {
      timeout = setTimeout(() => setUpdateState('checking'), 500);
    }

    try {
      const result = (await window.electronAPI.checkForUpdates()) as CheckUpdatesResult;
      await minWaitPromise;
      if (timeout) clearTimeout(timeout);
      applyCheckResult(result);
    } catch (error) {
      await minWaitPromise;
      if (timeout) clearTimeout(timeout);
      setUpdateState('error');
      setErrorMessage('Unable to check for updates right now.');
    }
  }, [applyCheckResult]);

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
          setCurrentVersion(formatVersion(version));
        }
      } catch {
        setCurrentVersion('');
      }

      await checkForUpdates();
    };

    void init();

    const unsubChecking = api.onUpdaterEvent('checking', () => {
      setUpdateState('checking');
    });

    const unsubAvailable = api.onUpdaterEvent('update-available', (info: { version?: string; releaseNotes?: string }) => {
      setUpdateState('available');
      if (info?.version) {
        setLatestVersion(formatVersion(info.version));
      }
      if (info?.releaseNotes) {
        setReleaseNotes(info.releaseNotes);
      }
    });

    const unsubNotAvailable = api.onUpdaterEvent('update-not-available', (info: { version?: string }) => {
      setUpdateState('up-to-date');
      if (info?.version) {
        setLatestVersion(formatVersion(info.version));
      }
    });

    const unsubError = api.onUpdaterEvent('error', (payload: { message?: string } | string) => {
      const message =
        typeof payload === 'string'
          ? payload
          : typeof payload?.message === 'string'
            ? payload.message
            : '';

      setUpdateState((state) => {
        if (state !== 'checking' && state !== 'downloading') {
          return state;
        }
        if (message.trim()) {
          setErrorMessage(message.trim());
        }
        return 'error';
      });
    });

    const unsubProgress = api.onUpdaterEvent('download-progress', (progress: { percent?: number }) => {
      setUpdateState('downloading');
      setDownloadProgress(Math.floor(progress.percent || 0));
    });

    const unsubDownloaded = api.onUpdaterEvent('update-downloaded', (info: { version?: string }) => {
      setUpdateState('ready');
      if (info?.version) {
        setLatestVersion(formatVersion(info.version));
      }
    });

    return () => {
      unsubChecking();
      unsubAvailable();
      unsubNotAvailable();
      unsubError();
      unsubProgress();
      unsubDownloaded();
    };
  }, [checkForUpdates, isElectron]);

  const openReleasePage = () => {
    void window.electronAPI.openDesktopReleasePage?.();
  };

  const downloadUpdate = async () => {
    setErrorMessage('');
    setUpdateState('downloading');
    setDownloadProgress(0);
    const result = await window.electronAPI.downloadUpdate();
    if (!result.ok) {
      setUpdateState('error');
      setErrorMessage(result.error?.trim() || 'Update download failed. Try again or install from the DMG.');
    }
  };

  const restartAndInstall = () => {
    void window.electronAPI.quitAndInstallUpdate();
  };

  if (!isElectron) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-app-muted">
        Updates are managed via the browser.
      </div>
    );
  }

  const versionLabel = currentVersion || 'Unknown';

  return (
    <div className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-app-text">Update Center</h2>
        <p className="mt-1 text-sm text-app-muted">Keep FlexHubs running smoothly with the latest features.</p>
      </div>

      <div className="rounded-xl border border-app-border bg-app-surface shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              {updateState === 'checking' && <FiRefreshCcw className="text-accent animate-spin text-xl" />}
              {updateState === 'up-to-date' && <FiCheckCircle className="text-green-500 text-xl" />}
              {updateState === 'available' && <FiDownloadCloud className="text-accent text-xl" />}
              {updateState === 'downloading' && <FiDownloadCloud className="text-accent text-xl animate-pulse" />}
              {updateState === 'ready' && <FiCheckCircle className="text-accent text-xl" />}
              {updateState === 'error' && <FiAlertCircle className="text-red-500 text-xl" />}
              {updateState === 'offline' && <FiAlertCircle className="text-orange-500 text-xl" />}

              <h3 className="text-lg font-semibold text-app-text">
                {updateState === 'checking' && 'Checking for updates…'}
                {updateState === 'up-to-date' && "You're up to date."}
                {updateState === 'available' && 'New version available'}
                {updateState === 'downloading' && 'Downloading update…'}
                {updateState === 'ready' && 'FlexHubs is ready to update.'}
                {updateState === 'error' && 'Update failed'}
                {updateState === 'offline' && "You're offline"}
              </h3>
            </div>

            <div className="text-sm text-app-muted mb-6 space-y-1">
              <p>
                Current version: <span className="font-medium text-app-text">{versionLabel}</span>
              </p>
              {latestVersion && latestVersion !== currentVersion && (
                <p>
                  Latest version: <span className="font-medium text-app-text">{latestVersion}</span>
                </p>
              )}
            </div>

            {updateState === 'offline' && (
              <p className="text-sm text-app-text mb-4">
                You&apos;re currently offline. Please connect to the internet and try again.
              </p>
            )}

            {updateState === 'error' && errorMessage && (
              <p className="text-sm text-app-text mb-4">{errorMessage}</p>
            )}

            {updateState === 'available' && releaseNotes && (
              <div className="mb-6 bg-app-chat-bg/50 border border-app-border rounded-xl p-4">
                <h4 className="text-sm font-semibold text-app-text mb-2">What&apos;s New in {latestVersion}</h4>
                <div
                  className="text-sm text-app-text prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: releaseNotes }}
                />
              </div>
            )}

            {updateState === 'downloading' && (
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-app-muted">Downloading…</span>
                  <span className="font-medium text-accent">{downloadProgress}%</span>
                </div>
                <div className="h-2 w-full bg-app-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              {(updateState === 'checking' || updateState === 'up-to-date' || updateState === 'error' || updateState === 'offline') && (
                <button
                  type="button"
                  onClick={() => void checkForUpdates(true)}
                  disabled={updateState === 'checking'}
                  className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
                    updateState === 'checking'
                      ? 'bg-app-chat-hover/50 text-app-muted cursor-not-allowed'
                      : 'bg-app-chat-hover text-app-text hover:bg-app-border'
                  }`}
                >
                  {updateState === 'error' ? 'Retry' : updateState === 'checking' ? 'Checking...' : 'Check for Updates'}
                </button>
              )}

              {updateState === 'error' && (
                <button
                  type="button"
                  onClick={openReleasePage}
                  className="rounded-xl border border-app-border bg-app-surface px-5 py-2.5 text-sm font-medium text-app-text transition-colors hover:bg-app-chat-hover"
                >
                  Install from GitHub
                </button>
              )}

              {updateState === 'available' && (
                <button
                  type="button"
                  onClick={downloadUpdate}
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover shadow-md"
                >
                  Download Update
                </button>
              )}

              {updateState === 'ready' && (
                <>
                  <button
                    type="button"
                    onClick={restartAndInstall}
                    className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover shadow-md"
                  >
                    Restart & Install
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateState('up-to-date')}
                    className="rounded-xl bg-app-chat-hover px-5 py-2.5 text-sm font-medium text-app-text transition-colors hover:bg-app-border"
                  >
                    Later
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
