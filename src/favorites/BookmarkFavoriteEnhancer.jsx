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

function visualState(button) {
  const lockUntil = Number(button.dataset.jfsVisualLock || 0)
  if (Date.now() < lockUntil) return button.dataset.jfsVisualSaved === 'true'
  delete button.dataset.jfsVisualLock
  delete button.dataset.jfsVisualSaved
  return button.classList.contains('is-saved')
}

function syncButton(button) {
  if (!button?.isConnected) return
  const checked = visualState(button)
  button.dataset.jfsBookmarkReady = 'true'
  button.classList.add('jfs-bookmark-favorite')
  button.classList.toggle('jfs-visual-saved', checked)
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

    // 收藏写入 IndexedDB 是异步的。点击时立即锁定目标视觉状态，
    // 防止旧的 is-saved class 在保存完成前把金色书签改回灰色。
    const onClick = (event) => {
      const button = event.target.closest?.(FAVORITE_SELECTOR)
      if (!button) return
      const current = button.querySelector('.ui-bookmark input')?.checked ?? button.classList.contains('is-saved')
      const next = !current
      button.dataset.jfsVisualSaved = String(next)
      button.dataset.jfsVisualLock = String(Date.now() + 2500)
      syncButton(button)
      setTimeout(() => syncButton(button), 80)
      setTimeout(() => syncButton(button), 500)
      setTimeout(() => syncButton(button), 2600)
    }
    document.addEventListener('click', onClick, true)
    repairAll()

    return () => {
      observer.disconnect()
      document.removeEventListener('click', onClick, true)
    }
  }, [])
  return null
}
