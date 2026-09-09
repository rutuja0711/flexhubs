import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';

const isWindowsHost = process.platform === 'win32';
const isDarwinHost = process.platform === 'darwin';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    ...(isDarwinHost
      ? {
          arch: 'universal' as const,
          osxUniversal: {
            minimumSystemVersion: '11.0.0',
          },
        }
      : {
          arch: 'x64' as const,
        }),
    extendInfo: {
      NSMicrophoneUsageDescription: 'FlexHubs needs microphone access for voice and video calls.',
      NSCameraUsageDescription: 'FlexHubs needs camera access for video calls.',
      NSScreenCaptureUsageDescription: 'FlexHubs needs screen recording access to share your screen during calls.',
    },
  },
  rebuildConfig: {},
  makers: [
    ...(isWindowsHost
      ? [
          new MakerSquirrel({
            authors: 'Flexodyn Solutions',
          }),
        ]
      : []),
    new MakerZIP({}, ['darwin', 'win32']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
