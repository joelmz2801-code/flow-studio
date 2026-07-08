import React, { useState, useEffect, useRef } from 'react'
import { useStore, forceFlushPendingSaves } from './store.js'
import { useAuth } from './useAuth.js'
import { testApiConnection, fetchModelsList } from './engine/runner.js'
import { AVAILABLE_VARIABLES } from './engine/promptVariables.js'
import ModelPickerModal from './components/ModelPickerModal.jsx'

const EMPTY = {
  name: '',
  baseUrl: '',
  apiKey: '',
  imageModel: '',
  videoModel: '',
  chatPath: '/v1/chat/completions',
  imagePath: '/v1/images/generations',
  videoPath: '/v1/videos',
  models: [],
}


export default function SettingsModal() {
  const {
    settingsOpen, setSettingsOpen, settingsTab, setSettingsTab,
    presets, addPreset, updatePreset, removePreset,
    customPrompts, addCustomPrompt, updateCustomPrompt, removeCustomPrompt, moveCustomPrompt,
  } = useStore()
  const { user, signOut, isAuthEnabled } = useAuth()
  const [activeId, setActiveId] = useState(presets[0]?.id || null)
  const [draft, setDraft] = useState(null)

  // 提示词 textarea ref 映射（id -> ref）
  const promptTextareaRefs = React.useRef({})
  // 当前聚焦的提示词 id（用于决定变量插入到哪一行）
  const [focusedPromptId, setFocusedPromptId] = useState(null)

  // 把变量插入到当前聚焦的提示词（聚焦时记录 id；未聚焦则插入到最后一条）
  const insertVariable = (key) => {
    const targetId = focusedPromptId || (customPrompts[customPrompts.length - 1]?.id)
    if (!targetId) return
    const ta = promptTextareaRefs.current[targetId]
    if (!ta) return
    const insertText = `{{${key}}}`
    const start = ta.selectionStart ?? (ta.value || '').length
    const end = ta.selectionEnd ?? start
    const next = (ta.value || '').slice(0, start) + insertText + (ta.value || '').slice(end)
    updateCustomPrompt(targetId, { text: next })
    // 把光标移到插入文本之后
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + insertText.length
      try { ta.setSelectionRange(pos, pos) } catch { /* ignore */ }
    })
  }

  // Custom states
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [notify, setNotify] = useState(null) // { type: 'success'|'error'|'info', message: '...' }
  // 自定义添加模型表单状态
  const [showAddForm, setShowAddForm] = useState(false)
  const [newModelName, setNewModelName] = useState('')
  const [newModelType, setNewModelType] = useState('image')
  // 是否显示全部模型汇总视图
  const [showAllModels, setShowAllModels] = useState(false)
  // 模型类型筛选
  const [modelTypeFilter, setModelTypeFilter] = useState('all')
  // 模型挑选窗口：获取模型后弹出
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerNewIds, setPickerNewIds] = useState([])
  // 接口路径配置展开
  const [showPaths, setShowPaths] = useState(false)

  const showNotification = (type, message) => {
    setNotify({ type, message })
    setTimeout(() => setNotify((prev) => prev?.message === message ? null : prev), 6000)
  }


  const active = presets.find((p) => p.id === activeId) || null

  useEffect(() => {
    if (settingsOpen) {
      const first = presets.find((p) => p.id === activeId) || presets[0]
      setActiveId(first?.id || null)
      setDraft(first ? { ...first, models: first.models || [] } : null)
      setShowKey(false)
      setModelSearchQuery('')
      setNotify(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen])

  // ── 自动保存：draft 一旦变化且与已保存快照不同，立即持久化 ──
  // ⚠️ 必须在早期 return 之前声明 hooks，否则 React 会抛 #310
  const lastSavedRef = useRef(null)
  useEffect(() => {
    if (!draft || !activeId) return
    if (!settingsOpen) return
    const snapshot = JSON.stringify({ ...draft, models: draft.models || [] })
    if (lastSavedRef.current === snapshot) return
    lastSavedRef.current = snapshot
    updatePreset(activeId, draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, activeId, settingsOpen])

  if (!settingsOpen && !pickerOpen) return null

  const select = (p) => {
    setActiveId(p.id)
    setDraft({ ...p, models: p.models || [] })
    setShowKey(false)
    setModelSearchQuery('')
    lastSavedRef.current = JSON.stringify({ ...p, models: p.models || [] })
  }

  const create = () => {
    const preset = { ...EMPTY, name: `预设 ${presets.length + 1}` }
    addPreset(preset)
    setTimeout(() => {
      const list = useStore.getState().presets
      const last = list[list.length - 1]
      setActiveId(last.id)
      setDraft({ ...last, models: last.models || [] })
      lastSavedRef.current = JSON.stringify({ ...last, models: last.models || [] })
    }, 0)
  }

  const save = () => {
    if (!draft || !activeId) return
    updatePreset(activeId, draft)
  }

  const remove = () => {
    if (!activeId) return
    removePreset(activeId)
    setTimeout(() => {
      const list = useStore.getState().presets
      const first = list[0] || null
      setActiveId(first?.id || null)
      setDraft(first ? { ...first, models: first.models || [] } : null)
    }, 0)
  }

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))
  const dirty = active && draft && JSON.stringify(pick(active)) !== JSON.stringify(pick(draft))

  // Model actions
  const toggleModelVisible = (modelId) => {
    setDraft((d) => ({
      ...d,
      models: (d.models || []).map((m) =>
        m.id === modelId ? { ...m, visible: !m.visible } : m
      )
    }))
  }

  const toggleModelDefault = (modelId) => {
    setDraft((d) => {
      const targetModel = d.models.find(x => x.id === modelId)
      const willBeDefault = targetModel ? !targetModel.isDefault : false
      const updatedModels = (d.models || []).map((m) => {
        if (m.id === modelId) {
          return { ...m, isDefault: willBeDefault, visible: willBeDefault ? true : m.visible }
        }
        if (targetModel && m.type === targetModel.type) {
          return { ...m, isDefault: false }
        }
        return m
      })

      const patch = { models: updatedModels }
      if (targetModel) {
        if (targetModel.type === 'video') {
          patch.videoModel = willBeDefault ? modelId : ''
        } else {
          patch.imageModel = willBeDefault ? modelId : ''
        }
      }
      return { ...d, ...patch }
    })
  }

  const toggleModelType = (modelId) => {
    const cycle = { image: 'video', video: 'chat', chat: 'image' }
    setDraft((d) => ({
      ...d,
      models: (d.models || []).map((m) =>
        m.id === modelId ? { ...m, type: cycle[m.type || 'image'] || 'image' } : m
      )
    }))
  }

  const setModelType = (modelId, newType) => {
    setDraft((d) => ({
      ...d,
      models: (d.models || []).map((m) =>
        m.id === modelId ? { ...m, type: newType } : m
      )
    }))
  }

  const toggleModelFavorite = (modelId) => {
    setDraft((d) => ({
      ...d,
      models: (d.models || []).map((m) =>
        m.id === modelId ? { ...m, isFavorite: !m.isFavorite } : m
      )
    }))
  }

  const deleteModel = (modelId) => {
    setDraft((d) => ({
      ...d,
      models: (d.models || []).filter((m) => m.id !== modelId)
    }))
  }

  const hideAllModels = () => {
    setDraft((d) => ({
      ...d,
      models: (d.models || []).map((m) => ({ ...m, visible: false }))
    }))
  }

  const handleAddModel = () => {
    const name = newModelName.trim()
    if (!name) {
      showNotification('info', '请输入模型名称')
      return
    }
    const exists = (draft?.models || []).some(m => m.id === name)
    if (exists) {
      showNotification('error', `模型「${name}」已存在`)
      return
    }
    const newModel = {
      id: name,
      visible: true,
      isDefault: false,
      type: newModelType
    }
    setDraft((d) => ({ ...d, models: [...(d.models || []), newModel] }))
    showNotification('success', `已添加模型「${name}」，默认已收藏（对话框可见）`)
    setNewModelName('')
    setNewModelType('image')
    setShowAddForm(false)
  }

  const cancelAddModel = () => {
    setNewModelName('')
    setNewModelType('image')
    setShowAddForm(false)
  }

  const fetchPresetModels = async () => {
    if (!draft.baseUrl) {
      showNotification('info', '请先填写 Base URL')
      return
    }
    setFetching(true)
    try {
      const list = await fetchModelsList(draft.baseUrl, draft.apiKey)
      // 过滤掉 draft 中已存在的
      const existingIds = new Set((draft?.models || []).map((m) => m.id))
      const newIds = list.filter((id) => !existingIds.has(id))
      if (newIds.length === 0) {
        showNotification('info', `已加载 ${list.length} 个模型，无新增`)
        return
      }
      // 弹出挑选窗口，不直接写入 draft
      setPickerNewIds(newIds)
      setPickerOpen(true)
    } catch (err) {
      showNotification('error', `获取失败: ${err.message} (通常由于跨域CORS限制，您仍可在列表中手动添加/启用模型)`)
    } finally {
      setFetching(false)
    }
  }

  // Picker 确认后，把选中的模型合并到 draft.models
  const handlePickerConfirm = (picks) => {
    setDraft((d) => {
      const currentModels = d.models || []
      const result = [...currentModels]
      picks.forEach((p) => {
        const idx = result.findIndex((m) => m.id === p.id)
        if (idx >= 0) {
          // 已存在 → 合并（更新 type/visible/isDefault/isFavorite）
          result[idx] = { ...result[idx], type: p.type, visible: p.visible, isDefault: p.isDefault, isFavorite: p.isFavorite }
        } else if (p.type) {
          // 新增（跳过未设 type 的）
          result.push({ id: p.id, type: p.type, visible: !!p.visible, isDefault: !!p.isDefault, isFavorite: !!p.isFavorite })
        }
      })
      return { ...d, models: result }
    })
    const added = picks.filter((p) => p.type).length
    showNotification('success', `已添加 ${added} 个模型到当前预设`)
    setPickerOpen(false)
  }

  const handleTestConnection = async () => {
    if (!draft.baseUrl) {
      showNotification('info', '请先填写 Base URL')
      return
    }
    setTesting(true)
    try {
      const res = await testApiConnection(draft.baseUrl, draft.apiKey)
      if (res.success) {
        showNotification('success', `连接成功！可用模型数: ${res.count}`)
      } else {
        showNotification('error', `连接失败: ${res.error}`)
      }
    } catch (err) {
      showNotification('error', `测试异常: ${err.message}`)
    } finally {
      setTesting(false)
    }
  }


  const filteredModels = (draft?.models || []).filter(m => {
    const matchSearch = !modelSearchQuery || m.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
    const matchType = modelTypeFilter === 'all' ? true :
      modelTypeFilter === 'null' ? !m.type :
      (m.type || '') === modelTypeFilter
    return matchSearch && matchType
  })

  // Group models by type instead of prefix
  const MODEL_TYPE_GROUPS = [
    { type: 'image', label: '图片模型', icon: '🖼' },
    { type: 'video', label: '视频模型', icon: '🎬' },
    { type: 'chat',  label: '文本模型', icon: '💬' },
  ]
  const groupedByType = MODEL_TYPE_GROUPS.map(g => ({
    ...g,
    items: filteredModels.filter(m => (m.type || 'image') === g.type),
  })).filter(g => g.items.length > 0)

  // 汇总所有预设中已添加的模型
  const allAddedModels = presets.flatMap(p =>
    (p.models || []).map(m => ({
      ...m,
      presetId: p.id,
      presetName: p.name || '未命名',
    }))
  )
  const allModelsGrouped = MODEL_TYPE_GROUPS.map(g => ({
    ...g,
    items: allAddedModels.filter(m => (m.type || 'image') === g.type),
  })).filter(g => g.items.length > 0)

  const tab = settingsTab || 'api'

  return (
    <div className="modal-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false) }}>
      <div className="modal modal-settings-split">
        <div className="modal-header">
          <div>
            <h2>{tab === 'account' ? '账户设置' : 'API 设置'}</h2>
            <p>{tab === 'account' ? '管理登录账户与个人信息' : '管理 API 预设、密钥与模型列表'}</p>
          </div>
          <button className="icon-btn" onClick={() => setSettingsOpen(false)} title="关闭">✕</button>
        </div>

        {/* 顶部 Tab 切换 */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${tab === 'account' ? 'active' : ''}`}
            onClick={() => setSettingsTab('account')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            账户
          </button>
          <button
            className={`settings-tab ${tab === 'api' ? 'active' : ''}`}
            onClick={() => setSettingsTab('api')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 7h7v7"/><path d="M21 7l-9 9"/><path d="M3 17v-4a4 4 0 0 1 4-4h7" strokeLinecap="round"/></svg>
            API 设置
          </button>
          <button
            className={`settings-tab ${tab === 'prompts' ? 'active' : ''}`}
            onClick={() => setSettingsTab('prompts')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            提示词
          </button>
        </div>

        <div className="modal-body">
          {/* ────────────── 账户设置界面 ────────────── */}
          {tab === 'account' && (
            <div className="settings-pane account-pane">
              {isAuthEnabled && user ? (
                <>
                  <div className="account-hero">
                    <div className="account-hero-avatar">
                      {(user.email || user.user_metadata?.full_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="account-hero-meta">
                      <div className="account-hero-email">{user.email || '未知邮箱'}</div>
                      <div className="account-hero-sub">
                        {user.app_metadata?.provider ? `登录方式 · ${user.app_metadata.provider}` : '已登录'}
                      </div>
                    </div>
                  </div>

                  <div className="account-detail-list">
                    <div className="account-detail-row">
                      <span className="account-detail-label">邮箱</span>
                      <span className="account-detail-value">{user.email || '—'}</span>
                    </div>
                    <div className="account-detail-row">
                      <span className="account-detail-label">登录方式</span>
                      <span className="account-detail-value">{user.app_metadata?.provider || '邮箱'}</span>
                    </div>
                    <div className="account-detail-row">
                      <span className="account-detail-label">用户 ID</span>
                      <span className="account-detail-value mono">{user.id?.slice(0, 8) || '—'}…</span>
                    </div>
                    <div className="account-detail-row">
                      <span className="account-detail-label">注册时间</span>
                      <span className="account-detail-value">
                        {user.created_at ? new Date(user.created_at).toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="account-actions">
                    <button
                      className="btn-danger"
                      onClick={() => { forceFlushPendingSaves(); signOut(); setSettingsOpen(false); }}
                    >
                      退出登录
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-hint">未启用登录，无需账户设置</div>
              )}
            </div>
          )}

          {/* ────────────── API 设置界面 ────────────── */}
          {tab === 'api' && (
            <>
              <div className="preset-list">
                <div className="preset-view-toggle">
                  <button
                    className={`preset-view-btn ${!showAllModels ? 'active' : ''}`}
                    onClick={() => setShowAllModels(false)}
                  >预设管理</button>
                  <button
                    className={`preset-view-btn ${showAllModels ? 'active' : ''}`}
                    onClick={() => setShowAllModels(true)}
                  >全部模型</button>
                </div>
                {!showAllModels && (
                  <>
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        className={`preset-item ${p.id === activeId ? 'active' : ''}`}
                        onClick={() => select(p)}
                      >
                        <span className="preset-name">{p.name || '未命名'}</span>
                        <span className="preset-url">{p.baseUrl || '未设置 Base URL'}</span>
                      </button>
                    ))}
                    <button className="preset-add" onClick={create}>＋ 新建预设</button>
                  </>
                )}
                {showAllModels && (
                  <div className="all-models-sidebar">
                    <p className="all-models-hint">所有预设中已添加的模型汇总</p>
                    <div className="all-models-count">
                      {allAddedModels.length} 个模型
                    </div>
                  </div>
                )}
              </div>

              {showAllModels ? (
                <div className="preset-form">
                  <div className="settings-section">
                    <div className="settings-section-header">
                      <div className="settings-section-icon purple">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                      </div>
                      <div>
                        <div className="settings-section-title">已添加模型汇总</div>
                        <div className="settings-section-desc">所有预设中已添加的全部模型，可在此快速查找与定位</div>
                      </div>
                    </div>
                    {allAddedModels.length === 0 ? (
                      <div className="no-models-hint">尚未添加任何模型</div>
                    ) : (
                      <div className="settings-model-list">
                        {allModelsGrouped.map((group) => (
                          <div key={group.type} className="model-type-group">
                            <div className="model-type-group-header">
                              <span>{group.label}</span>
                              <span className="model-type-group-count">{group.items.length}</span>
                            </div>
                            <div className="model-type-group-body">
                              {group.items.map((m) => (
                                <div key={m.id + m.presetId} className={`settings-model-row ${m.visible ? 'is-visible' : 'is-hidden'}`}>
                                  <div className="settings-model-info">
                                    <span className="settings-model-name-text" title={m.id}>{m.id}</span>
                                    <span className="settings-model-preset-name">{m.presetName}</span>
                                  </div>
                                  <div className="settings-model-actions">
                                    <span className={`model-type-badge ${m.type || 'image'}`}>{m.type || 'image'}</span>
                                    <button
                                      className="model-act-btn"
                                      onClick={() => { select(presets.find(p => p.id === m.presetId)); setShowAllModels(false); }}
                                      title="跳转到该预设"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 7h7v7"/><path d="M21 7l-9 9"/><path d="M3 17v-4a4 4 0 0 1 4-4h7" strokeLinecap="round"/></svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
              <div className="preset-form preset-form-redesign">
                {notify && (
                  <div className={`preset-notify ${notify.type}`}>
                    <span>{notify.message}</span>
                    <button className="notify-close" onClick={(e) => { e.preventDefault(); setNotify(null); }}>✕</button>
                  </div>
                )}
                {!draft && <div className="empty-hint">暂无预设，点击左侧「新建预设」开始</div>}

                {draft && (
                  <>
                    {/* ── 预设名称行（名称 + 外部链接 + 启用开关） ── */}
                    <div className="api-preset-name-row">
                      <div className="api-preset-name-left">
                        <input
                          className="api-preset-name-input"
                          value={draft.name}
                          placeholder="预设名称"
                          onChange={set('name')}
                        />
                        <button className="icon-link-btn" title="在新窗口打开" onClick={(e) => { e.preventDefault(); if (draft.baseUrl) window.open(draft.baseUrl, '_blank') }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </button>
                      </div>
                      <label className="switch" title="启用/停用此预设">
                        <input
                          type="checkbox"
                          checked={draft.enabled !== false}
                          onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                        />
                        <span className="switch-slider"></span>
                      </label>
                    </div>

                    {/* ── API 密钥行 ── */}
                    <div className="api-field-block">
                      <div className="api-field-label-row">
                        <span className="api-field-label">API 密钥</span>
                        <button className="icon-link-btn" title="复制当前密钥" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(draft.apiKey || ''); showNotification('success', '已复制'); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>
                        </button>
                      </div>
                      <div className="api-input-with-button">
                        <input
                          type={showKey ? 'text' : 'password'}
                          className="api-input"
                          value={draft.apiKey}
                          placeholder="请输入 API 密钥"
                          onChange={set('apiKey')}
                        />
                        <button className="api-input-side-btn" onClick={(e) => { e.preventDefault(); setShowKey(!showKey); }} title={showKey ? '隐藏' : '显示'}>
                          {showKey ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                        <button className="api-input-action-btn" onClick={handleTestConnection} disabled={testing} title="检测连接">
                          {testing ? '检测中...' : '检测'}
                        </button>
                      </div>
                      <div className="api-field-hint-row">
                        <a className="api-hint-link" onClick={(e) => { e.preventDefault(); if (draft.baseUrl) window.open(draft.baseUrl, '_blank') }}>点击这里获取密钥</a>
                        <span className="api-hint-gray">多个密钥使用逗号分隔，额度不足时自动切换</span>
                      </div>
                    </div>

                    {/* ── API 地址行 ── */}
                    <div className="api-field-block">
                      <div className="api-field-label-row">
                        <span className="api-field-label">API 地址</span>
                        <div className="api-field-icons">
                          <button className="icon-link-btn" title="重置为默认" onClick={(e) => { e.preventDefault(); setDraft((d) => ({ ...d, baseUrl: '' })); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                          </button>
                          <button className="icon-link-btn" title="帮助">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          </button>
                        </div>
                      </div>
                      <div className="api-input-with-button">
                        <input
                          className="api-input"
                          value={draft.baseUrl}
                          placeholder="https://api.example.com/v1"
                          onChange={set('baseUrl')}
                        />
                        <button className="api-input-reset-btn" onClick={(e) => { e.preventDefault(); setDraft((d) => ({ ...d, baseUrl: '' })); }} title="清空地址">
                          重置
                        </button>
                      </div>
                      <div className="api-field-preview">
                        预览：{draft.baseUrl ? `${draft.baseUrl}${(draft.chatPath || '/v1/chat/completions').replace(/^\/+/, '/')}` : '未设置'}
                      </div>
                    </div>

                    {/* ── 路径配置（chatPath / imagePath / videoPath） ── */}
                    <div className="api-field-block api-paths-block">
                      <div className="api-field-label-row">
                        <span className="api-field-label">接口路径</span>
                        <button
                          type="button"
                          className="api-paths-toggle"
                          onClick={(e) => { e.preventDefault(); setShowPaths((v) => !v); }}
                        >
                          {showPaths ? '收起' : '展开'}
                        </button>
                      </div>
                      {showPaths && (
                        <div className="api-paths-grid">
                          <label className="api-path-field">
                            <span className="api-path-label">对话 Chat</span>
                            <input
                              className="api-input mono"
                              value={draft.chatPath || ''}
                              placeholder="/v1/chat/completions"
                              onChange={set('chatPath')}
                            />
                          </label>
                          <label className="api-path-field">
                            <span className="api-path-label">生图 Image</span>
                            <input
                              className="api-input mono"
                              value={draft.imagePath || ''}
                              placeholder="/v1/images/generations"
                              onChange={set('imagePath')}
                            />
                          </label>
                          <label className="api-path-field">
                            <span className="api-path-label">视频 Video</span>
                            <input
                              className="api-input mono"
                              value={draft.videoPath || ''}
                              placeholder="/v1/videos"
                              onChange={set('videoPath')}
                            />
                          </label>
                        </div>
                      )}
                      {!showPaths && (
                        <div className="api-field-preview api-paths-summary">
                          对话 {draft.chatPath || '/v1/chat/completions'} · 生图 {draft.imagePath || '/v1/images/generations'} · 视频 {draft.videoPath || '/v1/videos'}
                        </div>
                      )}
                    </div>

                    {/* ── 模型管理 ── */}
                    <div className="api-models-block">
                      <div className="api-models-header">
                        <div className="api-models-header-left">
                          <span className="api-field-label">模型</span>
                          <span className="api-models-count">{draft.models?.length || 0}</span>
                          <button className="icon-link-btn" title="批量管理">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                          </button>
                          <input
                            type="text"
                            className="api-models-search"
                            placeholder="搜索"
                            value={modelSearchQuery}
                            onChange={(e) => setModelSearchQuery(e.target.value)}
                          />
                        </div>
                        <div className="api-models-header-right">
                          <button className="api-fetch-btn" onClick={(e) => { e.preventDefault(); fetchPresetModels(); }} disabled={fetching}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            {fetching ? '获取中...' : '获取模型列表'}
                          </button>
                          <button className="api-add-btn" onClick={(e) => { e.preventDefault(); setShowAddForm(v => !v); }} title="手动添加模型">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </button>
                        </div>
                      </div>

                      {/* 自定义添加模型表单 */}
                      {showAddForm && (
                        <div className="add-model-inline-form">
                          <div className="add-model-field">
                            <label>模型名称</label>
                            <input
                              type="text"
                              value={newModelName}
                              onChange={(e) => setNewModelName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddModel(); } }}
                              placeholder="例如：gpt-4o, claude-3-opus, agnes-image-2.1..."
                              autoFocus
                            />
                          </div>
                          <div className="add-model-field">
                            <label>类型</label>
                            <div className="add-model-type-selector">
                              <button type="button" className={newModelType === 'image' ? 'active' : ''} onClick={() => setNewModelType('image')}>🖼 图片</button>
                              <button type="button" className={newModelType === 'video' ? 'active' : ''} onClick={() => setNewModelType('video')}>🎬 视频</button>
                              <button type="button" className={newModelType === 'chat' ? 'active' : ''} onClick={() => setNewModelType('chat')}>💬 文本</button>
                            </div>
                          </div>
                          <div className="add-model-actions">
                            <button className="add-model-cancel" onClick={(e) => { e.preventDefault(); cancelAddModel(); }}>取消</button>
                            <button className="add-model-confirm" onClick={(e) => { e.preventDefault(); handleAddModel(); }}>确认添加</button>
                          </div>
                        </div>
                      )}

                      {/* 类型筛选 */}
                      <div className="api-models-type-filter">
                        <button className={`api-type-chip ${modelTypeFilter === 'all' ? 'active' : ''}`} onClick={() => setModelTypeFilter('all')}>全部 {draft.models?.length || 0}</button>
                        <button className={`api-type-chip ${modelTypeFilter === 'null' ? 'active' : ''}`} onClick={() => setModelTypeFilter('null')}>未设置 {(draft.models || []).filter(m => !m.type).length}</button>
                        <button className={`api-type-chip ${modelTypeFilter === 'image' ? 'active' : ''}`} onClick={() => setModelTypeFilter('image')}>image {(draft.models || []).filter(m => m.type === 'image').length}</button>
                        <button className={`api-type-chip ${modelTypeFilter === 'chat' ? 'active' : ''}`} onClick={() => setModelTypeFilter('chat')}>text {(draft.models || []).filter(m => m.type === 'chat').length}</button>
                        <button className={`api-type-chip ${modelTypeFilter === 'video' ? 'active' : ''}`} onClick={() => setModelTypeFilter('video')}>video {(draft.models || []).filter(m => m.type === 'video').length}</button>
                        <button className="api-type-chip hide-all" onClick={(e) => { e.preventDefault(); hideAllModels(); }}>全部隐藏</button>
                      </div>

                      {/* 模型列表 */}
                      <div className="api-models-list">
                        {filteredModels.length === 0 ? (
                          <div className="no-models-hint">无可用模型，点击"获取模型列表"加载</div>
                        ) : (
                          filteredModels.map((m) => {
                            // 按类型分组
                            const groupKey = m.type || 'unset'
                            return (
                              <div key={m.id} className="api-model-row">
                                <div className="api-model-icon">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                                </div>
                                <span className="api-model-name">{m.id}</span>
                                <div className="api-model-actions">
                                  <button
                                    className={`api-model-pill type-pill ${m.type || 'unset'}`}
                                    onClick={(e) => { e.preventDefault(); setModelType(m.id, m.type === 'image' ? 'chat' : m.type === 'chat' ? 'video' : 'image'); }}
                                    title="点击切换类型"
                                  >
                                    {m.type === 'image' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/></svg>}
                                    {m.type === 'chat' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                                    {m.type === 'video' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>}
                                    {!m.type && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                                    <span>{m.type || '请选择'}</span>
                                  </button>
                                  <button
                                    className={`api-model-pill ${m.visible ? 'active-vis' : ''}`}
                                    onClick={(e) => { e.preventDefault(); toggleModelVisible(m.id); }}
                                    title={m.visible ? '已显示' : '已隐藏'}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/></svg>
                                  </button>
                                  <button
                                    className={`api-model-pill ${m.isDefault ? 'active-def' : ''}`}
                                    onClick={(e) => { e.preventDefault(); toggleModelDefault(m.id); }}
                                    title={m.isDefault ? '默认模型' : '设为默认'}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                  </button>
                                  <button
                                    className={`api-model-pill ${m.isFavorite ? 'active-fav' : ''}`}
                                    onClick={(e) => { e.preventDefault(); toggleModelFavorite(m.id); }}
                                    title={m.isFavorite ? '已收藏' : '收藏'}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                                  </button>
                                  <button
                                    className="api-model-pill danger"
                                    onClick={(e) => { e.preventDefault(); deleteModel(m.id); }}
                                    title="删除"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    <div className="form-actions" style={{ marginTop: '16px' }}>
                      <button className="btn-danger" onClick={remove}>删除预设</button>
                      <div className="spacer" />
                      <span className="auto-save-hint">✓ 已自动保存</span>
                    </div>
                  </>
                )}
              </div>
              )}
            </>
          )}

          {/* ────────────── 提示词管理界面 ────────────── */}
          {tab === 'prompts' && (
            <div className="settings-pane prompts-pane">
              <div className="settings-section">
                <div className="settings-section-header">
                  <div className="settings-section-icon green">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div>
                    <div className="settings-section-title">自定义系统提示词</div>
                    <div className="settings-section-desc">这里是你定义 AI 身份与行为的唯一入口。每条独立管理，按顺序拼接到 system message。可无上限添加，字数无限制</div>
                  </div>
                  <div className="model-header-actions" style={{ marginLeft: 'auto' }}>
                    <button
                      className="model-top-btn add-btn"
                      onClick={() => addCustomPrompt()}
                    >
                      + 新增提示词
                    </button>
                  </div>
                </div>

                {customPrompts.length === 0 ? (
                  <div className="empty-hint">暂无自定义提示词，点击右上角「新增提示词」开始添加</div>
                ) : (
                  <div className="custom-prompts-list">
                    <div className="custom-prompts-summary">
                      当前共 {customPrompts.length} 条提示词，
                      已启用 {customPrompts.filter(p => p.enabled).length} 条，
                      总字符数 {customPrompts.reduce((sum, p) => sum + (p.text || '').length, 0)}。
                      这些提示词将自动注入到所有 chat 模型的 system 消息。
                    </div>

                    {/* 可用变量面板（点击插入到光标位置） */}
                    <div className="prompt-variables-panel">
                      <div className="prompt-variables-title">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                        可用变量 — 点击下方变量将其插入到当前提示词的光标位置
                      </div>
                      <div className="prompt-variables-grid">
                        {AVAILABLE_VARIABLES.map(v => (
                          <button
                            key={v.key}
                            type="button"
                            className="prompt-var-chip"
                            onClick={() => insertVariable(v.key)}
                            title={`示例：${v.example}`}
                          >
                            <code>{`{{${v.key}}}`}</code>
                            <span className="prompt-var-desc">{v.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {customPrompts.map((p, i) => (
                      <div key={p.id} className={`custom-prompt-item ${p.enabled ? 'is-enabled' : 'is-disabled'}`}>
                        <div className="custom-prompt-toolbar">
                          <label className="custom-prompt-toggle" title={p.enabled ? '已启用' : '已禁用'}>
                            <input
                              type="checkbox"
                              checked={!!p.enabled}
                              onChange={(e) => updateCustomPrompt(p.id, { enabled: e.target.checked })}
                            />
                            <span>{p.enabled ? '启用' : '禁用'}</span>
                          </label>
                          <input
                            type="text"
                            className="custom-prompt-name"
                            placeholder={`提示词 ${i + 1} 名称（可选）`}
                            value={p.name || ''}
                            onChange={(e) => updateCustomPrompt(p.id, { name: e.target.value })}
                          />
                          <div className="custom-prompt-actions">
                            <button
                              className="model-act-btn"
                              onClick={() => moveCustomPrompt(p.id, 'up')}
                              disabled={i === 0}
                              title="上移"
                            >↑</button>
                            <button
                              className="model-act-btn"
                              onClick={() => moveCustomPrompt(p.id, 'down')}
                              disabled={i === customPrompts.length - 1}
                              title="下移"
                            >↓</button>
                            <button
                              className="model-act-btn danger"
                              onClick={() => {
                                if (confirm(`确认删除第 ${i + 1} 条提示词？`)) removeCustomPrompt(p.id)
                              }}
                              title="删除"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6"/></svg>
                            </button>
                          </div>
                        </div>
                        <textarea
                          className="custom-prompt-textarea"
                          placeholder="在此输入提示词内容，无字数限制…"
                          value={p.text || ''}
                          onChange={(e) => updateCustomPrompt(p.id, { text: e.target.value })}
                          onFocus={() => setFocusedPromptId(p.id)}
                          ref={(el) => { promptTextareaRefs.current[p.id] = el }}
                          rows={5}
                        />
                        <div className="custom-prompt-meta">
                          <span>{(p.text || '').length} 字符</span>
                          <span>顺序：{i + 1} / {customPrompts.length}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ModelPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
        existingModels={draft?.models || []}
        newModelIds={pickerNewIds}
      />
    </div>
  )
}

function pick(o) {
  const { name, baseUrl, apiKey, imageModel, videoModel, chatPath, imagePath, videoPath, models } = o
  return { name, baseUrl, apiKey, imageModel, videoModel, chatPath, imagePath, videoPath, models: models || [] }
}
