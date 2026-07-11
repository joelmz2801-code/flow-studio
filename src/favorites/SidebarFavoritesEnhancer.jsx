import { useEffect } from 'react'

const COLLAPSED_ATTR = 'data-jfs-collapsed-favorites'
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

 // 缓存 React 已绑定的点击入口。侧栏折叠后节点即使被移除，
 // 仍可直接触发它的处理函数，不必先展开侧栏再收起。
 openFavoritesAction = () => entry.click()

 // 删除原组件创建的爱心及任何旧增强节点，直接写入唯一书签 SVG。
 if (!icon.querySelector('.jfs-sidebar-bookmark-icon') || icon.children.length !== 1) {
 icon.replaceChildren()
 icon.insertAdjacentHTML('afterbegin', bookmarkSvg())
 }
 const label = entry.querySelector('.sb-item-label')
 if (label) label.textContent = '收藏夹'
 return true
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

 // 仅用于页面一开始就是折叠态、尚未缓存入口的极端情况。
 // 用 DOM 提交监听在同一帧内完成展开、打开、收起，避免旧版定时器造成可见跳动。
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
 }

 // 首次刷新时 React 会分阶段提交侧栏子节点。旧逻辑只在创建按钮时决定位置，
 // 如果 spacer 当时还没出现，按钮就会卡在第三行，直到第二次折叠才被重建。
 // 每次增强都重新把按钮钉在 spacer 前，DOM 后续更新也不会改变最终顺序。
 const spacer = sidebar.querySelector('.sb-spacer')
 if (spacer) {
 if (button.nextElementSibling !== spacer) sidebar.insertBefore(button, spacer)
 } else if (!button.isConnected) {
 sidebar.appendChild(button)
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
