import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

await mkdir('node_modules/.cache', { recursive: true })
await build({ entryPoints: ['tests/friendly-batch7.test.tsx'], outfile: 'node_modules/.cache/friendly-batch7-test.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', define: { 'import.meta.env': '{}' } })
await import('../node_modules/.cache/friendly-batch7-test.mjs')
