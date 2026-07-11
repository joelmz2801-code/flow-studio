import { useEffect } from 'react'

const COLLAPSED_ATTR = 'data-jfs-collapsed-favorites'

function bookmarkMarkup() {
  return `<label class="ui-bookmark jfs-sidebar-bookmark" aria-hidden="true">
    <input type="checkbox" tabindex="-1" checked>
    <svg class="bookmark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-4.15L6 22V3.75Z" />
    </svg>
  </label>`
}

function styleExpandedEntry() {
  const entry = document.querySelector('[data-jfs-favorites-nav] .jfs-favorites-entry')
  if (!entry) return
  const icon = entry.querySelector('.sb-item-icon')
  if (icon && !icon.querySelector('.jfs-sidebar-bookmark')) icon.innerHTML = bookmarkMarkup()
  const label = entry.querySelector('.sb-item-label')
  if (label) label.textContent = '收藏夹'
}

function waitForExpandedEntry(callback, attempt = 0) {
  const entry = document.querySelector('[data-jfs-favorites-nav] .jfs-favorites-entry')
  if (entry) {
    callback(entry)
    return
  }
  if (attempt < 20) setTimeout(() => waitForExpandedEntry(callback, attempt + 1), 50)
}

function openFromCollapsed() {
  const sidebar = document.querySelector('.sidebar.collapsed')
  const toggle = sidebar?.querySelector('.sb-toggle')
  if (!toggle) return

  // 先让 React 渲染正常收藏入口，调用其原生处理器打开收藏夹，
  // 然后立即恢复收起态。收藏状态仍由原组件管理，不复制逻辑。
  toggle.click()
  waitForExpandedEntry((entry) => {
    entry.click()
    setTimeout(() => {
      const expandedToggle = document.querySelector('.sidebar:not(.collapsed) .sb-toggle')
      expandedToggle?.click()
    }, 30)
  })
}

function addCollapsedEntry() {
  const sidebar = document.querySelector('.sidebar.collapsed')
  if (!sidebar || sidebar.querySelector(`[${COLLAPSED_ATTR}]`)) return
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'icon-btn jfs-collapsed-favorites'
  button.setAttribute(COLLAPSED_ATTR, 'true')
  button.title = '收藏夹'
  button.setAttribute('aria-label', '收藏夹')
  button.innerHTML = bookmarkMarkup()
  button.addEventListener('click', openFromCollapsed)

  const spacer = sidebar.querySelector('.sb-spacer')
  sidebar.insertBefore(button, spacer || null)
}

export default function SidebarFavoritesEnhancer() {
  useEffect(() => {
    const root = document.getElementById('root') || document.body
    let frame = 0
    const enhance = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        styleExpandedEntry()
        addCollapsedEntry()
      })
    }
    const observer = new MutationObserver(enhance)
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    enhance()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
  return null
}
