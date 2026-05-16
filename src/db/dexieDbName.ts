/**
 * IndexedDB è per-origine (es. `user.github.io`), non per path.
 * Deriva il nome del DB dal `base` Vite così `/tavoli/` → `tavoliweb-tavoli`
 * e non collide con altre app sullo stesso dominio.
 *
 * Con `base: '/'` (dev / dominio dedicato) resta `tavoliweb` (fork Tavoli; non condivide IndexedDB con PizzApp).
 *
 * Override: variabile `VITE_DEXIE_NAME` nel file `.env`.
 */
export function resolvePizzappDexieName(baseUrl: string, override?: string | null): string {
  if (override?.trim()) return override.trim()

  const pathOnly = (baseUrl ?? '/').replace(/\/$/, '')
  if (pathOnly === '' || pathOnly === '/') return 'tavoliweb'

  const slug = pathOnly
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .join('-')

  const safe = slug.replace(/[^a-zA-Z0-9_-]/g, '-') || 'app'
  return `tavoliweb-${safe}`
}

export function getPizzappDexieName(): string {
  return resolvePizzappDexieName(import.meta.env.BASE_URL, import.meta.env.VITE_DEXIE_NAME)
}
