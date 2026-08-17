import { execSync } from 'node:child_process';

import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const packagedPaths = new Set(['/package.json', '/dist', '/dist-electron', '/icons']);

function ignorePackagedPath(filePath: string): boolean {
  if (filePath === '' || filePath === '/') return false;
  const file = filePath.replace(/\\/g, '/');
  if (packagedPaths.has(file)) return false;
  return !(
    file.startsWith('/dist/') ||
    file.startsWith('/dist-electron/') ||
    file.startsWith('/icons/')
  );
}

function packagerIcon(): string {
  switch (process.platform) {
    case 'darwin':
      return 'icons/macos/icon.icns';
    case 'win32':
      return 'icons/windows/icon.ico';
    default:
      return 'icons/linux/icons/512x512.png';
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Media Share',
    appBundleId: 'com.joshgdale.media-share',
    appCategoryType: 'public.app-category.video',
    asar: true,
    darwinDarkModeSupport: true,
    icon: packagerIcon(),
    ignore: ignorePackagedPath,
    extendInfo: {
      CFBundleDocumentTypes: [
        {
          CFBundleTypeExtensions: ['msplaylist'],
          CFBundleTypeName: 'Media Share Playlist',
          CFBundleTypeRole: 'Editor',
          LSHandlerRank: 'Owner',
          LSItemContentTypes: ['com.joshgdale.media-share.playlist'],
        },
      ],
      UTExportedTypeDeclarations: [
        {
          UTTypeConformsTo: ['public.json', 'public.data'],
          UTTypeDescription: 'Media Share Playlist',
          UTTypeIdentifier: 'com.joshgdale.media-share.playlist',
          UTTypeTagSpecification: {
            'public.filename-extension': ['msplaylist'],
            'public.mime-type': ['application/json'],
          },
        },
      ],
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}),
    new MakerDMG({
      name: 'Media Share',
      format: 'ULFO',
      icon: 'icons/macos/icon.icns',
    }),
    new MakerSquirrel({
      name: 'MediaShare',
      setupIcon: 'icons/windows/icon.ico',
    }),
    new MakerDeb({ options: { icon: 'icons/linux/icons/512x512.png' } }, ['linux']),
    new MakerRpm({ options: { icon: 'icons/linux/icons/512x512.png' } }, ['linux']),
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    generateAssets: async () => {
      execSync('npm run build', { stdio: 'inherit' });
    },
  },
};

export default config;
