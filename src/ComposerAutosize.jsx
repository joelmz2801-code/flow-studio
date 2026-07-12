import { useEffect } from 'react'
import './composer-autosize.css'

const DESKTOP_MAX = 240
const MIN_HEIGHT = 44

function maxHeight() {
  return innerWidth <= 768 ? Math.min(240, Math.round(innerHeight * 0.34)) : DESKTOP_MAX
}

function resize(textarea) {
  if (!textarea || !textarea.closest('.main-area')) return
  const limit = maxHeight()
  textarea.style.setProperty('height', 'auto', 'important')
  textarea.style.setProperty('max-height', `${limit}px`, 'important')
  const wanted = Math.max(MIN_HEIGHT, textarea.scrollHeight)
  const height = Math.min(limit, wanted)
  textarea.style.setProperty('height', `${height}px`, 'important')
  textarea.dataset.jfsOverflow = wanted > limit ? 'true' : 'false'
}

export default function ComposerAutosize() {
  useEffect(() => {
    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        document.querySelectorAll('.main-area textarea').forEach(resize)
      })
    }

    const onInput = (event) => {
      if (event.target instanceof HTMLTextAreaElement) resize(event.target)
    }
    const onResize = () => scan()
    const onTemplate = () => {
      scan()
      setTimeout(scan, 0)
      setTimeout(scan, 80)
      setTimeout(scan, 220)
    }

    document.addEventListener('input', onInput, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('jfs:template-applied', onTemplate)

    const observer = new MutationObserver(scan)
    observer.observe(document.querySelector('.main-area') || document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['value', 'style']
    })

    const timer = window.setInterval(scan, 250)
    scan()

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('input', onInput, true)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('jfs:template-applied', onTemplate)
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return null
}
