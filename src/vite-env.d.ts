/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Nome IndexedDB forzato (evita collisioni se serve). */
  readonly VITE_DEXIE_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
