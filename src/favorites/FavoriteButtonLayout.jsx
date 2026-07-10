import { useEffect } from 'react'

const FAVORITE_SELECTOR = '[data-jfs-favorite-action]'

function labelOf(element) {
  return [
    element.textContent,
    element.title,
    element.getAttribute('aria-label'),
  ].filter(Boolean).join(' ').trim()
}

function findReferenceButton(favorite) {
  const message = favorite.closest('.msg, .message, [class*="message"], [class*="assistant"]')
  if (!message) return null
  return [...message.querySelectorAll('button')].find((button) => {
    if (button === favorite || button.matches(FAVORITE_SELECTOR)) return false
    return /添加为参考图|设为参考图|作为参考图|参考图|add.{0,8}reference|use.{0,8}reference/i.test(labelOf(button))
  }) || null
}

function refineFavoriteButton(button) {
  button.classList.add('jfs-favorite-icon-only')
  button.setAttribute('aria-label', button.classList.contains('is-saved') ? '取消收藏照片' : '收藏照片')
  button.title = button.classList.contains('is-saved') ? '取消收藏' : '收藏'

  const reference = findReferenceButton(button)
  if (!reference) return
  const actions = reference.parentElement
  if (!actions) return
  actions.classList.add('jfs-photo-action-row')
  if (button.parentElement !== actions || button.previousElementSibling !== reference) {
    reference.insertAdjacentElement('afterend', button)
  }
}

export default function FavoriteButtonLayout() {
  useEffect(() => {
    const root = document.getElementById('root') || document.body
    let frame = 0
    const refine = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        document.querySelectorAll(FAVORITE_SELECTOR).forEach(refineFavoriteButton)
      })
    }
    const observer = new MutationObserver(refine)
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    refine()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
