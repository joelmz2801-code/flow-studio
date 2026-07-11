import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const enhancer = readFileSync(new URL('../src/favorites/SidebarFavoritesEnhancer.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/favorites/sidebar-favorites.css', import.meta.url), 'utf8')

assert.match(enhancer, /if \(!sidebar\.classList\.contains\('collapsed'\)\) \{\s*removeCollapsedEntries\(\)/, 'expanded mode must remove collapsed-only entries')
assert.match(enhancer, /button\.nextElementSibling !== spacer/, 'collapsed favorite must be pinned immediately before spacer')
assert.match(enhancer, /duplicates\.forEach/, 'duplicate collapsed entries must be removed')
assert.match(enhancer, /if \(openFavoritesAction\?\.\(\)\) return/, 'stale expanded entry must fall through to cold-load fallback')
assert.match(enhancer, /entry\.isConnected/, 'cached expanded action must verify its DOM node')
assert.match(css, /\.sidebar:not\(\.collapsed\) \.jfs-collapsed-favorites\{display:none!important\}/, 'CSS must hide collapsed-only entry in expanded mode')
assert.match(css, /\.sidebar\.collapsed \[data-jfs-favorites-nav\]\{display:none!important\}/, 'CSS must hide expanded entry in collapsed mode')
assert.match(css, /\.jfs-opening-favorites \.sidebar\{transition:none!important\}/, 'cold-load fallback must not animate sidebar width')

console.log('sidebar favorites UI invariants: ok')
