import React, { useCallback, useEffect, useMemo, useState } from 'react'

const DB_NAME = 'jfs-local-library'
const DB_VERSION = 1
const FAVORITES = 'favorites'
const SETTINGS = 'settings'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FAVORITES)) db.createObjectStore(FAVORITES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function dbGetAll(storeName) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

async function dbGet(storeName, key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function dbPut(storeName, value, key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value, key)
    request.onsuccess = () => resolve(value)
    request.onerror = () => reject(request.error)
  })
}

async function dbDelete(storeName, key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function safeName(name) {
  return String(name || 'flow-studio-image').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 90)
}

function extensionFrom(source, type = '') {
  const match = String(source || '').match(/\.([a-z0-9]{2,5})(?:$|[?#])/i)
  if (match) return match[1].toLowerCase()
  if (type.includes('jpeg')) return 'jpg'
  if (type.includes('webp')) return 'webp'
  if (type.includes('gif')) return 'gif'
  if (type.includes('mp4')) return 'mp4'
  return 'png'
}

async function sourceToBlob(source) {
  const response = await fetch(source)
  if (!response.ok) throw new Error('无法读取文件')
  return response.blob()
}

function HeartIcon({ filled = false }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" /></svg>
}

export default function FeatureHub() {
  const [favorites, setFavorites] = useState([])
  const [open, setOpen] = useState(false)
  const [folder, setFolder] = useState(null)
  const [toast, setToast] = useState('')

  const notify = useCallback((message) => {
    setToast(message)
    window.clearTimeout(window.__jfsFeatureToast)
    window.__jfsFeatureToast = window.setTimeout(() => setToast(''), 2200)
  }, [])

  const refresh = useCallback(async () => {
    const items = await dbGetAll(FAVORITES)
    setFavorites(items.sort((a, b) => b.createdAt - a.createdAt))
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
    dbGet(SETTINGS, 'downloadDirectory').then(setFolder).catch(() => {})
  }, [refresh])

  const chooseFolder = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      notify('当前浏览器不支持固定下载文件夹，请使用最新版 Chrome 或 Edge')
      return
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'jfs-downloads' })
      await dbPut(SETTINGS, handle, 'downloadDirectory')
      setFolder(handle)
      notify(`下载文件夹已设为：${handle.name}`)
    } catch (error) {
      if (error?.name !== 'AbortError') notify('文件夹设置失败')
    }
  }, [notify])

  const ensureFolderPermission = useCallback(async (handle) => {
    if (!handle) return false
    if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true
    return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
  }, [])

  const saveToFolder = useCallback(async (source, preferredName) => {
    if (!folder || !(await ensureFolderPermission(folder))) return false
    const blob = await sourceToBlob(source)
    const ext = extensionFrom(source, blob.type)
    const filename = `${safeName(preferredName)}-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`
    const fileHandle = await folder.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    notify(`已保存到 ${folder.name}`)
    return true
  }, [folder, ensureFolderPermission, notify])

  const addFavorite = useCallback(async (source, prompt = '') => {
    const existing = favorites.find((item) => item.source === source)
    if (existing) {
      await dbDelete(FAVORITES, existing.id)
      await refresh()
      notify('已取消收藏')
      return
    }
    let blob = null
    try { blob = await sourceToBlob(source) } catch { /* URL 仍可保存 */ }
    await dbPut(FAVORITES, {
      id: crypto.randomUUID(), source, blob, prompt: prompt.trim(), createdAt: Date.now(),
    })
    await refresh()
    notify('已加入收藏夹')
  }, [favorites, refresh, notify])

  useEffect(() => {
    const openFavorites = () => setOpen(true)
    window.addEventListener('jfs:open-favorites', openFavorites)
    return () => window.removeEventListener('jfs:open-favorites', openFavorites)
  }, [])

  useEffect(() => {
    let scheduled = false
    const decorate = () => {
      scheduled = false
      const pageTitles = [...document.querySelectorAll('.sb-section-title')]
      const pageSection = pageTitles.find((el) => el.textContent.trim() === '页面')?.parentElement
      if (pageSection && !pageSection.querySelector('[data-jfs-favorites-nav]')) {
        const button = document.createElement('button')
        button.className = 'sb-item'
        button.dataset.jfsFavoritesNav = 'true'
        button.innerHTML = '<span class="sb-item-icon"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></span><span class="sb-item-label">收藏夹</span>'
        button.onclick = () => setOpen(true)
        pageSection.appendChild(button)
      }

      const collapsed = document.querySelector('.sidebar.collapsed')
      if (collapsed && !collapsed.querySelector('[data-jfs-favorites-collapsed]')) {
        const button = document.createElement('button')
        button.className = 'icon-btn'
        button.dataset.jfsFavoritesCollapsed = 'true'
        button.title = '收藏夹'
        button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
        button.onclick = () => setOpen(true)
        const spacer = collapsed.querySelector('.sb-spacer')
        collapsed.insertBefore(button, spacer || null)
      }

      const settingsButtons = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'API 设置')
      const settingsButton = settingsButtons.find((b) => !b.closest('.sidebar'))
      if (settingsButton) {
        let root = settingsButton.parentElement
        while (root?.parentElement && root.getBoundingClientRect().width < 480) root = root.parentElement
        if (root && !root.querySelector('[data-jfs-download-setting]')) {
          const panel = document.createElement('section')
          panel.className = 'jfs-download-setting'
          panel.dataset.jfsDownloadSetting = 'true'
          panel.innerHTML = `<div><strong>下载文件夹</strong><span>${folder ? `当前：${folder.name}` : '未设置，下载时使用浏览器默认位置'}</span></div><button type="button">${folder ? '更换文件夹' : '选择文件夹'}</button>`
          panel.querySelector('button').onclick = chooseFolder
          settingsButton.parentElement.insertAdjacentElement('afterend', panel)
        }
      }

      const images = document.querySelectorAll('.msg.assistant img, .message.assistant img, [class*="assistant"] img')
      images.forEach((img) => {
        if (img.dataset.jfsFavoriteReady || img.naturalWidth && img.naturalWidth < 160) return
        const source = img.currentSrc || img.src
        if (!source) return
        const host = img.closest('[class*="media"]') || img.parentElement
        if (!host || host.querySelector(':scope > [data-jfs-favorite-button]')) return
        img.dataset.jfsFavoriteReady = 'true'
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'jfs-favorite-button'
        button.dataset.jfsFavoriteButton = 'true'
        const isSaved = favorites.some((item) => item.source === source)
        button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" ${isSaved ? 'fill="currentColor"' : 'fill="none"'} stroke="currentColor" stroke-width="1.8"/></svg><span>${isSaved ? '已收藏' : '收藏'}</span>`
        button.onclick = (event) => {
          event.preventDefault()
          event.stopPropagation()
          const message = img.closest('.msg, .message, [class*="message"]')
          addFavorite(source, message?.textContent || '')
        }
        host.appendChild(button)
      })
    }
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(decorate)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    decorate()
    return () => observer.disconnect()
  }, [favorites, folder, chooseFolder, addFavorite])

  useEffect(() => {
    const intercept = async (event) => {
      const button = event.target.closest?.('button, a')
      if (!button || button.dataset.jfsFavoriteButton) return
      const label = `${button.textContent || ''} ${button.title || ''} ${button.getAttribute('aria-label') || ''}`
      if (!/下载|download/i.test(label) || !folder) return
      const host = button.closest('.msg, .message, [class*="media"], [class*="message"]')
      const media = host?.querySelector('img, video')
      const source = media?.currentSrc || media?.src
      if (!source) return
      event.preventDefault()
      event.stopPropagation()
      try { await saveToFolder(source, 'flow-studio') } catch { notify('保存失败，请重新选择下载文件夹') }
    }
    window.addEventListener('click', intercept, true)
    return () => window.removeEventListener('click', intercept, true)
  }, [folder, saveToFolder, notify])

  return (
    <>
      {open && <FavoritesView favorites={favorites} onClose={() => setOpen(false)} onRemove={async (id) => { await dbDelete(FAVORITES, id); refresh() }} onDownload={saveToFolder} chooseFolder={chooseFolder} folder={folder} notify={notify} />}
      {toast && <div className="jfs-feature-toast">{toast}</div>}
    </>
  )
}

function FavoritesView({ favorites, onClose, onRemove, onDownload, chooseFolder, folder, notify }) {
  const urls = useMemo(() => favorites.map((item) => item.blob ? URL.createObjectURL(item.blob) : item.source), [favorites])
  useEffect(() => () => urls.forEach((url, index) => favorites[index]?.blob && URL.revokeObjectURL(url)), [urls, favorites])
  return (
    <div className="jfs-favorites-view" role="dialog" aria-label="收藏夹">
      <header>
        <div><span className="jfs-eyebrow">MY LIBRARY</span><h1>收藏夹</h1><p>{favorites.length ? `已收藏 ${favorites.length} 张作品` : '喜欢的作品会留在这里'}</p></div>
        <div className="jfs-favorites-actions"><button onClick={chooseFolder}>{folder ? `下载到：${folder.name}` : '设置下载文件夹'}</button><button className="jfs-close" onClick={onClose} aria-label="关闭收藏夹">✕</button></div>
      </header>
      {favorites.length === 0 ? (
        <div className="jfs-favorites-empty"><HeartIcon /><h2>还没有收藏</h2><p>生成喜欢的照片后，点击照片底部的「收藏」。</p><button onClick={onClose}>返回创作</button></div>
      ) : (
        <main className="jfs-favorites-grid">
          {favorites.map((item, index) => <article key={item.id} className="jfs-favorite-card"><img src={urls[index]} alt={item.prompt || '收藏的生成图片'} /><div className="jfs-favorite-meta"><div><time>{new Date(item.createdAt).toLocaleString()}</time>{item.prompt && <p>{item.prompt.slice(0, 90)}</p>}</div><div className="jfs-card-actions"><button onClick={async () => { if (!folder) { chooseFolder(); return } try { await onDownload(urls[index], 'flow-studio-favorite') } catch { notify('下载失败') } }}>下载</button><button className="danger" onClick={() => onRemove(item.id)}>移除</button></div></div></article>)}
        </main>
      )}
    </div>
  )
}
