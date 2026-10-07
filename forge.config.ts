import path from 'node:path';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import {
  getMacOsNotarizeConfig,
  getMacOsSignConfig,
  getWindowsSignConfig,
} from './signing.config';

const isDarwinHost = process.platform === 'darwin';
const isWindowsHost = process.platform === 'win32';

const osxSign = getMacOsSignConfig();
const osxNotarize = osxSign ? getMacOsNotarizeConfig() : undefined;
const windowsSign = getWindowsSignConfig();

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.flexodyn.flexhubs',
    appCategoryType: 'public.app-category.business',
    executableName: 'FlexHubs Desktop',
    extraResource: [path.join(__dirname, 'assets')],
    icon: isWindowsHost
      ? path.join(__dirname, 'assets', 'icon.ico')
      : path.join(__dirname, 'assets', 'logo-symbol.icns'),
    win32metadata: {
      CompanyName: 'Flexodyn Solutions',
      ProductName: 'FlexHubs Desktop',
      FileDescription: 'FlexHubs Desktop Application',
      InternalName: 'FlexHubs Desktop',
      OriginalFilename: 'FlexHubs Desktop.exe',
      LegalCopyright: 'Copyright © Flexodyn Solutions. All rights reserved.',
    },
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
    ...(osxSign ? { osxSign } : {}),
    ...(osxNotarize ? { osxNotarize } : {}),
    ...(windowsSign ? { windowsSign } : {}),
  },
  rebuildConfig: {},
  makers: [
    ...(isWindowsHost
      ? [
          new MakerSquirrel({
            name: 'FlexHubsDesktop',
            authors: 'Flexodyn Solutions',
            description: 'FlexHubs Desktop Application',
            title: 'FlexHubs Desktop',
            setupExe: 'FlexHubs-Desktop-Setup.exe',
            setupIcon: path.join(__dirname, 'assets', 'icon.ico'),
            loadingGif: path.join(__dirname, 'assets', 'install-loading.gif'),
            noMsi: true,
            ...(windowsSign
              ? {
                  certificateFile: windowsSign.certificateFile,
                  certificatePassword: windowsSign.certificatePassword,
                  windowsSign,
                }
              : {}),
          }),
        ]
      : []),
    ...(isDarwinHost
      ? [
          new MakerDMG({
            name: 'FlexHubs-Desktop',
            icon: path.join(__dirname, 'assets', 'logo-symbol.icns'),
            format: 'ULFO',
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
