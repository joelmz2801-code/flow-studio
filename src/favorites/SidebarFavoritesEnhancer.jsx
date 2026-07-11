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

 // Return success instead of merely existing. React replaces the whole sidebar
 // subtree between expanded and collapsed modes, so old entry closures can be stale.
 openFavoritesAction = () => {
 if (!entry.isConnected) return false
 entry.click()
 return true
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
 document.documentElement.classList.remove('jfs-opening-favorites')
 openingFromCollapsed = false
 return true
}

function openFromCollapsed() {
 if (openFavoritesAction?.()) return
 openFavoritesAction = null
 if (openingFromCollapsed) return

 // Cold-load fallback only. React flushes button clicks synchronously in the
 // normal path; the observer covers slower commits without exposing the reflow.
 const toggle = document.querySelector('.sidebar.collapsed .sb-toggle')
 if (!toggle) return
 openingFromCollapsed = true
 document.documentElement.classList.add('jfs-opening-favorites')
 const root = document.getElementById('root') || document.body
 const observer = new MutationObserver(() => finishFallbackOpen(observer))
 observer.observe(root, { childList: true, subtree: true })
 toggle.click()
 if (!finishFallbackOpen(observer)) queueMicrotask(() => finishFallbackOpen(observer))
 setTimeout(() => {
 observer.disconnect()
 document.documentElement.classList.remove('jfs-opening-favorites')
 openingFromCollapsed = false
 }, 500)
}

function syncCollapsedEntry() {
 const sidebar = document.querySelector('.sidebar')
 if (!sidebar) return

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

 // Final invariant after every React commit: exactly one favorite immediately
 // before the flexible spacer, never a timing-dependent third-row insertion.
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
 document.documentElement.classList.remove('jfs-opening-favorites')
 removeCollapsedEntries()
 }
 }, [])
 return null
}
