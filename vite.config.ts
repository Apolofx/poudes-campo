import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readJson(path: string, fallback: unknown) {
  try { return JSON.parse(readFileSync(resolve(__dirname, path), 'utf-8')); }
  catch { return fallback; }
}

const pkg = readJson('package.json', { version: '0.0.0' });
const changelog = readJson('src/changelog.json', { version: pkg.version, entries: [] });

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __CHANGELOG__: JSON.stringify(changelog),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Campo',
        short_name: 'Campo',
        description: 'Registro de visitas a lotes',
        lang: 'es',
        theme_color: '#2f7d4f',
        background_color: '#f7f6f1',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
