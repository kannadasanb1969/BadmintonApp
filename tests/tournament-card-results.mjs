import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
await mkdir('node_modules/.cache', { recursive: true })
await build({ entryPoints: ['tests/tournament-card-results.test.tsx'], outfile: 'node_modules/.cache/card-results-tests.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', define: { 'import.meta.env': '{}' } })
await import('../node_modules/.cache/card-results-tests.mjs')
