import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    // jsdom provides browser-like globals (Blob, Event, etc.)
    // fake-indexeddb injects its own IndexedDB into Dexie via constructor options
    // so we do NOT need setupFiles here.
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/background/**'],
    },
  },
})
