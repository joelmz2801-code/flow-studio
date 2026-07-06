import React, { useState, useEffect } from 'react'
import { useStore, forceFlushPendingSaves } from './store.js'
import { useAuth } from './useAuth.js'
import { testApiConnection, fetchModelsList } from './engine/runner.js'

const EMPTY = {
  name: '',
  baseUrl: '',
  apiKey: '',
  imageModel: 'agnes-image-2.1-flash',
  videoModel: 'agnes-video-2.0',
  imagePath: '/v1/images/generations',
  videoPath: '/v1/videos/generations',
  models: [
    { id: 'agnes-image-2.1-flash', visible: true, isDefault: true, type: 'image' },
    { id: 'agnes-image-2.0-flash', visible: true, isDefault: false, type: 'image' },
    { id: 'agnes-video-2.0', visible: true, isDefault: true, type: 'video' },
    { id: 'gpt-image-1', visible: true, isDefault: false, type: 'image' },
    { id: 'sora-2', visible: true, isDefault: false, type: 'video' }
  ],
}


export default function SettingsModal() {
  const { settingsOpen, setSettingsOpen, presets, addPreset, updatePreset, removePreset } = useStore()
  const { user, signOut, isAuthEnabled } = useAuth()
  const [activeId, setActiveId] = useState(presets[0]?.id || null)
  const [draft, setDraft] = useState(null)
  
  // Custom states
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [notify, setNotify] = useState(null) // { type: 'success'|'error'|'info', message: '...' }

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
      const updatedModels = (d.models || []).map((m) => {
        if (m.id === modelId) {
          return { ...m, isDefault: !m.isDefault }
        }
        // Clear isDefault for models of the same type
        const targetModel = d.models.find(x => x.id === modelId)
        if (targetModel && m.type === targetModel.type) {
          return { ...m, isDefault: false }
        }
        return m
      })

      const targetModel = d.models.find(x => x.id === modelId)
      const patch = { models: updatedModels }
      if (targetModel) {
        const willBeDefault = !targetModel.isDefault
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
    setDraft((d) => ({
      ...d,
      models: (d.models || []).map((m) =>
        m.id === modelId ? { ...m, type: m.type === 'video' ? 'image' : 'video' } : m
      )
    }))
  }

  const deleteModel = (modelId) => {
    setDraft((d) => ({
      ...d,
      models: (d.models || []).filter((m) => m.id !== modelId)
    }))
  }

  const handleAddModelPrompt = () => {
    const name = window.prompt('请输入自定义模型名称：')
    if (!name || !name.trim()) return
    const id = name.trim()
    setDraft((d) => {
      const exists = (d.models || []).some(m => m.id === id)
      if (exists) return d
      const newModel = {
        id,
        visible: true,
        isDefault: false,
        type: id.includes('video') || id.includes('sora') ? 'video' : 'image'
      }
      return { ...d, models: [...(d.models || []), newModel] }
    })
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
              visible: true,
              isDefault: false,
              type: modelId.includes('video') || modelId.includes('sora') ? 'video' : 'image'
            })
          }
        })
        return { ...d, models: newModels }
      })
      showNotification('success', `获取成功！已加载 ${list.length} 个模型。`)
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


  const filteredModels = (draft?.models || []).filter(m => 
    !modelSearchQuery || m.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
  )

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

  return (
    <div className="modal-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false) }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>设置 · API 预设</h2>
            <p>预设保存在浏览器本地，可在 API 配置节点中一键切换</p>
          </div>
          <button className="icon-btn" onClick={() => setSettingsOpen(false)} title="关闭">✕</button>
        </div>

        <div className="modal-body">
          <div className="preset-list">
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
          </div>

          <div className="preset-form">
            {/* ── Section: 账户管理 ── */}
            {isAuthEnabled && user && (
              <div className="settings-section account-section">
                <div className="settings-section-header">
                  <div className="settings-section-icon green">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div>
                    <div className="settings-section-title">账户</div>
                    <div className="settings-section-desc">当前登录的账户信息</div>
                  </div>
                </div>

                <div className="account-info-row">
                  <div className="account-avatar">
                    {(user.email || user.user_metadata?.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="account-meta">
                    <div className="account-email">{user.email || '未知邮箱'}</div>
                    <div className="account-sub">
                      {user.app_metadata?.provider
                        ? `登录方式: ${user.app_metadata.provider}`
                        : '已登录'}
                      {user.created_at && ` · 注册于 ${new Date(user.created_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    className="btn-danger account-signout-btn"
                    onClick={() => { forceFlushPendingSaves(); signOut(); setSettingsOpen(false); }}
                  >
                    退出账户
                  </button>
                </div>
              </div>
            )}

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
                      <div className="settings-section-desc">勾选要在对话框中显示的模型，设置默认模型</div>
                    </div>
                    <div className="model-header-actions" style={{ marginLeft: 'auto' }}>
                      <button className="model-top-btn" onClick={(e) => { e.preventDefault(); fetchPresetModels(); }} disabled={fetching}>
                        {fetching ? '获取中...' : '获取模型列表'}
                      </button>
                      <button className="model-top-btn add-btn" onClick={(e) => { e.preventDefault(); handleAddModelPrompt(); }} title="手动添加模型">+</button>
                    </div>
                  </div>

                  <input 
                    type="text" 
                    className="model-inner-search"
                    placeholder="搜索模型..." 
                    value={modelSearchQuery}
                    onChange={(e) => setModelSearchQuery(e.target.value)}
                  />

                  <div className="settings-model-list">
                    {groupedByType.length === 0 ? (
                      <div className="no-models-hint">无可用模型，点击"获取模型列表"加载</div>
                    ) : (
                      groupedByType.map((group) => (
                        <div key={group.type} className="model-type-group">
                          <div className="model-type-group-header">
                            <span>{group.label}</span>
                            <span className="model-type-group-count">
                              {group.items.filter(m => m.visible).length}/{group.items.length}
                            </span>
                          </div>
                          <div className="model-type-group-body">
                            {group.items.map((m) => (
                              <div key={m.id} className="settings-model-row">
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
                                  <button 
                                    className="model-act-btn"
                                    onClick={(e) => { e.preventDefault(); toggleModelType(m.id); }}
                                    title={`类型: ${m.type || 'image'} (点击切换)`}
                                  >
                                    <span className={`model-type-badge ${m.type || 'image'}`}>{m.type || 'image'}</span>
                                  </button>
                                  <button 
                                    className="model-act-btn danger"
                                    onClick={(e) => { e.preventDefault(); deleteModel(m.id); }}
                                    title="删除模型"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6"/></svg>
                                  </button>
                                </div>
                              </div>
                            ))}
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
        </div>
      </div>
    </div>
  )
}

function pick(o) {
  const { name, baseUrl, apiKey, imageModel, videoModel, imagePath, videoPath, models } = o
  return { name, baseUrl, apiKey, imageModel, videoModel, imagePath, videoPath, models: models || [] }
}
