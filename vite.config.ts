import { crx } from '@crxjs/vite-plugin'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import manifest from './manifest.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
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
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('/vue/') || id.includes('/@vue/')) {
            return 'vue-core'
          }

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

          return 'vendor'
        },
      },
    },
  },
})
