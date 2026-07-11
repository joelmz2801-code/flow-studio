import { useEffect } from 'react'

const NAV_SELECTOR = '[data-jfs-favorites-nav]'
const COLLAPSED_ATTR = 'data-jfs-collapsed-favorites'
const COLLAPSED_SELECTOR = `[${COLLAPSED_ATTR}]`
let openFavoritesAction = null
let openingFromCollapsed = false

function bookmarkSvg() {
 return '<svg class="jfs-sidebar-bookmark-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.75h12v16.5l-6-3.75-6 3.75z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
}

function hasSingleBookmark(node) {
 return node?.children.length === 1 && node.firstElementChild?.classList.contains('jfs-sidebar-bookmark-icon')
}

function ensureBookmark(node) {
 if (hasSingleBookmark(node)) return
 node.replaceChildren()
 node.insertAdjacentHTML('afterbegin', bookmarkSvg())
}

function removeCollapsedEntries() {
 document.querySelectorAll(COLLAPSED_SELECTOR).forEach((node) => node.remove())
}

function normalizeExpandedEntry(sidebar) {
 const search = sidebar.querySelector('.search-box')
 const wrappers = [...document.querySelectorAll(NAV_SELECTOR)]
 if (!search || wrappers.length === 0) return false

 const wrapper = wrappers.find((node) => node.closest('.sidebar') === sidebar) || wrappers[0]
 wrappers.forEach((node) => { if (node !== wrapper) node.remove() })
 if (wrapper.previousElementSibling !== search) search.insertAdjacentElement('afterend', wrapper)

 const entry = wrapper.querySelector('.jfs-favorites-entry')
 const icon = entry?.querySelector('.sb-item-icon')
 if (!entry || !icon) return false
 const sourceButton = entry
 openFavoritesAction = () => {
 sourceButton.click()
 return true
 }
 ensureBookmark(icon)
 const label = entry.querySelector('.sb-item-label')
 if (label && label.textContent !== '收藏夹') label.textContent = '收藏夹'
 return true
}

function finishColdOpen(observer) {
 const sidebar = document.querySelector('.sidebar:not(.collapsed)')
 if (!sidebar || !normalizeExpandedEntry(sidebar)) return false
 observer?.disconnect()
 openFavoritesAction?.()
 sidebar.querySelector('.sb-toggle')?.click()
 document.documentElement.classList.remove('jfs-opening-favorites')
 openingFromCollapsed = false
 return true
}

function openFromCollapsed() {
 if (openFavoritesAction?.()) return
 if (openingFromCollapsed) return
 const toggle = document.querySelector('.sidebar.collapsed .sb-toggle')
 if (!toggle) return

 openingFromCollapsed = true
 document.documentElement.classList.add('jfs-opening-favorites')
 const root = document.getElementById('root') || document.body
 const observer = new MutationObserver(() => finishColdOpen(observer))
 observer.observe(root, { childList: true, subtree: true })
 toggle.click()
 queueMicrotask(() => finishColdOpen(observer))
 setTimeout(() => {
 observer.disconnect()
 document.documentElement.classList.remove('jfs-opening-favorites')
 openingFromCollapsed = false
 }, 600)
}

function syncCollapsedEntry(sidebar) {
 const expanded = [...document.querySelectorAll(NAV_SELECTOR)]
 const source = expanded.find((node) => node.querySelector('.jfs-favorites-entry'))
 if (source) {
 const sourceButton = source.querySelector('.jfs-favorites-entry')
 openFavoritesAction = () => { sourceButton.click(); return true }
 }
 expanded.forEach((node) => node.remove())

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
 ensureBookmark(button)

 // Both states use the same semantic slot: after search/new-chat controls and
 // before page navigation. This is stable across refreshes and toggle cycles.
 const newChat = [...sidebar.querySelectorAll(':scope > button')].find((node) =>
 /新对话/.test(`${node.title || ''} ${node.getAttribute('aria-label') || ''}`),
 )
 const fallback = sidebar.querySelector('.sb-toggle')
 const anchor = newChat || fallback
 if (anchor && anchor.nextElementSibling !== button) anchor.insertAdjacentElement('afterend', button)
 else if (!button.isConnected) sidebar.prepend(button)
}

function syncSidebar() {
 const sidebar = document.querySelector('.sidebar')
 if (!sidebar) return
 if (sidebar.classList.contains('collapsed')) {
 syncCollapsedEntry(sidebar)
 return
 }
 removeCollapsedEntries()
 normalizeExpandedEntry(sidebar)
}

export default function SidebarFavoritesEnhancer() {
 useEffect(() => {
 const root = document.getElementById('root') || document.body
 let frame = 0
 let writing = false
 const run = () => {
 if (writing) return
 writing = true
 syncSidebar()
 writing = false
 }
 const schedule = () => {
 if (frame || writing) return
 frame = requestAnimationFrame(() => {
 frame = 0
 run()
 })
 }
 const observer = new MutationObserver(schedule)
 observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
 run()
 return () => {
 observer.disconnect()
 if (frame) cancelAnimationFrame(frame)
 document.documentElement.classList.remove('jfs-opening-favorites')
 removeCollapsedEntries()
 }
 }, [])
 return null
}
