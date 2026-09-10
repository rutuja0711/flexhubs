import path from 'node:path';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';

const isDarwinHost = process.platform === 'darwin';
const isWindowsHost = process.platform === 'win32';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: isWindowsHost
      ? path.join(__dirname, 'assets', 'icon.ico')
      : path.join(__dirname, 'assets', 'icon.png'),
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
            name: 'FlexHubsDesktop',
            authors: 'Flexodyn Solutions',
            description: 'FlexHubs Desktop',
            setupExe: 'FlexHubs-Desktop-Setup.exe',
            setupIcon: path.join(__dirname, 'assets', 'icon.ico'),
            noMsi: true,
          }),
        ]
      : []),
    // Mac only — Windows portable zips trigger Chrome "Dangerous download blocked"
    // (unsigned .exe inside a zip). Windows testers use FlexHubs-Desktop-Setup.exe.
    new MakerZIP({}, ['darwin']),
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
