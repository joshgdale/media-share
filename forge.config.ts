import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';

import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import {
  IMAGE_EXTENSIONS,
  MEDIA_OPEN_MIME_TYPES,
  VIDEO_EXTENSIONS,
} from './src/types';

const imageExtensions = [...IMAGE_EXTENSIONS];
const videoExtensions = [...VIDEO_EXTENSIONS];

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

const APP_NAME = 'Media Share';

const config: ForgeConfig = {
  packagerConfig: {
    name: APP_NAME,
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
        {
          CFBundleTypeExtensions: imageExtensions,
          CFBundleTypeName: 'Image',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
          LSItemContentTypes: [
            'public.png',
            'public.jpeg',
            'com.compuserve.gif',
            'com.microsoft.bmp',
            'org.webmproject.webp',
          ],
        },
        {
          CFBundleTypeExtensions: videoExtensions,
          CFBundleTypeName: 'Movie',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
          LSItemContentTypes: [
            'public.mpeg-4',
            'com.apple.m4v-video',
            'com.apple.quicktime-movie',
            'public.avi',
            'org.webmproject.webm',
            'org.matroska.mkv',
          ],
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
      UTImportedTypeDeclarations: [
        {
          UTTypeConformsTo: ['public.image'],
          UTTypeDescription: 'WebP Image',
          UTTypeIdentifier: 'org.webmproject.webp',
          UTTypeTagSpecification: {
            'public.filename-extension': ['webp'],
            'public.mime-type': ['image/webp'],
          },
        },
        {
          UTTypeConformsTo: ['public.movie'],
          UTTypeDescription: 'WebM Video',
          UTTypeIdentifier: 'org.webmproject.webm',
          UTTypeTagSpecification: {
            'public.filename-extension': ['webm'],
            'public.mime-type': ['video/webm'],
          },
        },
        {
          UTTypeConformsTo: ['public.movie'],
          UTTypeDescription: 'Matroska Video',
          UTTypeIdentifier: 'org.matroska.mkv',
          UTTypeTagSpecification: {
            'public.filename-extension': ['mkv'],
            'public.mime-type': ['video/x-matroska'],
          },
        },
      ],
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}),
    new MakerDMG({
      name: APP_NAME,
      format: 'ULFO',
      icon: 'icons/macos/icon.icns',
    }),
    new MakerSquirrel({
      name: 'MediaShare',
      setupIcon: 'icons/windows/icon.ico',
    }),
    new MakerDeb(
      { options: { icon: 'icons/linux/icons/512x512.png', mimeType: [...MEDIA_OPEN_MIME_TYPES] } },
      ['linux'],
    ),
    new MakerRpm(
      { options: { icon: 'icons/linux/icons/512x512.png', mimeType: [...MEDIA_OPEN_MIME_TYPES] } },
      ['linux'],
    ),
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
    prePackage: async (_config, platform, arch) => {
      if (platform === 'darwin' && arch !== 'arm64') {
        throw new Error(`macOS builds are Apple silicon (arm64) only; got "${arch}".`);
      }
    },
    // Packaging rewrites Info.plist after Electron's ad-hoc signature, and a
    // downloaded app with a broken signature is reported as "damaged".
    postPackage: async (_config, { platform, outputPaths }) => {
      if (platform !== 'darwin') return;
      for (const outputPath of outputPaths) {
        const app = path.join(outputPath, `${APP_NAME}.app`);
        execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
      }
    },
  },
};

export default config;
