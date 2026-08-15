import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';

function electronSpawnEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        onstart({ startup }) {
          void startup(['.', '--no-sandbox'], { env: electronSpawnEnv() });
        },
      },
      preload: {
        input: 'electron/preload.ts',
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
