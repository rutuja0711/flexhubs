export type ScreenCaptureSourceKind = 'screen' | 'window';

export type ScreenCaptureSource = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  kind: ScreenCaptureSourceKind;
};
