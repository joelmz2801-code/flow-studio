import { useEffect } from 'react'

const TAB_SELECTOR = '[data-jfs-folder-tab]'
const OVERLAY_SELECTOR = '#jfs-folder-overlay'

const folderIcon = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/></svg>'

function decorateTab() {
  const tab = document.querySelector(TAB_SELECTOR)
  if (!tab || tab.dataset.jfsIconReady) return
  tab.dataset.jfsIconReady = 'true'
  tab.classList.add('jfs-folder-tab')
  tab.innerHTML = `${folderIcon}<span>保存文件夹</span>`
}

function closeDialog() {
  document.querySelector(OVERLAY_SELECTOR)?.remove()
  document.querySelector(TAB_SELECTOR)?.classList.remove('active')
}

function decorateDialog() {
  const overlay = document.querySelector(OVERLAY_SELECTOR)
  if (!overlay || overlay.dataset.jfsCloseReady) return
  overlay.dataset.jfsCloseReady = 'true'
  const card = overlay.querySelector('.jfs-folder-card')
  if (!card) return

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'jfs-folder-close'
  close.setAttribute('aria-label', '关闭保存文件夹')
  close.title = '关闭'
  close.textContent = '✕'
  close.addEventListener('click', closeDialog)
  card.prepend(close)

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeDialog()
  })
}

export default function FolderDialogGuard() {
  useEffect(() => {
    let frame = 0
    const enhance = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        decorateTab()
        decorateDialog()
      })
    }

    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true })
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && document.querySelector(OVERLAY_SELECTOR)) closeDialog()
    }
    document.addEventListener('keydown', onKeyDown)
    enhance()

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])
  return null
}
