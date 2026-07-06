import React, { useMemo, useState } from 'react'
import { useStore } from './store.js'
import { PROMPT_CATEGORIES, PROMPT_LIBRARY } from './prompts.js'

const FAV_KEY = 'jfs-prompt-favs'
const MINE_KEY = 'jfs-prompt-mine'
const loadJson = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d }
}

export default function PromptLibrary() {
  const { promptLibOpen, setPromptLibOpen, usePrompt } = useStore()
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [favs, setFavs] = useState(() => loadJson(FAV_KEY, []))
  const [mine, setMine] = useState(() => loadJson(MINE_KEY, []))
  const [draft, setDraft] = useState('')

  const items = useMemo(() => {
    let list
    if (cat === 'mine') list = mine.map((m, i) => ({ ...m, c: 'mine', _mi: i }))
    else if (cat === 'fav') list = PROMPT_LIBRARY.filter((x) => favs.includes(x.t)).concat(mine.filter((m) => favs.includes(m.t)).map((m, i) => ({ ...m, c: 'mine' })))
    else if (cat === 'all') list = PROMPT_LIBRARY
    else list = PROMPT_LIBRARY.filter((x) => x.c === cat)
    const kw = q.trim().toLowerCase()
    if (kw) list = list.filter((x) => x.t.toLowerCase().includes(kw) || x.p.toLowerCase().includes(kw))
    return list
  }, [cat, q, favs, mine])

  if (!promptLibOpen) return null

  const toggleFav = (t) => {
    const next = favs.includes(t) ? favs.filter((x) => x !== t) : [...favs, t]
    setFavs(next)
    localStorage.setItem(FAV_KEY, JSON.stringify(next))
  }
  const saveMine = () => {
    const p = draft.trim()
    if (!p) return
    const t = p.slice(0, 12) + (p.length > 12 ? '…' : '')
    const next = [{ t, p }, ...mine]
    setMine(next)
    localStorage.setItem(MINE_KEY, JSON.stringify(next))
    setDraft('')
  }
  const delMine = (i) => {
    const next = mine.filter((_, j) => j !== i)
    setMine(next)
    localStorage.setItem(MINE_KEY, JSON.stringify(next))
  }
  const surprise = () => {
    const pool = PROMPT_LIBRARY
    usePrompt(pool[Math.floor(Math.random() * pool.length)].p)
  }
  const catName = (id) => PROMPT_CATEGORIES.find((x) => x.id === id)?.name || '我的'

  return (
    <div className="plib-backdrop" onClick={() => setPromptLibOpen(false)}>
      <div className="plib" onClick={(e) => e.stopPropagation()}>
        <div className="plib-head">
          <div className="plib-title">
            <span className="plib-title-ic">💡</span> 提示词灵感库
          </div>
          <button className="plib-dice" onClick={surprise} title="随机来一个灵感，直接填入输入框">
            🎲 随机灵感
          </button>
          <button className="icon-btn plib-close" onClick={() => setPromptLibOpen(false)} title="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="plib-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索灵感，如「赛博朋克」「美食」…" />
          {q && <button className="search-clear" onClick={() => setQ('')}>✕</button>}
        </div>

        <div className="plib-cats">
          <button className={`plib-cat ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>✨ 全部</button>
          <button className={`plib-cat ${cat === 'fav' ? 'active' : ''}`} onClick={() => setCat('fav')}>⭐ 收藏</button>
          <button className={`plib-cat ${cat === 'mine' ? 'active' : ''}`} onClick={() => setCat('mine')}>✍️ 我的</button>
          {PROMPT_CATEGORIES.map((c) => (
            <button key={c.id} className={`plib-cat ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {cat === 'mine' && (
          <div className="plib-mine-add">
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="把常用提示词存在这里，随取随用…"
            />
            <button className="plib-save" onClick={saveMine} disabled={!draft.trim()}>保存</button>
          </div>
        )}

        <div className="plib-grid">
          {items.length === 0 && (
            <div className="plib-empty">
              {cat === 'fav' ? '还没有收藏，点卡片上的 ⭐ 收藏喜欢的灵感' : cat === 'mine' ? '还没有自己的提示词，在上方输入并保存' : '没有匹配的灵感，换个关键词试试'}
            </div>
          )}
          {items.map((it, i) => (
            <div key={(it.t || '') + i} className="plib-card">
              <div className="plib-card-head">
                <span className="plib-card-title">{it.t}</span>
                <span className="plib-card-cat">{catName(it.c)}</span>
              </div>
              <div className="plib-card-body">{it.p}</div>
              <div className="plib-card-foot">
                <button
                  className={`plib-star ${favs.includes(it.t) ? 'on' : ''}`}
                  onClick={() => toggleFav(it.t)}
                  title={favs.includes(it.t) ? '取消收藏' : '收藏'}
                >
                  {favs.includes(it.t) ? '★' : '☆'}
                </button>
                {it.c === 'mine' && cat === 'mine' && (
                  <button className="plib-del" onClick={() => delMine(it._mi)} title="删除">删除</button>
                )}
                <span className="spacer" />
                <button className="plib-use" onClick={() => usePrompt(it.p)}>使用 →</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
