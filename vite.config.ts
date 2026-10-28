import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/JointGlowClinicalAPP/").
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'models/*.task', 'wasm/*'],
      manifest: {
        name: 'JointGlow Clinical',
        short_name: 'JointGlow',
        description: 'Facial analysis and aesthetic treatment simulator',
        theme_color: '#1f5f5b',
        background_color: '#fbf8f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The MediaPipe WASM runtime (~11 MB) and face model (~3.7 MB) are precached for offline use.
        maximumFileSizeToCacheInBytes: 24 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,wasm,task,png,svg,ico,webmanifest}'],
      },
    }),
  ],
  server: { port: 5173 },
  build: { target: 'es2020', sourcemap: false },
});
