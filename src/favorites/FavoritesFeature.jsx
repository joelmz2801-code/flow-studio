import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  addFavorite, clearDownloadFolder, findBySource, getDownloadFolder,
  listFavorites, removeFavorite, saveDownloadFolder,
} from './storage.js'

const NAV_ATTR = 'data-jfs-favorites-nav'
const FAVORITE_ATTR = 'data-jfs-favorite-action'
const SETTINGS_ATTR = 'data-jfs-unified-settings'
const FOLDER_TAB_ATTR = 'data-jfs-folder-tab'
const HIDE_CLASS = 'jfs-native-setting-hidden'

const heartSvg = (filled = false) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"/></svg>`
const gearSvg = '<svg viewBox="0 0 24 24" width="15" height="15"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 12a7.5 7.5 0 0 1 .1-1.2l-1.8-1.4 1.7-3 2.1.8a7.5 7.5 0 0 1 2-1.2L11 3h2l.4 2.2a7.5 7.5 0 0 1 2 1.2l2.1-.8 1.7 3-1.8 1.4a7.5 7.5 0 0 1 0 2.4l1.8 1.4-1.7 3-2.1-.8a7.5 7.5 0 0 1-2 1.2L13 21h-2l-.4-2.2a7.5 7.5 0 0 1-2-1.2l-2.1.8-1.7-3 1.8-1.4A7.5 7.5 0 0 1 4.5 12Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'

function imageSource(image) { return image.currentSrc || image.src || '' }

function isPhoto(image) {
  if (!imageSource(image)) return false
  if (image.closest('.sidebar, .brand, .auth-page, .jfs-favorites-page, [class*="avatar"], [class*="logo"], [class*="reference"]')) return false
  const width = image.naturalWidth || image.getBoundingClientRect().width
  const height = image.naturalHeight || image.getBoundingClientRect().height
  return width >= 220 && height >= 220 && Boolean(image.closest('.msg, .message, [class*="assistant"], [class*="media"]'))
}

function safeName(value) {
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
  const [folderOpen, setFolderOpen] = useState(false)
  const [folder, setFolder] = useState(null)
  const [notice, setNotice] = useState('')
  const favoritesRef = useRef(favorites)
  favoritesRef.current = favorites

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
    if (!folder) return false
    let permission = await folder.queryPermission({ mode: 'readwrite' })
    if (permission !== 'granted') permission = await folder.requestPermission({ mode: 'readwrite' })
    if (permission !== 'granted') throw new Error('未授权下载文件夹')
    const blob = await sourceBlob(source)
    const ext = fileExtension(source, blob.type || '')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileHandle = await folder.getFileHandle(`${safeName('flow-studio')}-${stamp}.${ext}`, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    notify(`已保存到 ${folder.name}`)
    return true
  }, [folder, notify])

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

  // 单一 observer：写 DOM 前先断开，写完再重连，彻底消除自触发死循环（卡顿根因）
  useEffect(() => {
    const root = document.getElementById('root') || document.body
    let observer = null
    let scheduled = false

    const addFavoritesEntry = () => {
      if (document.querySelector(`[${NAV_ATTR}]`)) return
      const search = document.querySelector('.sidebar .search-box')
      if (!search) return
      const wrap = document.createElement('div')
      wrap.className = 'jfs-favorites-entry-wrap'
      wrap.setAttribute(NAV_ATTR, 'true')
      wrap.innerHTML = `<button type="button" class="sb-item jfs-favorites-entry"><span class="sb-item-icon">${heartSvg(false)}</span><span class="sb-item-label">收藏夹</span><span class="jfs-favorites-count">${favoritesRef.current.length || ''}</span></button>`
      wrap.querySelector('button').onclick = () => setFavoritesOpen(true)
      search.insertAdjacentElement('afterend', wrap)
    }

    const unifySettings = () => {
      // 展开态页脚：隐藏「账户设置」「API 设置」，注入单一「设置」
      const foot = document.querySelector('.sidebar .sb-foot')
      if (foot && !foot.querySelector(`[${SETTINGS_ATTR}]`)) {
        const buttons = [...foot.querySelectorAll('button')]
        const account = buttons.find((b) => b.textContent.trim() === '账户设置')
        const api = buttons.find((b) => b.textContent.trim() === 'API 设置')
        if (account && api) {
          account.classList.add(HIDE_CLASS)
          api.classList.add(HIDE_CLASS)
          const settings = document.createElement('button')
          settings.type = 'button'
          settings.className = 'sb-item sb-settings jfs-unified-settings'
          settings.setAttribute(SETTINGS_ATTR, 'true')
          settings.innerHTML = `<span class="sb-item-icon">${gearSvg}</span><span class="sb-item-label">设置</span>`
          settings.onclick = () => account.click()
          foot.insertBefore(settings, account)
        }
      }
      // 收起态：隐藏两个图标按钮，注入单一齿轮
      const collapsed = document.querySelector('.sidebar.collapsed')
      if (collapsed && !collapsed.querySelector(`[${SETTINGS_ATTR}]`)) {
        const accountIcon = collapsed.querySelector('.icon-btn[title="账户设置"]')
        const apiIcon = collapsed.querySelector('.icon-btn[title="API 设置"]')
        if (accountIcon && apiIcon) {
          accountIcon.classList.add(HIDE_CLASS)
          apiIcon.classList.add(HIDE_CLASS)
          const settings = document.createElement('button')
          settings.type = 'button'
          settings.className = 'icon-btn jfs-unified-settings'
          settings.title = '设置'
          settings.setAttribute(SETTINGS_ATTR, 'true')
          settings.innerHTML = gearSvg.replace('width="15" height="15"', 'width="18" height="18"')
          settings.onclick = () => accountIcon.click()
          accountIcon.insertAdjacentElement('beforebegin', settings)
        }
      }
    }

    const addFolderTab = () => {
      const buttons = [...document.querySelectorAll('button')]
      const promptTab = buttons.find((b) => b.textContent.trim() === '提示词' && !b.closest('.sidebar'))
      if (!promptTab) return
      const tabRow = promptTab.parentElement
      if (!tabRow || tabRow.querySelector(`[${FOLDER_TAB_ATTR}]`)) return
      const folderTab = document.createElement('button')
      folderTab.type = 'button'
      folderTab.className = promptTab.className
      folderTab.setAttribute(FOLDER_TAB_ATTR, 'true')
      folderTab.textContent = '保存文件夹'
      folderTab.onclick = () => setFolderOpen(true)
      promptTab.insertAdjacentElement('afterend', folderTab)
    }

    const addPhotoButtons = () => {
      document.querySelectorAll('.msg img, .message img, [class*="assistant"] img, [class*="media"] img').forEach((image) => {
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

    const run = () => {
      scheduled = false
      if (observer) observer.disconnect()
      try {
        addFavoritesEntry()
        unifySettings()
        addFolderTab()
        addPhotoButtons()
      } finally {
        if (observer) observer.observe(root, { childList: true, subtree: true })
      }
    }
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(run)
    }
    observer = new MutationObserver(schedule)
    observer.observe(root, { childList: true, subtree: true })
    run()
    return () => { if (observer) observer.disconnect() }
  }, [notify, toggleFavorite])

  // 收藏状态变化时同步图片按钮与计数（不重建节点）
  useEffect(() => {
    const count = document.querySelector('.jfs-favorites-count')
    if (count) count.textContent = favorites.length ? String(favorites.length) : ''
    document.querySelectorAll(`[${FAVORITE_ATTR}]`).forEach((button) => {
      const image = button.parentElement?.querySelector('img')
      const saved = image && favorites.some((item) => item.source === imageSource(image))
      button.classList.toggle('is-saved', Boolean(saved))
      button.innerHTML = `${heartSvg(Boolean(saved))}<span>${saved ? '已收藏' : '收藏'}</span>`
    })
  }, [favorites])

  // 点击侧边栏任意导航项（除收藏夹入口本身）自动关闭收藏夹，不再需要 X
  useEffect(() => {
    if (!favoritesOpen) return
    const onClick = (event) => {
      if (!event.target.closest('.sidebar')) return
      if (event.target.closest('.jfs-favorites-entry')) return
      if (event.target.closest('.sb-item, .new-chat-btn, .icon-btn')) setFavoritesOpen(false)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [favoritesOpen])

  // 拦截下载：已设置文件夹时，照片下载自动存到该目录
  useEffect(() => {
    const intercept = async (event) => {
      if (!folder) return
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
    window.addEventListener('click', intercept, true)
    return () => window.removeEventListener('click', intercept, true)
  }, [folder, notify, writePhoto])

  return (
    <>
      {favoritesOpen && <FavoritesPage favorites={favorites} onRemove={async (id) => { await removeFavorite(id); await refresh(); notify('已移除收藏') }} />}
      {folderOpen && <FolderPanel folder={folder} onChoose={chooseFolder} onReset={forgetFolder} onClose={() => setFolderOpen(false)} />}
      {notice && <div className="jfs-favorites-toast" role="status">{notice}</div>}
    </>
  )
}

function FavoritesPage({ favorites, onRemove }) {
  return (
    <section className="jfs-favorites-page" aria-label="收藏夹">
      <header><span>MY LIBRARY</span><h1>收藏夹</h1><p>{favorites.length ? `${favorites.length} 张已收藏照片・点左侧对话即可返回` : '喜欢的照片会保存在这台设备上'}</p></header>
      {favorites.length === 0 ? (
        <div className="jfs-favorites-empty"><div dangerouslySetInnerHTML={{ __html: heartSvg(false) }} /><h2>还没有收藏</h2><p>生成喜欢的照片后，点击图片右下角的收藏按钮。</p></div>
      ) : (
        <main>{favorites.map((item) => <article key={item.id}><img src={item.source} alt={item.prompt || '收藏照片'} /><div><time>{new Date(item.createdAt).toLocaleString()}</time>{item.prompt && <p>{item.prompt}</p>}<button onClick={() => onRemove(item.id)}>移除收藏</button></div></article>)}</main>
      )}
    </section>
  )
}

function FolderPanel({ folder, onChoose, onReset, onClose }) {
  return (
    <section className="jfs-folder-overlay" aria-label="保存文件夹">
      <header><div><span>DOWNLOAD LOCATION</span><h1>保存文件夹</h1><p>选择一个文件夹后，照片下载会自动保存到这里。</p></div><button className="jfs-folder-back" onClick={onClose}>返回设置</button></header>
      <div className="jfs-folder-current"><div><strong>{folder ? folder.name : '浏览器默认下载位置'}</strong><span>{folder ? '已保存到此设备，浏览器会在必要时再次请求授权' : '尚未选择固定文件夹'}</span></div><div className="jfs-folder-actions"><button className="primary" onClick={onChoose}>{folder ? '更换文件夹' : '选择文件夹'}</button>{folder && <button onClick={onReset}>恢复默认</button>}</div></div>
    </section>
  )
}
