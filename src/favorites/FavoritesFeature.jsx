import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  addFavorite, clearDownloadFolder, findBySource, getDownloadFolder,
  listFavorites, removeFavorite, saveDownloadFolder,
} from './storage.js'

const NAV_ATTR = 'data-jfs-favorites-nav'
const FAVORITE_ATTR = 'data-jfs-favorite-action'
const SETTINGS_ATTR = 'data-jfs-unified-settings'
const FOLDER_TAB_ATTR = 'data-jfs-folder-tab'
const HIDDEN_CLASS = 'jfs-hidden-native'

const heartSvg = (filled = false) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"/></svg>`

function imageSource(image) { return image.currentSrc || image.src || '' }

function findByText(selector, text, { outsideSidebar = false } = {}) {
  return [...document.querySelectorAll(selector)].find((node) => {
    if (node.textContent.trim() !== text) return false
    if (outsideSidebar && node.closest('.sidebar')) return false
    return true
  }) || null
}

function isPhoto(image) {
  if (!imageSource(image)) return false
  if (image.closest('.jfs-favorites-page, .sidebar, .brand, .auth-page, [class*="avatar"], [class*="logo"], [class*="reference"]')) return false
  const width = image.naturalWidth || image.clientWidth
  const height = image.naturalHeight || image.clientHeight
  if (width < 220 || height < 220) return false
  return Boolean(image.closest('.msg, .message, [class*="assistant"], [class*="media"]'))
}

function safeFileName(value) {
  return String(value || 'flow-studio-photo').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 70)
}

async function sourceBlob(source) {
  const response = await fetch(source)
  if (!response.ok) throw new Error('读取照片失败')
  return response.blob()
}

function fileExtension(source, type) {
  const matched = String(source).match(/\.([a-z0-9]{2,5})(?:$|[?#])/i)
  if (matched) return matched[1].toLowerCase()
  if (type.includes('jpeg')) return 'jpg'
  if (type.includes('webp')) return 'webp'
  if (type.includes('gif')) return 'gif'
  return 'png'
}

export default function FavoritesFeature() {
  const [favorites, setFavorites] = useState([])
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [folder, setFolder] = useState(null)
  const [notice, setNotice] = useState('')
  const favoritesRef = useRef(favorites)
  const folderRef = useRef(folder)
  favoritesRef.current = favorites
  folderRef.current = folder

  const refresh = useCallback(async () => setFavorites(await listFavorites()), [])
  const notify = useCallback((message) => {
    setNotice(message)
    clearTimeout(window.__jfsFavoriteNotice)
    window.__jfsFavoriteNotice = setTimeout(() => setNotice(''), 1900)
  }, [])

  useEffect(() => {
    refresh().catch(() => notify('收藏夹读取失败'))
    getDownloadFolder().then((handle) => setFolder(handle || null)).catch(() => {})
  }, [refresh, notify])

  const chooseFolder = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      notify('请使用最新版 Chrome 或 Edge 选择固定下载文件夹')
      return
    }
    try {
      const handle = await window.showDirectoryPicker({ id: 'flow-studio-downloads', mode: 'readwrite' })
      await saveDownloadFolder(handle)
      setFolder(handle)
      notify(`已保存文件夹：${handle.name}`)
    } catch (error) {
      if (error?.name !== 'AbortError') notify('选择文件夹失败')
    }
  }, [notify])

  const forgetFolder = useCallback(async () => {
    await clearDownloadFolder()
    setFolder(null)
    notify('已恢复浏览器默认下载位置')
  }, [notify])

  const writePhoto = useCallback(async (source) => {
    const handle = folderRef.current
    if (!handle) return false
    let permission = await handle.queryPermission({ mode: 'readwrite' })
    if (permission !== 'granted') permission = await handle.requestPermission({ mode: 'readwrite' })
    if (permission !== 'granted') throw new Error('未授权下载文件夹')
    const blob = await sourceBlob(source)
    const ext = fileExtension(source, blob.type || '')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileHandle = await handle.getFileHandle(`${safeFileName('flow-studio')}-${stamp}.${ext}`, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    notify(`已保存到 ${handle.name}`)
    return true
  }, [notify])

  const toggleFavorite = useCallback(async (source, prompt = '') => {
    const existing = await findBySource(source)
    if (existing) {
      await removeFavorite(existing.id)
      notify('已取消收藏')
    } else {
      await addFavorite({ id: crypto.randomUUID(), source, prompt: prompt.trim().slice(0, 500), createdAt: Date.now() })
      notify('照片已收藏')
    }
    await refresh()
  }, [notify, refresh])

  // ── DOM 增强：去抖运行，避免 MutationObserver 反馈环导致卡顿 ──
  useEffect(() => {
    const ensureFavoritesEntry = () => {
      if (document.querySelector(`[${NAV_ATTR}]`)) return
      const search = document.querySelector('.sidebar .search-box')
      if (!search) return
      const wrapper = document.createElement('div')
      wrapper.className = 'jfs-favorites-entry-wrap'
      wrapper.setAttribute(NAV_ATTR, 'true')
      wrapper.innerHTML = `<button type="button" class="sb-item jfs-favorites-entry"><span class="sb-item-icon">${heartSvg(false)}</span><span class="sb-item-label">收藏夹</span><span class="jfs-favorites-count">${favoritesRef.current.length || ''}</span></button>`
      wrapper.querySelector('button').onclick = () => setFavoritesOpen(true)
      search.insertAdjacentElement('afterend', wrapper)
    }

    // 每次都重新隐藏原生入口（React 重渲染会把它们带回来）
    const hideNativeSettings = () => {
      const foot = document.querySelector('.sidebar .sb-foot')
      if (foot) {
        foot.querySelectorAll('button').forEach((button) => {
          const text = button.textContent.trim()
          if ((text === '账户设置' || text === 'API 设置') && !button.classList.contains(HIDDEN_CLASS)) {
            button.classList.add(HIDDEN_CLASS)
          }
        })
      }
      const collapsed = document.querySelector('.sidebar.collapsed')
      if (collapsed) {
        collapsed.querySelectorAll('button').forEach((button) => {
          const title = button.getAttribute('title')
          if ((title === '账户设置' || title === 'API 设置') && !button.classList.contains(HIDDEN_CLASS)) {
            button.classList.add(HIDDEN_CLASS)
          }
        })
      }
    }

    const ensureUnifiedSettings = () => {
      hideNativeSettings()
      const foot = document.querySelector('.sidebar .sb-foot')
      if (foot && !foot.querySelector(`[${SETTINGS_ATTR}]`)) {
        const settings = document.createElement('button')
        settings.type = 'button'
        settings.className = 'sb-item sb-settings jfs-unified-settings'
        settings.setAttribute(SETTINGS_ATTR, 'true')
        settings.innerHTML = '<span class="sb-item-icon"><svg viewBox="0 0 24 24" width="15" height="15"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span><span class="sb-item-label">设置</span>'
        // 不缓存节点：点击时实时查找当前“账户设置”按钮并触发，避免 React 重渲染后引用失效
        settings.onclick = () => {
          const foot2 = document.querySelector('.sidebar .sb-foot')
          const account = foot2 && [...foot2.querySelectorAll('button')].find((b) => b.textContent.trim() === '账户设置')
          setFavoritesOpen(false)
          if (account) account.click()
        }
        const firstNative = [...foot.querySelectorAll('button')].find((b) => b.textContent.trim() === '账户设置')
        foot.insertBefore(settings, firstNative || foot.firstChild)
      }
    }

    const ensureFolderTab = () => {
      if (document.querySelector(`[${FOLDER_TAB_ATTR}]`)) return
      const accountTab = findByText('button', '账户', { outsideSidebar: true })
      const apiTab = findByText('button', 'API 设置', { outsideSidebar: true })
      const promptTab = findByText('button', '提示词', { outsideSidebar: true })
      if (!accountTab || !apiTab || !promptTab) return
      const tabs = accountTab.parentElement
      if (!tabs || !tabs.contains(apiTab) || !tabs.contains(promptTab)) return
      const root = tabs.closest('[class*="modal"], [class*="settings"]') || tabs.parentElement?.parentElement
      if (!root) return
      root.classList.add('jfs-settings-root')

      const folderTab = document.createElement('button')
      folderTab.type = 'button'
      folderTab.className = promptTab.className
      folderTab.setAttribute(FOLDER_TAB_ATTR, 'true')
      folderTab.textContent = '保存文件夹'

      const closePanel = () => {
        root.classList.remove('jfs-folder-open')
        root.querySelector('.jfs-folder-panel')?.remove()
        folderTab.classList.remove('active')
      }
      ;[accountTab, apiTab, promptTab].forEach((tab) => tab.addEventListener('click', closePanel))

      folderTab.onclick = () => {
        root.classList.add('jfs-folder-open')
        root.querySelectorAll('.jfs-settings-tab-active-shim')
        ;[accountTab, apiTab, promptTab].forEach((tab) => tab.classList.remove('active'))
        folderTab.classList.add('active')
        root.querySelector('.jfs-folder-panel')?.remove()
        const handle = folderRef.current
        const panel = document.createElement('section')
        panel.className = 'jfs-folder-panel'
        panel.innerHTML = `<div class="jfs-folder-copy"><span>DOWNLOAD LOCATION</span><h2>保存文件夹</h2><p>选择一个文件夹后，照片下载会自动保存到这里。浏览器会在必要时再次请求授权。</p></div><div class="jfs-folder-current"><div><strong>${handle ? handle.name : '浏览器默认下载位置'}</strong><span>${handle ? '已保存到此设备' : '尚未选择固定文件夹'}</span></div><div class="jfs-folder-actions"><button type="button" data-choose>${handle ? '更换文件夹' : '选择文件夹'}</button>${handle ? '<button type="button" data-reset>恢复默认</button>' : ''}</div></div>`
        panel.querySelector('[data-choose]').onclick = () => chooseFolder()
        panel.querySelector('[data-reset]')?.addEventListener('click', () => forgetFolder())
        tabs.insertAdjacentElement('afterend', panel)
      }
      promptTab.insertAdjacentElement('afterend', folderTab)
    }

    const ensurePhotoButtons = () => {
      document.querySelectorAll('img').forEach((image) => {
        if (!isPhoto(image)) return
        const source = imageSource(image)
        const frame = image.parentElement
        if (!frame || frame.querySelector(`:scope > [${FAVORITE_ATTR}]`)) return
        frame.classList.add('jfs-photo-frame')
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'jfs-photo-favorite'
        button.setAttribute(FAVORITE_ATTR, 'true')
        const saved = favoritesRef.current.some((item) => item.source === source)
        button.classList.toggle('is-saved', saved)
        button.innerHTML = `${heartSvg(saved)}<span>${saved ? '已收藏' : '收藏'}</span>`
        button.onclick = (event) => {
          event.preventDefault()
          event.stopPropagation()
          const message = image.closest('.msg, .message, [class*="message"]')
          toggleFavorite(source, message?.textContent || '').catch(() => notify('收藏失败'))
        }
        frame.appendChild(button)
      })
    }

    let timer = 0
    const runEnhance = () => {
      ensureFavoritesEntry()
      ensureUnifiedSettings()
      ensureFolderTab()
      ensurePhotoButtons()
    }
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(runEnhance, 160)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })
    runEnhance()
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [chooseFolder, forgetFolder, notify, toggleFavorite])

  // 收藏状态变化时，同步计数与每个收藏按钮的外观
  useEffect(() => {
    const counter = document.querySelector('.jfs-favorites-count')
    if (counter) counter.textContent = favorites.length ? String(favorites.length) : ''
    document.querySelectorAll(`[${FAVORITE_ATTR}]`).forEach((button) => {
      const image = button.parentElement?.querySelector('img')
      const saved = image && favorites.some((item) => item.source === imageSource(image))
      button.classList.toggle('is-saved', Boolean(saved))
      button.innerHTML = `${heartSvg(Boolean(saved))}<span>${saved ? '已收藏' : '收藏'}</span>`
    })
  }, [favorites])

  // 下载拦截：设了文件夹时，把照片写入固定目录
  useEffect(() => {
    const interceptDownload = async (event) => {
      if (!folderRef.current) return
      const target = event.target.closest?.('button, a')
      if (!target) return
      const label = `${target.textContent || ''} ${target.title || ''} ${target.getAttribute('aria-label') || ''}`
      if (!/下载|download/i.test(label)) return
      const container = target.closest('.msg, .message, [class*="message"], [class*="media"]')
      const image = container?.querySelector('img')
      if (!image || !isPhoto(image)) return
      event.preventDefault()
      event.stopPropagation()
      try { await writePhoto(imageSource(image)) } catch (error) { notify(error.message || '保存失败') }
    }
    window.addEventListener('click', interceptDownload, true)
    return () => window.removeEventListener('click', interceptDownload, true)
  }, [notify, writePhoto])

  // 收藏夹打开时：点击侧边栏任意对话/页面 或 Esc 自动退出（取代左上角 X）
  useEffect(() => {
    if (!favoritesOpen) return
    const onClick = (event) => {
      const item = event.target.closest?.('.sidebar .sb-item, .sidebar .new-chat-btn, .sidebar .icon-btn')
      if (item && !item.closest('.jfs-favorites-entry') && !item.hasAttribute(NAV_ATTR)) setFavoritesOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') setFavoritesOpen(false) }
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('keydown', onKey) }
  }, [favoritesOpen])

  return (
    <>
      {favoritesOpen && <FavoritesPage favorites={favorites} onRemove={async (id) => { await removeFavorite(id); await refresh(); notify('已移除收藏') }} />}
      {notice && <div className="jfs-favorites-toast" role="status">{notice}</div>}
    </>
  )
}

function FavoritesPage({ favorites, onRemove }) {
  return (
    <section className="jfs-favorites-page" aria-label="收藏夹">
      <header><div><span>MY LIBRARY</span><h1>收藏夹</h1><p>{favorites.length ? `${favorites.length} 张已收藏照片 · 点左侧对话即可返回` : '喜欢的照片会保存在这台设备上'}</p></div></header>
      {favorites.length === 0 ? (
        <div className="jfs-favorites-empty"><div dangerouslySetInnerHTML={{ __html: heartSvg(false) }} /><h2>还没有收藏</h2><p>生成喜欢的照片后，点击图片右下角的收藏按钮。</p></div>
      ) : (
        <main>{favorites.map((item) => (
          <article key={item.id}><img src={item.source} alt={item.prompt || '收藏照片'} /><div><time>{new Date(item.createdAt).toLocaleString()}</time>{item.prompt && <p>{item.prompt}</p>}<button onClick={() => onRemove(item.id)}>移除收藏</button></div></article>
        ))}</main>
      )}
    </section>
  )
}
