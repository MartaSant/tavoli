import { describe, expect, it } from 'vitest'
import { resolvePizzappDexieName } from './dexieDbName'

describe('resolvePizzappDexieName', () => {
  it('root base keeps legacy name', () => {
    expect(resolvePizzappDexieName('/')).toBe('tavoliweb')
    expect(resolvePizzappDexieName('')).toBe('tavoliweb')
  })

  it('GitHub Pages project path gets suffix', () => {
    expect(resolvePizzappDexieName('/pizzawebapp/')).toBe('tavoliweb-pizzawebapp')
  })

  it('nested path segments', () => {
    expect(resolvePizzappDexieName('/a/b/')).toBe('tavoliweb-a-b')
  })

  it('override wins', () => {
    expect(resolvePizzappDexieName('/pizzawebapp/', ' mio-db ')).toBe('mio-db')
  })
})
