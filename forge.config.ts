import path from 'node:path';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerWix } from '@electron-forge/maker-wix';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';

/** Stable ID so Windows can upgrade in-place across MSI releases. */
const FLEXHUBS_MSI_UPGRADE_CODE = 'f8e3c2b1-9a47-4d6e-8f5c-2b1a0d9e8f7c';

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
          new MakerWix({
            manufacturer: 'Flexodyn Solutions',
            description: 'FlexHubs Desktop',
            icon: path.join(__dirname, 'assets', 'icon.ico'),
            language: 1033,
            arch: 'x64',
            upgradeCode: FLEXHUBS_MSI_UPGRADE_CODE,
            programFilesFolderName: 'FlexHubs Desktop',
            shortcutName: 'FlexHubs Desktop',
            ui: {
              chooseDirectory: true,
              template: path.join(__dirname, 'assets', 'wix-ui-install-dir.xml'),
            },
          }),
          new MakerSquirrel({
            name: 'FlexHubsDesktop',
            authors: 'Flexodyn Solutions',
            description: 'FlexHubs Desktop',
            setupExe: 'FlexHubs-Desktop-Setup.exe',
            setupIcon: path.join(__dirname, 'assets', 'icon.ico'),
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
