import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const enhancer = readFileSync(new URL('../src/favorites/SidebarFavoritesEnhancer.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/favorites/sidebar-favorites.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

assert.match(enhancer, /wrappers\.forEach\(\(node\) => \{ if \(node !== wrapper\) node\.remove\(\) \}\)/, 'expanded duplicates must be removed')
assert.match(enhancer, /duplicates\.forEach\(\(node\) => \{ if \(node !== button\) node\.remove\(\) \}\)/, 'collapsed duplicates must be removed')
assert.match(enhancer, /search\.insertAdjacentElement\('afterend', wrapper\)/, 'expanded favorite must sit directly below search')
assert.match(enhancer, /anchor\.insertAdjacentElement\('afterend', button\)/, 'collapsed favorite must use the matching top navigation slot')
assert.doesNotMatch(enhancer, /insertBefore\(button, spacer\)/, 'favorite must never be pinned above the bottom spacer')
assert.match(css, /\.sidebar:not\(\.collapsed\) \.jfs-collapsed-favorites\{display:none!important\}/, 'expanded mode must hide collapsed icon')
assert.match(css, /\.sidebar\.collapsed \[data-jfs-favorites-nav\]\{display:none!important\}/, 'collapsed mode must hide expanded row')
assert.match(main, /<SidebarFavoritesEnhancer\s*\/>/, 'favorites sidebar enhancer must be mounted')

console.log('sidebar favorites UI invariants: ok')
