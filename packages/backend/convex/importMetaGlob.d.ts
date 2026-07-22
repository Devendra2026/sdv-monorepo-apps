/**
 * Vitest/Vite injects `import.meta.glob` at transform time.
 * Declared locally because `vite` is not a direct dependency of this package,
 * so `/// <reference types="vite/client" />` fails with TS2688.
 */
interface ImportMeta {
  readonly glob: (pattern: string) => Record<string, () => Promise<unknown>>
}
