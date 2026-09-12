import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

await mkdir('node_modules/.cache', { recursive: true })
await build({
  entryPoints: ['tests/match-realtime.test.ts'],
  outfile: 'node_modules/.cache/match-realtime-tests.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  define: { 'import.meta.env': '{}' },
})
await import('../node_modules/.cache/match-realtime-tests.mjs')
