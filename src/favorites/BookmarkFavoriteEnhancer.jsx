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
  const checked = button.classList.contains('is-saved')
  if (!button.dataset.jfsBookmarkReady) {
    button.dataset.jfsBookmarkReady = 'true'
    button.classList.add('jfs-bookmark-favorite')
    button.innerHTML = bookmarkMarkup(checked)
  }
  const input = button.querySelector('.ui-bookmark input')
  if (input) input.checked = checked
  button.title = checked ? '取消收藏' : '收藏'
  button.setAttribute('aria-label', button.title)
}

export default function BookmarkFavoriteEnhancer() {
  useEffect(() => {
    const root = document.getElementById('root') || document.body
    let frame = 0
    const enhance = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        document.querySelectorAll(FAVORITE_SELECTOR).forEach(syncButton)
      })
    }

    const observer = new MutationObserver(enhance)
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })

    const afterFavoriteClick = (event) => {
      const button = event.target.closest?.(FAVORITE_SELECTOR)
      if (!button) return
      requestAnimationFrame(() => syncButton(button))
      setTimeout(() => syncButton(button), 80)
    }
    document.addEventListener('click', afterFavoriteClick, true)
    enhance()

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      document.removeEventListener('click', afterFavoriteClick, true)
    }
  }, [])
  return null
}
