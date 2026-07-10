const SOURCE_ATTR = 'data-jfs-favorite-action'
const PROXY_ATTR = 'data-jfs-favorite-icon'

function referenceButtonIn(message) {
  const buttons = [...message.querySelectorAll('button')]
  return buttons.find((button) => {
    const label = [
      button.textContent,
      button.title,
      button.getAttribute('aria-label'),
    ].filter(Boolean).join(' ')
    return /添加为参考图|作为参考图|参考图|reference/i.test(label)
  }) || null
}

function sourceButtonFor(message) {
  const buttons = [...message.querySelectorAll(`button[${SOURCE_ATTR}]`)]
  return buttons.find((button) => !button.hasAttribute(PROXY_ATTR)) || null
}

function syncProxy(proxy, source) {
  const saved = source.classList.contains('is-saved')
  proxy.classList.toggle('is-saved', saved)
  proxy.setAttribute('aria-label', saved ? '取消收藏' : '收藏照片')
  proxy.title = saved ? '取消收藏' : '收藏照片'
  proxy.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"/></svg>`
}

function enhanceMessage(message) {
  const reference = referenceButtonIn(message)
  const source = sourceButtonFor(message)
  if (!reference || !source) return

  source.classList.add('jfs-favorite-source-hidden')
  let proxy = message.querySelector(`button[${PROXY_ATTR}]`)
  if (!proxy) {
    proxy = document.createElement('button')
    proxy.type = 'button'
    proxy.className = `${reference.className || ''} jfs-favorite-icon-action`.trim()
    proxy.setAttribute(PROXY_ATTR, 'true')
    proxy.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      source.click()
      requestAnimationFrame(() => syncProxy(proxy, source))
    })
    reference.insertAdjacentElement('afterend', proxy)
  }
  syncProxy(proxy, source)
}

function enhance() {
  document.querySelectorAll('.msg, .message, [class*="message"]').forEach(enhanceMessage)
}

let timer = null
const schedule = () => {
  if (timer) return
  timer = window.setTimeout(() => {
    timer = null
    enhance()
  }, 100)
}

const start = () => {
  enhance()
  const root = document.getElementById('root') || document.body
  const observer = new MutationObserver(schedule)
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
else start()
