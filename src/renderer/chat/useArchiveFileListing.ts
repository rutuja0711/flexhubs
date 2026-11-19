import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { fetchMediaBlob } from '../mediaBlob';

const MAX_ARCHIVE_ENTRIES = 200;

export type ArchiveListingState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; entries: string[]; truncated: boolean }
  | { status: 'error'; message: string }
  | { status: 'unsupported' };

export function useArchiveFileListing(
  mediaUrl: string | null | undefined,
  enabled: boolean,
): ArchiveListingState {
  const [state, setState] = useState<ArchiveListingState>({ status: 'idle' });

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }

    const url = mediaUrl?.trim();
    if (!url) {
      setState({ status: 'unsupported' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    const load = async () => {
      try {
        const blob = await fetchMediaBlob(url);
        const zip = await JSZip.loadAsync(blob);
        const paths = Object.keys(zip.files)
          .filter((path) => !zip.files[path].dir)
          .sort((a, b) => a.localeCompare(b));

        if (cancelled) {
          return;
        }

        const truncated = paths.length > MAX_ARCHIVE_ENTRIES;
        setState({
          status: 'ready',
          entries: paths.slice(0, MAX_ARCHIVE_ENTRIES),
          truncated,
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Could not read archive.',
          });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, mediaUrl]);

  return state;
}