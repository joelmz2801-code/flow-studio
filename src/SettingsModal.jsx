import React, { useState, useEffect } from 'react'
import { useStore, forceFlushPendingSaves } from './store.js'
import { useAuth } from './useAuth.js'
import { testApiConnection, fetchModelsList } from './engine/runner.js'
import { AVAILABLE_VARIABLES } from './engine/promptVariables.js'

const EMPTY = {
  name: '',
  baseUrl: '',
  apiKey: '',
  imageModel: '',
  videoModel: '',
  imagePath: '/v1/images/generations',
  videoPath: '/v1/videos/generations',
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

  if (!settingsOpen) return null

  const select = (p) => {
    setActiveId(p.id)
    setDraft({ ...p, models: p.models || [] })
    setShowKey(false)
    setModelSearchQuery('')
  }

  const create = () => {
    const preset = { ...EMPTY, name: `预设 ${presets.length + 1}` }
    addPreset(preset)
    setTimeout(() => {
      const list = useStore.getState().presets
      const last = list[list.length - 1]
      setActiveId(last.id)
      setDraft({ ...last, models: last.models || [] })
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

  const setModelType = (modelId, newType) => {
    setDraft((d) => ({
      ...d,
      models: (d.models || []).map((m) =>
        m.id === modelId ? { ...m, type: newType } : m
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
      setDraft((d) => {
        const currentModels = d.models || []
        const newModels = [...currentModels]
        list.forEach((modelId) => {
          if (!newModels.some((m) => m.id === modelId)) {
            newModels.push({
              id: modelId,
              visible: false,
              isDefault: false,
              type: null
            })
          }
        })
        return { ...d, models: newModels }
      })
      showNotification('success', `获取成功！已加载 ${list.length} 个模型。请点击「眼睛」或「星标」收藏需要的模型，收藏后才会在对话框中显示。`)
    } catch (err) {
      showNotification('error', `获取失败: ${err.message} (通常由于跨域CORS限制，您仍可在列表中手动添加/启用模型)`)
    } finally {
      setFetching(false)
    }
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
              <div className="preset-form">
                {notify && (
                  <div className={`preset-notify ${notify.type}`}>
                    <span>{notify.message}</span>
                    <button className="notify-close" onClick={(e) => { e.preventDefault(); setNotify(null); }}>✕</button>
                  </div>
                )}
                {!draft && <div className="empty-hint">暂无预设，点击左侧「新建预设」开始</div>}

                {draft && (
                  <>
                    {/* ── Section: 基础配置 ── */}
                    <div className="settings-section">
                      <div className="settings-section-header">
                        <div className="settings-section-icon blue">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 16v-4M12 8h.01"/></svg>
                        </div>
                        <div>
                          <div className="settings-section-title">基础配置</div>
                          <div className="settings-section-desc">预设名称、密钥与 API 地址</div>
                        </div>
                      </div>

                      <label className="f">
                        <span>预设名称</span>
                        <input value={draft.name} placeholder="例如：中转站 A / 官方 API" onChange={set('name')} />
                      </label>

                      <div className="f" style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>API 密钥</span>
                          <button className="test-btn" onClick={handleTestConnection} disabled={testing}>
                            {testing ? '检测中...' : '检测连接'}
                          </button>
                        </div>
                        <div className="key-input-container">
                          <input
                            type={showKey ? 'text' : 'password'}
                            value={draft.apiKey}
                            placeholder="sk-..."
                            onChange={set('apiKey')}
                          />
                          <button className="show-key-btn" onClick={(e) => { e.preventDefault(); setShowKey(!showKey); }}>
                            {showKey ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                            )}
                          </button>
                        </div>
                        <span className="sub-hint">多个密钥使用逗号分隔，额度不足时自动切换</span>
                      </div>

                      <label className="f" style={{ marginTop: '12px' }}>
                        <span>API 地址</span>
                        <input value={draft.baseUrl} placeholder="https://api.example.com" onChange={set('baseUrl')} />
                        <span className="sub-hint">预览: {draft.baseUrl ? `${draft.baseUrl}/v1/chat/completions` : '未设置'}</span>
                      </label>
                    </div>

                    {/* ── Section: 模型管理 ── */}
                    <div className="settings-section">
                      <div className="settings-section-header">
                        <div className="settings-section-icon purple">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                        </div>
                        <div>
                          <div className="settings-section-title">模型管理</div>
                          <div className="settings-section-desc">仅「收藏/星标」的模型会出现在对话框中，其余默认隐藏</div>
                        </div>
                        <div className="model-header-actions" style={{ marginLeft: 'auto' }}>
                          <button className="model-top-btn" onClick={(e) => { e.preventDefault(); fetchPresetModels(); }} disabled={fetching}>
                            {fetching ? '获取中...' : '获取模型列表'}
                          </button>
                          <button className="model-top-btn" onClick={(e) => { e.preventDefault(); hideAllModels(); }} title="将所有模型设为隐藏（保留已设默认）">
                            全部隐藏
                          </button>
                          <button
                            className={`model-top-btn add-btn ${showAddForm ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); setShowAddForm(v => !v); }}
                            title="手动添加模型"
                          >
                            {showAddForm ? '取消' : '+ 添加'}
                          </button>
                        </div>
                      </div>

                      {/* 自定义添加模型内联表单 */}
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
                              <button
                                type="button"
                                className={newModelType === 'image' ? 'active' : ''}
                                onClick={() => setNewModelType('image')}
                              >🖼 图片</button>
                              <button
                                type="button"
                                className={newModelType === 'video' ? 'active' : ''}
                                onClick={() => setNewModelType('video')}
                              >🎬 视频</button>
                              <button
                                type="button"
                                className={newModelType === 'chat' ? 'active' : ''}
                                onClick={() => setNewModelType('chat')}
                              >💬 文本</button>
                            </div>
                          </div>
                          <div className="add-model-actions">
                            <button className="add-model-cancel" onClick={(e) => { e.preventDefault(); cancelAddModel(); }}>取消</button>
                            <button className="add-model-confirm" onClick={(e) => { e.preventDefault(); handleAddModel(); }}>确认添加</button>
                          </div>
                        </div>
                      )}

                      <div className="model-filter-bar">
                        <input
                          type="text"
                          className="model-inner-search"
                          placeholder="搜索模型..."
                          value={modelSearchQuery}
                          onChange={(e) => setModelSearchQuery(e.target.value)}
                        />
                        <select
                          className="model-type-filter"
                          value={modelTypeFilter}
                          onChange={(e) => setModelTypeFilter(e.target.value)}
                        >
                          <option value="all">全部类型</option>
                          <option value="null">未设置</option>
                          <option value="image">image</option>
                          <option value="chat">text</option>
                          <option value="video">video</option>
                        </select>
                      </div>

                      <div className="settings-model-list">
                        {filteredModels.length === 0 ? (
                          <div className="no-models-hint">无可用模型，点击"获取模型列表"加载</div>
                        ) : (
                          filteredModels.map((m) => (
                            <div key={m.id} className={`settings-model-row ${m.visible ? 'is-visible' : 'is-hidden'}`}>
                              <div className="settings-model-info">
                                <span className="settings-model-name-text" title={m.id}>{m.id}</span>
                              </div>
                              <div className="settings-model-actions">
                                <button
                                  className={`model-act-btn ${m.visible ? 'active-vis' : ''}`}
                                  onClick={(e) => { e.preventDefault(); toggleModelVisible(m.id); }}
                                  title={m.visible ? '已显示 (在对话框中可见)' : '已隐藏 (在对话框中不可见)'}
                                >
                                  {m.visible ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                                  )}
                                </button>
                                <button
                                  className={`model-act-btn ${m.isDefault ? 'active-def' : ''}`}
                                  onClick={(e) => { e.preventDefault(); toggleModelDefault(m.id); }}
                                  title={m.isDefault ? '已设为默认' : '设为默认'}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                </button>
                                <select
                                  className={`model-type-select ${!m.type ? 'unselected' : ''}`}
                                  value={m.type || ''}
                                  onChange={(e) => { e.preventDefault(); setModelType(m.id, e.target.value); }}
                                  title="选择模型类型"
                                >
                                  <option value="" disabled>请选择</option>
                                  <option value="image">image</option>
                                  <option value="chat">text</option>
                                  <option value="video">video</option>
                                </select>
                                <button
                                  className="model-act-btn danger"
                                  onClick={(e) => { e.preventDefault(); deleteModel(m.id); }}
                                  title="删除模型"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6"/></svg>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="form-actions" style={{ marginTop: '16px' }}>
                      <button className="btn-danger" onClick={remove}>删除预设</button>
                      <div className="spacer" />
                      <button className="btn-primary" onClick={save} disabled={!dirty}>
                        {dirty ? '保存修改' : '已保存 ✓'}
                      </button>
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
    </div>
  )
}

function pick(o) {
  const { name, baseUrl, apiKey, imageModel, videoModel, imagePath, videoPath, models } = o
  return { name, baseUrl, apiKey, imageModel, videoModel, imagePath, videoPath, models: models || [] }
}
