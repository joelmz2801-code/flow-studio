import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  addFavorite, clearDownloadFolder, findBySource, getDownloadFolder,
  listFavorites, removeFavorite, saveDownloadFolder,
} from './storage.js'

const NAV_ATTR = 'data-jfs-favorites-nav'
const FAVORITE_ATTR = 'data-jfs-favorite-action'
const SETTINGS_ATTR = 'data-jfs-unified-settings'
const FOLDER_TAB_ATTR = 'data-jfs-folder-tab'
const FOLDER_OVERLAY_ID = 'jfs-folder-overlay'

const heartSvg = (filled = false) => `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.9"/></svg>`

function imageSource(image) { return image.currentSrc || image.src || '' }

function isPhoto(image) {
  if (!imageSource(image)) return false
  if (image.closest('.sidebar, .brand, .auth-page, [class*="avatar"], [class*="logo"], [class*="reference"], .jfs-favorites-page')) return false
  const width = image.naturalWidth || image.getBoundingClientRect().width
  const height = image.naturalHeight || image.getBoundingClientRect().height
  return width >= 220 && height >= 220 && Boolean(image.closest('.msg, .message, [class*="assistant"], [class*="media"]'))
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

function ensureHideStyle() {
  if (document.getElementById('jfs-hide-native-settings')) return
  const style = document.createElement('style')
  style.id = 'jfs-hide-native-settings'
  style.textContent = '.sidebar .sb-foot .sb-item.sb-settings:not([' + SETTINGS_ATTR + ']){display:none!important}'
  document.head.appendChild(style)
}

function findAnchorButton(message) {
  const buttons = [...message.querySelectorAll('button')].filter((b) => !b.matches(`[${FAVORITE_ATTR}]`))
  const byTitle = buttons.find((b) => /重新生成|参考图/.test(b.title || b.getAttribute('aria-label') || ''))
  if (byTitle) return byTitle
  return buttons.find((b) => /复制/.test(b.title || b.getAttribute('aria-label') || '')) || null
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
    ensureHideStyle()
    refresh().catch(() => notify('收藏夹读取失败'))
    getDownloadFolder().then((handle) => setFolder(handle || null)).catch(() => {})
  }, [refresh, notify])

  const chooseFolder = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      notify('请使用最新版 Chrome 或 Edge 选择固定下载文件夹')
      return null
    }
    try {
      const handle = await window.showDirectoryPicker({ id: 'flow-studio-downloads', mode: 'readwrite' })
      await saveDownloadFolder(handle)
      setFolder(handle)
      notify(`已保存文件夹：${handle.name}`)
      return handle
    } catch (error) {
      if (error?.name !== 'AbortError') notify('选择文件夹失败')
      return null
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

  // 保存文件夹面板：作为 body 级独立遮置，不修改 React 内容，彻底避开冲突。
  const closeFolderOverlay = useCallback(() => {
    document.getElementById(FOLDER_OVERLAY_ID)?.remove()
    document.querySelector(`[${FOLDER_TAB_ATTR}]`)?.classList.remove('active')
  }, [])

  const openFolderOverlay = useCallback(() => {
    closeFolderOverlay()
    const current = folderRef.current
    const overlay = document.createElement('div')
    overlay.id = FOLDER_OVERLAY_ID
    overlay.className = 'jfs-folder-overlay'
    overlay.innerHTML = `<div class="jfs-folder-card" role="dialog" aria-label="保存文件夹"><div class="jfs-folder-copy"><span>DOWNLOAD LOCATION</span><h2>保存文件夹</h2><p>选择一个文件夹后，照片下载会自动保存到这里。浏览器会在必要时再次请求授权。</p></div><div class="jfs-folder-current"><div><strong>${current ? current.name : '浏览器默认下载位置'}</strong><span>${current ? '已保存到此设备' : '尚未选择固定文件夹'}</span></div><div class="jfs-folder-actions"><button type="button" data-choose>${current ? '更换文件夹' : '选择文件夹'}</button>${current ? '<button type="button" data-reset>恢复默认</button>' : ''}</div></div></div>`
    overlay.querySelector('[data-choose]').onclick = async () => { const h = await chooseFolder(); if (h !== undefined) { closeFolderOverlay(); openFolderOverlay() } }
    overlay.querySelector('[data-reset]')?.addEventListener('click', async () => { await forgetFolder(); closeFolderOverlay(); openFolderOverlay() })
    document.body.appendChild(overlay)
  }, [chooseFolder, closeFolderOverlay, forgetFolder])

  const openFolderRef = useRef(openFolderOverlay)
  const closeFolderRef = useRef(closeFolderOverlay)
  openFolderRef.current = openFolderOverlay
  closeFolderRef.current = closeFolderOverlay

  useEffect(() => {
    const target = document.getElementById('root') || document.body
    let observer

    const addFavoritesEntry = () => {
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

    const unifySidebarSettings = () => {
      const foot = document.querySelector('.sidebar .sb-foot')
      if (!foot || foot.querySelector(`[${SETTINGS_ATTR}]`)) return
      const account = [...foot.querySelectorAll('button')].find((button) => button.textContent.trim() === '账户设置')
      if (!account) return
      const settings = document.createElement('button')
      settings.type = 'button'
      settings.className = 'sb-item sb-settings jfs-unified-settings'
      settings.setAttribute(SETTINGS_ATTR, 'true')
      settings.innerHTML = '<span class="sb-item-icon"><svg viewBox="0 0 24 24" width="15" height="15"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span><span class="sb-item-label">设置</span>'
      settings.onclick = () => account.click()
      foot.insertBefore(settings, foot.firstChild)
    }

    const addFolderTab = () => {
      if (document.querySelector(`[${FOLDER_TAB_ATTR}]`)) return
      const buttons = [...document.querySelectorAll('button')]
      const promptTab = buttons.find((button) => button.textContent.trim() === '提示词' && !button.closest('.sidebar'))
      if (!promptTab) return
      const tabs = promptTab.parentElement
      const accountTab = [...tabs.querySelectorAll('button')].find((button) => button.textContent.trim() === '账户')
      const apiTab = [...tabs.querySelectorAll('button')].find((button) => button.textContent.trim() === 'API 设置')
      if (!accountTab || !apiTab) return
      const folderTab = document.createElement('button')
      folderTab.type = 'button'
      folderTab.className = promptTab.className
      folderTab.setAttribute(FOLDER_TAB_ATTR, 'true')
      folderTab.textContent = '保存文件夹'
      promptTab.insertAdjacentElement('afterend', folderTab)
      // 点其他三个原生 tab → 关揉文件夹遮置，交回 React 控制
      ;[accountTab, apiTab, promptTab].forEach((tab) => tab.addEventListener('click', () => closeFolderRef.current()))
      folderTab.onclick = () => {
        ;[accountTab, apiTab, promptTab].forEach((tab) => tab.classList.remove('active'))
        folderTab.classList.add('active')
        openFolderRef.current()
      }
    }

    const addPhotoButtons = () => {
      document.querySelectorAll('img').forEach((image) => {
        if (!isPhoto(image)) return
        const source = imageSource(image)
        const message = image.closest('.msg, .message, [class*="message"], [class*="assistant"]')
        if (!message) return
        const anchor = findAnchorButton(message)
        if (!anchor) return
        const toolbar = anchor.parentElement
        if (!toolbar || toolbar.querySelector(`[${FAVORITE_ATTR}]`)) return
        const button = document.createElement('button')
        button.type = 'button'
        button.className = anchor.className
        button.classList.add('jfs-favorite-icon')
        button.setAttribute(FAVORITE_ATTR, 'true')
        const saved = favoritesRef.current.some((item) => item.source === source)
        button.classList.toggle('is-saved', saved)
        button.title = saved ? '取消收藏' : '收藏'
        button.setAttribute('aria-label', button.title)
        button.innerHTML = heartSvg(saved)
        button.onclick = (event) => {
          event.preventDefault()
          event.stopPropagation()
          toggleFavorite(source, message.textContent || '').catch(() => notify('收藏失败'))
        }
        toolbar.insertBefore(button, anchor)
      })
    }

    let scheduled = null
    const runWrites = () => {
      scheduled = null
      if (observer) observer.disconnect()
      try {
        ensureHideStyle()
        addFavoritesEntry()
        unifySidebarSettings()
        addFolderTab()
        addPhotoButtons()
        // 设置弹窗关闭时（tab 不在了）自动收起文件夹遮置
        if (!document.querySelector(`[${FOLDER_TAB_ATTR}]`)) closeFolderRef.current()
      } finally {
        if (observer) {
          observer.takeRecords()
          observer.observe(target, { childList: true, subtree: true })
        }
      }
    }
    const schedule = () => {
      if (scheduled) return
      scheduled = setTimeout(runWrites, 120)
    }
    observer = new MutationObserver(schedule)
    observer.observe(target, { childList: true, subtree: true })
    runWrites()
    return () => { observer.disconnect(); if (scheduled) clearTimeout(scheduled) }
  }, [notify, toggleFavorite])

  useEffect(() => {
    const count = document.querySelector('.jfs-favorites-count')
    if (count) count.textContent = favorites.length ? String(favorites.length) : ''
    document.querySelectorAll(`[${FAVORITE_ATTR}]`).forEach((button) => {
      const message = button.closest('.msg, .message, [class*="message"], [class*="assistant"]')
      const image = message?.querySelector('img')
      const saved = image && favorites.some((item) => item.source === imageSource(image))
      button.classList.toggle('is-saved', Boolean(saved))
      button.title = saved ? '取消收藏' : '收藏'
      button.setAttribute('aria-label', button.title)
      button.innerHTML = heartSvg(Boolean(saved))
    })
  }, [favorites])

  useEffect(() => {
    if (!favoritesOpen) return
    const onClick = (event) => {
      const item = event.target.closest('.sidebar .sb-item, .sidebar .new-chat-btn')
      if (item && !item.closest('.jfs-favorites-entry-wrap')) setFavoritesOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') setFavoritesOpen(false) }
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [favoritesOpen])

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

  return (
    <>
      {favoritesOpen && <FavoritesPage favorites={favorites} onClose={() => setFavoritesOpen(false)} onRemove={async (id) => { await removeFavorite(id); await refresh(); notify('已移除收藏') }} />}
      {notice && <div className="jfs-favorites-toast" role="status">{notice}</div>}
    </>
  )
}

function FavoritesPage({ favorites, onClose, onRemove }) {
  return (
    <section className="jfs-favorites-page" aria-label="收藏夹">
      <header><div><span>MY LIBRARY</span><h1>收藏夹</h1><p>{favorites.length ? `${favorites.length} 张已收藏照片，点左侧任意对话即可返回` : '喜欢的照片会保存在这台设备上'}</p></div></header>
      {favorites.length === 0 ? <div className="jfs-favorites-empty"><div dangerouslySetInnerHTML={{ __html: heartSvg(false) }} /><h2>还没有收藏</h2><p>生成喜欢的照片后，点击图片操作栏里的小爱心。</p><button onClick={onClose}>返回创作</button></div> : <main>{favorites.map((item) => <article key={item.id}><img src={item.source} alt={item.prompt || '收藏照片'} /><div><time>{new Date(item.createdAt).toLocaleString()}</time>{item.prompt && <p>{item.prompt}</p>}<button onClick={() => onRemove(item.id)}>移除收藏</button></div></article>)}</main>}
    </section>
  )
}
