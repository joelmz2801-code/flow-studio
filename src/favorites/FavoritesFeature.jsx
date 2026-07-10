import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addFavorite, findBySource, listFavorites, removeFavorite } from './storage.js'

const NAV_MARKER = 'data-jfs-favorites-nav'
const BUTTON_MARKER = 'data-jfs-favorite-action'

function Heart({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function imageSource(image) {
  return image.currentSrc || image.src || ''
}

function isGeneratedImage(image) {
  if (!imageSource(image)) return false
  if (image.closest('.sidebar, .brand, .auth-page, [class*="avatar"], [class*="logo"]')) return false
  const rect = image.getBoundingClientRect()
  const width = image.naturalWidth || rect.width
  const height = image.naturalHeight || rect.height
  if (width < 220 || height < 220) return false
  return Boolean(image.closest('.msg, .message, [class*="assistant"], [class*="media"]'))
}

export default function FavoritesFeature() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const itemsRef = useRef(items)
  itemsRef.current = items

  const refresh = useCallback(async () => setItems(await listFavorites()), [])

  const notify = useCallback((message) => {
    setNotice(message)
    window.clearTimeout(window.__jfsFavoriteNotice)
    window.__jfsFavoriteNotice = window.setTimeout(() => setNotice(''), 1800)
  }, [])

  useEffect(() => { refresh().catch(() => notify('收藏夹读取失败')) }, [refresh, notify])

  const toggle = useCallback(async (source, prompt = '') => {
    if (!source) return
    const existing = await findBySource(source)
    if (existing) {
      await removeFavorite(existing.id)
      notify('已取消收藏')
    } else {
      await addFavorite({
        id: crypto.randomUUID(),
        source,
        prompt: prompt.trim().slice(0, 500),
        createdAt: Date.now(),
      })
      notify('已收藏')
    }
    await refresh()
  }, [notify, refresh])

  useEffect(() => {
    const addNavigation = () => {
      if (document.querySelector(`[${NAV_MARKER}]`)) return
      const headings = [...document.querySelectorAll('.sb-section-title')]
      const pageHeading = headings.find((node) => node.textContent.trim() === '页面')
      const section = pageHeading?.closest('.sb-section') || pageHeading?.parentElement
      if (!section) return
      const promptButton = [...section.querySelectorAll('.sb-item')].find((node) => node.textContent.includes('提示词'))
      if (!promptButton) return

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'sb-item jfs-favorites-nav'
      button.setAttribute(NAV_MARKER, 'true')
      button.innerHTML = '<span class="sb-item-icon"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></span><span class="sb-item-label">收藏夹</span>'
      button.addEventListener('click', () => setOpen(true))
      promptButton.insertAdjacentElement('afterend', button)
    }

    const addImageButtons = () => {
      document.querySelectorAll('img').forEach((image) => {
        if (!isGeneratedImage(image)) return
        const source = imageSource(image)
        const wrapper = image.closest('[class*="media"]') || image.parentElement
        if (!wrapper || wrapper.querySelector(`:scope > [${BUTTON_MARKER}]`)) return

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'jfs-favorite-action'
        button.setAttribute(BUTTON_MARKER, 'true')
        const update = () => {
          const saved = itemsRef.current.some((item) => item.source === source)
          button.classList.toggle('is-saved', saved)
          button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" ${saved ? 'fill="currentColor"' : 'fill="none"'} stroke="currentColor" stroke-width="1.8"/></svg><span>${saved ? '已收藏' : '收藏'}</span>`
        }
        update()
        button.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          const message = image.closest('.msg, .message, [class*="message"]')
          toggle(source, message?.textContent || '').catch(() => notify('收藏失败'))
        })
        wrapper.appendChild(button)
      })
    }

    let frame = 0
    const renderEnhancements = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        addNavigation()
        addImageButtons()
      })
    }
    const observer = new MutationObserver(renderEnhancements)
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })
    renderEnhancements()
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [toggle, notify])

  useEffect(() => {
    document.querySelectorAll(`[${BUTTON_MARKER}]`).forEach((button) => {
      const image = button.parentElement?.querySelector('img')
      const saved = image && items.some((item) => item.source === imageSource(image))
      button.classList.toggle('is-saved', Boolean(saved))
      const span = button.querySelector('span')
      const path = button.querySelector('path')
      if (span) span.textContent = saved ? '已收藏' : '收藏'
      if (path) path.setAttribute('fill', saved ? 'currentColor' : 'none')
    })
  }, [items])

  return (
    <>
      {open && <FavoritesPage items={items} onClose={() => setOpen(false)} onRemove={async (id) => { await removeFavorite(id); await refresh(); notify('已移除') }} />}
      {notice && <div className="jfs-favorites-toast" role="status">{notice}</div>}
    </>
  )
}

function FavoritesPage({ items, onClose, onRemove }) {
  const countText = items.length ? `${items.length} 张已收藏作品` : '喜欢的作品会保存在这台设备上'
  return (
    <section className="jfs-favorites-page" aria-label="收藏夹">
      <header className="jfs-favorites-header">
        <div><span>MY LIBRARY</span><h1>收藏夹</h1><p>{countText}</p></div>
        <button className="jfs-favorites-close" onClick={onClose} aria-label="关闭收藏夹">✕</button>
      </header>
      {items.length === 0 ? (
        <div className="jfs-favorites-empty"><Heart /><h2>还没有收藏</h2><p>生成喜欢的照片后，点击照片底部的「收藏」。</p><button onClick={onClose}>返回创作</button></div>
      ) : (
        <div className="jfs-favorites-grid">
          {items.map((item) => (
            <article className="jfs-favorite-item" key={item.id}>
              <img src={item.source} alt={item.prompt || '收藏的生成图片'} />
              <div className="jfs-favorite-info"><time>{new Date(item.createdAt).toLocaleString()}</time>{item.prompt && <p>{item.prompt}</p>}<button onClick={() => onRemove(item.id)}>移除收藏</button></div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
