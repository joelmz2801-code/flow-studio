import { useEffect } from 'react'

const COLLAPSED_ATTR = 'data-jfs-collapsed-favorites'

function bookmarkSvg(className = 'jfs-sidebar-bookmark-icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-4.15L6 22V3.75Z" />
  </svg>`
}

function replaceExpandedIcon() {
  const entry = document.querySelector('[data-jfs-favorites-nav] .jfs-favorites-entry')
  if (!entry) return false
  const icon = entry.querySelector('.sb-item-icon')
  if (!icon) return false

  // 删除原组件创建的爱心及任何旧增强节点，直接写入唯一书签 SVG。
  if (!icon.querySelector('.jfs-sidebar-bookmark-icon') || icon.children.length !== 1) {
    icon.replaceChildren()
    icon.insertAdjacentHTML('afterbegin', bookmarkSvg())
  }
  const label = entry.querySelector('.sb-item-label')
  if (label) label.textContent = '收藏夹'
  return true
}

function waitForExpandedEntry(callback, attempt = 0) {
  const entry = document.querySelector('[data-jfs-favorites-nav] .jfs-favorites-entry')
  if (entry) return callback(entry)
  if (attempt < 30) setTimeout(() => waitForExpandedEntry(callback, attempt + 1), 40)
}

function openFromCollapsed() {
  const toggle = document.querySelector('.sidebar.collapsed .sb-toggle')
  if (!toggle) return
  toggle.click()
  waitForExpandedEntry((entry) => {
    replaceExpandedIcon()
    entry.click()
    setTimeout(() => document.querySelector('.sidebar:not(.collapsed) .sb-toggle')?.click(), 30)
  })
}

function addCollapsedEntry() {
  const sidebar = document.querySelector('.sidebar.collapsed')
  if (!sidebar) return
  let button = sidebar.querySelector(`[${COLLAPSED_ATTR}]`)
  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.className = 'icon-btn jfs-collapsed-favorites'
    button.setAttribute(COLLAPSED_ATTR, 'true')
    button.title = '收藏夹'
    button.setAttribute('aria-label', '收藏夹')
    button.addEventListener('click', openFromCollapsed)
    sidebar.insertBefore(button, sidebar.querySelector('.sb-spacer') || null)
  }
  if (!button.querySelector('.jfs-sidebar-bookmark-icon') || button.children.length !== 1) {
    button.replaceChildren()
    button.insertAdjacentHTML('afterbegin', bookmarkSvg())
  }
}

export default function SidebarFavoritesEnhancer() {
  useEffect(() => {
    const root = document.getElementById('root') || document.body
    let scheduled = false
    let writing = false

    const enhance = () => {
      if (writing) return
      writing = true
      replaceExpandedIcon()
      addCollapsedEntry()
      writing = false
    }
    const schedule = () => {
      if (scheduled || writing) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        enhance()
      })
    }
    const observer = new MutationObserver(schedule)
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    enhance()
    return () => observer.disconnect()
  }, [])
  return null
}
