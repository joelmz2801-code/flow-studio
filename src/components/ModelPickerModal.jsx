import React, { useState, useMemo } from 'react'

/**
 * 模型挑选窗口
 * - 用户在主页面点击"获取模型列表"后弹出
 * - 显示所有新加载的模型（以及未设 type 的旧模型）
 * - 用户逐个设置 type / visible（收藏）
 * - 关闭窗口时把选好的模型合并到 preset.models
 */
export default function ModelPickerModal({ open, onClose, onConfirm, existingModels = [], newModelIds = [] }) {
  // 合并：未设 type 的旧模型 + 全新模型
  const initial = useMemo(() => {
    const out = []
    const seen = new Set()
    // 未设 type 的旧模型也带进来
    existingModels.forEach((m) => {
      if (!seen.has(m.id)) {
        seen.add(m.id)
        if (!m.type) {
          out.push({ id: m.id, type: null, visible: !!m.visible, isDefault: !!m.isDefault, isFavorite: !!m.isFavorite })
        }
      }
    })
    // 新加载的模型
    newModelIds.forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id)
        out.push({ id, type: null, visible: false, isDefault: false, isFavorite: false })
      }
    })
    return out
  }, [existingModels, newModelIds])

  const [picks, setPicks] = useState(initial)
  const [search, setSearch] = useState('')

  // 重新打开时刷新 picks
  React.useEffect(() => {
    if (open) setPicks(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  if (!open) return null

  const setPick = (id, patch) => {
    setPicks((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const cycleType = (id, current) => {
    const cycle = [null, 'image', 'chat', 'video']
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length]
    setPick(id, { type: next })
  }

  const filtered = picks.filter((p) => !search || p.id.toLowerCase().includes(search.toLowerCase()))

  const counts = {
    total: picks.length,
    unset: picks.filter((p) => !p.type).length,
    image: picks.filter((p) => p.type === 'image').length,
    chat: picks.filter((p) => p.type === 'chat').length,
    video: picks.filter((p) => p.type === 'video').length,
    selected: picks.filter((p) => p.type && p.visible).length,
  }

  const handleConfirm = () => {
    onConfirm(picks)
  }

  const handleSkip = () => {
    // 只保存已设 type 的，visible = false 的不进对话框
    onConfirm(picks.filter((p) => p.type))
  }

  return (
    <div className="modal-mask modal-mask-picker" onClick={onClose}>
      <div className="modal modal-picker" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">选择模型类型</div>
            <div className="modal-subtitle">
              共 {counts.total} 个未分类模型 · 已设置 {counts.total - counts.unset} 个 · 已收藏 {counts.selected} 个
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="picker-toolbar">
          <input
            className="picker-search"
            placeholder="搜索模型..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="picker-stats">
            <span className="stat-chip unset">未设置 {counts.unset}</span>
            <span className="stat-chip image">image {counts.image}</span>
            <span className="stat-chip chat">text {counts.chat}</span>
            <span className="stat-chip video">video {counts.video}</span>
          </div>
        </div>

        <div className="picker-list">
          {filtered.length === 0 ? (
            <div className="picker-empty">没有未分类的模型</div>
          ) : (
            filtered.map((p) => (
              <div key={p.id} className={`picker-row ${!p.type ? 'no-type' : ''} ${p.visible ? 'is-selected' : ''}`}>
                <button
                  className={`picker-fav ${p.visible ? 'active' : ''}`}
                  onClick={() => setPick(p.id, { visible: !p.visible })}
                  title={p.visible ? '已收藏（对话框可见）' : '点击收藏'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={p.visible ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
                <span className="picker-name" title={p.id}>{p.id}</span>
                <button
                  className={`picker-type type-${p.type || 'unset'}`}
                  onClick={() => cycleType(p.id, p.type)}
                  title="点击循环切换类型"
                >
                  {p.type === 'image' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/></svg>}
                  {p.type === 'chat' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                  {p.type === 'video' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>}
                  {!p.type && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                  <span>{p.type || '请选择'}</span>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="picker-footer">
          <div className="picker-hint">
            💡 点击「☆」收藏模型（对话框中可见），点击「类型」切换 image / text / video
          </div>
          <div className="picker-actions">
            <button className="picker-btn ghost" onClick={handleSkip}>跳过未设置的</button>
            <button className="picker-btn primary" onClick={handleConfirm}>
              完成（{counts.selected} 个已收藏）
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
