import { useEffect, useState } from 'react';
import { normalizeUploadUrl } from '../../shared/profile';
import {
  canStreamHostedMediaInDesktop,
  isFlexHubsHostedAssetUrl,
  resolveAuthenticatedMediaUrl,
  resolveStreamingMediaDisplayUrl,
} from '../authenticatedMedia';
import { fetchMediaBlob } from '../mediaBlob';

export type AttachmentDisplayKind = 'image' | 'video' | 'audio' | 'pdf';

function isDirectUrl(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:');
}

/** Resolves flexhubs.in attachments to blob/object URLs safe for iframe, img, video, and audio. */
export function useAttachmentDisplayUrl(
  mediaUrl: string | null | undefined,
  localFile: File | null | undefined,
  kind: AttachmentDisplayKind,
  enabled: boolean,
): { displayUrl: string | null; loading: boolean; failed: boolean } {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisplayUrl(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    let revokeUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setFailed(false);
      setDisplayUrl(null);

      try {
        if (localFile) {
          const objectUrl = URL.createObjectURL(localFile);
          revokeUrl = objectUrl;
          if (!cancelled) {
            setDisplayUrl(objectUrl);
          }
          return;
        }

        const raw = mediaUrl?.trim();
        if (!raw) {
          if (!cancelled) {
            setFailed(true);
          }
          return;
        }

        if (isDirectUrl(raw)) {
          if (!cancelled) {
            setDisplayUrl(raw);
          }
          return;
        }

        const normalized = normalizeUploadUrl(raw);

        if (kind === 'pdf') {
          const blob = await fetchMediaBlob(normalized);
          if (cancelled) {
            return;
          }
          const pdfBlob =
            blob.type === 'application/pdf' || blob.type === 'application/octet-stream'
              ? new Blob([blob], { type: 'application/pdf' })
              : blob;
          const objectUrl = URL.createObjectURL(pdfBlob);
          revokeUrl = objectUrl;
          setDisplayUrl(objectUrl);
          return;
        }

        if (kind === 'video' && canStreamHostedMediaInDesktop() && isFlexHubsHostedAssetUrl(normalized)) {
          const streamUrl = resolveStreamingMediaDisplayUrl(normalized);
          if (streamUrl) {
            if (!cancelled) {
              setDisplayUrl(streamUrl);
            }
            return;
          }
        }

        if (kind === 'image' || kind === 'video' || kind === 'audio') {
          if (!isFlexHubsHostedAssetUrl(normalized)) {
            if (!cancelled) {
              setDisplayUrl(normalized);
            }
            return;
          }

          const resolved = await resolveAuthenticatedMediaUrl(normalized);
          if (!cancelled) {
            setDisplayUrl(resolved);
          }
          return;
        }

        const blob = await fetchMediaBlob(normalized);
        if (cancelled) {
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        revokeUrl = objectUrl;
        setDisplayUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setDisplayUrl(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (revokeUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(revokeUrl);
      }
    };
  }, [enabled, kind, localFile, mediaUrl]);

  return { displayUrl, loading, failed };
}