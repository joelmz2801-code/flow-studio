import { useEffect } from 'react'

const COLLAPSED_ATTR = 'data-jfs-collapsed-favorites'
const COLLAPSED_SELECTOR = `[${COLLAPSED_ATTR}]`
let openFavoritesAction = null
let openingFromCollapsed = false

function bookmarkSvg(className = 'jfs-sidebar-bookmark-icon') {
 return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.75h12v16.5l-6-3.75-6 3.75z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

function replaceExpandedIcon() {
 const entry = document.querySelector('[data-jfs-favorites-nav] .jfs-favorites-entry')
 if (!entry) return false
 const icon = entry.querySelector('.sb-item-icon')
 if (!icon) return false

 // The injected expanded entry stays mounted while hidden, so its React click
 // handler is the stable route for both expanded and collapsed sidebars.
 openFavoritesAction = () => {
 if (entry.isConnected) entry.click()
 }

 if (!icon.querySelector('.jfs-sidebar-bookmark-icon') || icon.children.length !== 1) {
 icon.replaceChildren()
 icon.insertAdjacentHTML('afterbegin', bookmarkSvg())
 }
 const label = entry.querySelector('.sb-item-label')
 if (label) label.textContent = '收藏夹'
 return true
}

function removeCollapsedEntries() {
 document.querySelectorAll(COLLAPSED_SELECTOR).forEach((node) => node.remove())
}

function finishFallbackOpen(observer) {
 const entry = document.querySelector('[data-jfs-favorites-nav] .jfs-favorites-entry')
 if (!entry) return false
 observer?.disconnect()
 replaceExpandedIcon()
 entry.click()
 document.querySelector('.sidebar:not(.collapsed) .sb-toggle')?.click()
 openingFromCollapsed = false
 return true
}

function openFromCollapsed() {
 if (openFavoritesAction) {
 openFavoritesAction()
 return
 }
 if (openingFromCollapsed) return

 // Cold-load fallback only. Complete the temporary expand/open/collapse in the
 // same DOM turn so the sidebar never visibly reflows.
 const toggle = document.querySelector('.sidebar.collapsed .sb-toggle')
 if (!toggle) return
 openingFromCollapsed = true
 const root = document.getElementById('root') || document.body
 const observer = new MutationObserver(() => finishFallbackOpen(observer))
 observer.observe(root, { childList: true, subtree: true })
 toggle.click()
 queueMicrotask(() => finishFallbackOpen(observer))
 setTimeout(() => {
 observer.disconnect()
 openingFromCollapsed = false
 }, 500)
}

function syncCollapsedEntry() {
 const sidebar = document.querySelector('.sidebar')
 if (!sidebar) return

 // Expanded mode must never retain the collapsed-only button. This cleanup is
 // what prevents the duplicate standalone bookmark shown after toggling.
 if (!sidebar.classList.contains('collapsed')) {
 removeCollapsedEntries()
 return
 }

 const duplicates = [...document.querySelectorAll(COLLAPSED_SELECTOR)]
 let button = duplicates.find((node) => node.parentElement === sidebar) || null
 duplicates.forEach((node) => { if (node !== button) node.remove() })

 if (!button) {
 button = document.createElement('button')
 button.type = 'button'
 button.className = 'icon-btn jfs-collapsed-favorites'
 button.setAttribute(COLLAPSED_ATTR, 'true')
 button.title = '收藏夹'
 button.setAttribute('aria-label', '收藏夹')
 button.addEventListener('click', openFromCollapsed)
 }

 if (!button.querySelector('.jfs-sidebar-bookmark-icon') || button.children.length !== 1) {
 button.replaceChildren()
 button.insertAdjacentHTML('afterbegin', bookmarkSvg())
 }

 // React commits sidebar children in phases on a cold refresh. Reinsert on
 // every observed commit so the final invariant is always: favorite, spacer.
 const spacer = sidebar.querySelector('.sb-spacer')
 if (spacer) {
 if (button.parentElement !== sidebar || button.nextElementSibling !== spacer) {
 sidebar.insertBefore(button, spacer)
 }
 } else if (button.parentElement !== sidebar) {
 sidebar.appendChild(button)
 }
}

export default function SidebarFavoritesEnhancer() {
 useEffect(() => {
 const root = document.getElementById('root') || document.body
 let frame = 0
 let writing = false

 const enhance = () => {
 if (writing) return
 writing = true
 replaceExpandedIcon()
 syncCollapsedEntry()
 writing = false
 }
 const schedule = () => {
 if (frame || writing) return
 frame = requestAnimationFrame(() => {
 frame = 0
 enhance()
 })
 }
 const observer = new MutationObserver(schedule)
 observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
 enhance()
 return () => {
 observer.disconnect()
 if (frame) cancelAnimationFrame(frame)
 removeCollapsedEntries()
 }
 }, [])
 return null
}
