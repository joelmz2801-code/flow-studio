import { useEffect } from 'react'

const MAX_HEIGHT = 160
const MIN_HEIGHT = 44

function resize(textarea, force = false) {
  if (!textarea || !textarea.closest('.main-area')) return
  const value = textarea.value || ''
  const width = textarea.clientWidth
  if (!force && textarea.dataset.autosizeValue === value && textarea.dataset.autosizeWidth === String(width)) return

  textarea.dataset.autosizeValue = value
  textarea.dataset.autosizeWidth = String(width)
  textarea.style.height = '0px'
  const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, textarea.scrollHeight))
  textarea.style.height = `${height}px`
  textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
}

export default function ComposerAutosize() {
  useEffect(() => {
    const scan = (force = false) => {
      document.querySelectorAll('.main-area textarea').forEach((textarea) => resize(textarea, force))
    }

    const onInput = (event) => {
      if (event.target instanceof HTMLTextAreaElement) resize(event.target, true)
    }
    const onResize = () => scan(true)

    document.addEventListener('input', onInput, true)
    window.addEventListener('resize', onResize)
    const observer = new MutationObserver(() => scan(true))
    observer.observe(document.querySelector('.main-area') || document.body, { childList: true, subtree: true })

    // React 程序化写入 value 不触发 input。短轮询只在值或宽度变化时重算。
    const timer = window.setInterval(() => scan(false), 120)
    scan(true)

    return () => {
      document.removeEventListener('input', onInput, true)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return null
}
