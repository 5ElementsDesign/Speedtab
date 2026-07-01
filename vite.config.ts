import { crx } from '@crxjs/vite-plugin'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import manifest from './manifest.json'

const localLibRoot = fileURLToPath(new URL('./src/lib/yai/', import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // @crxjs reads manifest.json, bundles the newtab HTML, service worker,
    // and rewrites all asset paths automatically.
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host:       '127.0.0.1',
    port:       5173,
    strictPort: true,
  },
  build: {
    // Emit human-readable names in development for easier debugging.
    rollupOptions: {
      input: {
        newtab: fileURLToPath(new URL('./src/newtab.html', import.meta.url)),
        sorter: fileURLToPath(new URL('./src/sorter.html', import.meta.url)),
        importExport: fileURLToPath(new URL('./src/import-export.html', import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (id.startsWith(localLibRoot)) {
            return 'yai-bundle'
          }

          if (!id.includes('node_modules')) return

          if (id.includes('/dexie/') || id.includes('/dexie-export-import/')) {
            return 'db'
          }

          if (id.includes('/cropperjs/')) {
            return 'cropper'
          }

          if (id.includes('/highlight.js/')) {
            return 'highlight'
          }

          if (id.includes('/dompurify/')) {
            return 'sanitize'
          }
        },
      },
    },
  },
})
