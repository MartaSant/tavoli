/// <reference types="vitest/config" />
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/** GitHub Pages serves `404.html` on unknown paths; copy enables SPA refresh on deep links. */
function githubPagesSpaFallback(): import('vite').Plugin {
  return {
    name: 'github-pages-spa-fallback',
    closeBundle() {
      const dist = resolve(__dirname, 'dist')
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
    },
  }
}

// https://vite.dev/config/
// GitHub Pages (project site): stesso `github.io` per più repo → imposta `base` al nome repo.
// Esempio: `base: '/tavoli/'` così IndexedDB sarà `tavoliweb-tavoli`, distinto da altre app sullo stesso dominio.
// Vedi `src/db/dexieDbName.ts`. Override: `VITE_DEXIE_NAME` in `.env`.
export default defineConfig({
  // base: '/tavoli/',
  plugins: [react(), githubPagesSpaFallback()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
