import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

await build({ entryPoints: ['src/features/matches/components/AnimatedScore.tsx'], outfile: 'node_modules/.cache/animated-score-test.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external' })
const { scoreChangeDirection } = await import('../node_modules/.cache/animated-score-test.mjs')

assert.equal(scoreChangeDirection(14, 14), null)
assert.equal(scoreChangeDirection(14, 15), 'up')
assert.equal(scoreChangeDirection(16, 15), 'down')
assert.equal(scoreChangeDirection(15, 17), 'up')
assert.equal(scoreChangeDirection(31, 40), 'up')
assert.equal(scoreChangeDirection(14, 15, false), null)

const component = await readFile('src/features/matches/components/AnimatedScore.tsx', 'utf8')
const styles = await readFile('src/styles/globals.css', 'utf8')
const playerFixtures = await readFile('src/features/player/pages/PlayerFixturesPage.tsx', 'utf8')
assert.match(component, /const previous = useRef\(value\)/)
assert.match(component, /window\.clearTimeout\(timer\)/)
assert.match(component, /aria-label={`Score \${value}`}/)
assert.match(styles, /min-inline-size: 3ch/)
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
assert.match(styles, /400ms/)
assert.match(playerFixtures, /AnimatedScore value={match\.participant1Score}/)
assert.match(playerFixtures, /AnimatedScore value={match\.participant2Score}/)
console.log('PASS: live score direction, initial/static behavior, rapid replacement cleanup, stable width and reduced motion')
