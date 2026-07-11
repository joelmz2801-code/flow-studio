import { useEffect } from 'react'

const FAVORITE_SELECTOR = '[data-jfs-favorite-action]'

function bookmarkMarkup(checked) {
  return `<label class="ui-bookmark" aria-hidden="true">
    <input type="checkbox" tabindex="-1" ${checked ? 'checked' : ''}>
    <svg class="bookmark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-4.15L6 22V3.75Z" />
    </svg>
  </label>`
}

function syncButton(button) {
  if (!button?.isConnected) return
  const checked = button.classList.contains('is-saved')
  button.dataset.jfsBookmarkReady = 'true'
  button.classList.add('jfs-bookmark-favorite')
  if (!button.querySelector('.ui-bookmark')) button.innerHTML = bookmarkMarkup(checked)
  const input = button.querySelector('.ui-bookmark input')
  if (input) input.checked = checked
  button.title = checked ? '取消收藏' : '收藏'
  button.setAttribute('aria-label', button.title)
}

export default function BookmarkFavoriteEnhancer() {
  useEffect(() => {
    const root = document.getElementById('root') || document.body
    let scheduled = false
    let repairing = false

    const repairAll = () => {
      if (repairing) return
      repairing = true
      document.querySelectorAll(FAVORITE_SELECTOR).forEach(syncButton)
      repairing = false
    }

    const scheduleRepair = () => {
      if (scheduled || repairing) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        repairAll()
      })
    }

    // 同时监听 childList 和 class。原收藏组件改 innerHTML 后会触发 childList，
    // 这里下一帧恢复书签。repairing 防止我们的修复再次触发自循环。
    const observer = new MutationObserver((records) => {
      if (repairing) return
      const relevant = records.some((record) =>
        record.type === 'attributes' ||
        record.target.closest?.(FAVORITE_SELECTOR) ||
        [...record.addedNodes].some((node) =>
          node.nodeType === 1 && (node.matches?.(FAVORITE_SELECTOR) || node.querySelector?.(FAVORITE_SELECTOR))
        )
      )
      if (relevant) scheduleRepair()
    })
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })

    // 点击后的 React/IndexedDB 更新可能分多轮完成，短时间内做三次幂等修复。
    const afterClick = (event) => {
      const button = event.target.closest?.(FAVORITE_SELECTOR)
      if (!button) return
      ;[0, 60, 180].forEach((delay) => setTimeout(() => syncButton(button), delay))
    }
    document.addEventListener('click', afterClick, true)
    repairAll()

    return () => {
      observer.disconnect()
      document.removeEventListener('click', afterClick, true)
    }
  }, [])
  return null
}
