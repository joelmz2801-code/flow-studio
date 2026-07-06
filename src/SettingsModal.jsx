import React, { useState, useEffect } from 'react'
import { useStore } from './store.js'
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


  // Group models by prefix
  const getGroup = (modelId) => {
    if (modelId.includes('/')) return modelId.split('/')[0]
    if (modelId.includes('-')) return modelId.split('-')[0]
    return '其他'
  }

  const filteredModels = (draft?.models || []).filter(m => 
    !modelSearchQuery || m.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
  )

  const groupedModels = {}
  filteredModels.forEach((m) => {
    const group = getGroup(m.id)
    if (!groupedModels[group]) groupedModels[group] = []
    groupedModels[group].push(m)
  })

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
            {notify && (
              <div className={`preset-notify ${notify.type}`}>
                <span>{notify.message}</span>
                <button className="notify-close" onClick={(e) => { e.preventDefault(); setNotify(null); }}>✕</button>
              </div>
            )}
            {!draft && <div className="empty-hint">暂无预设，点击左侧「新建预设」开始</div>}

            {draft && (
              <>
                <label className="f">
                  <span>预设名称</span>
                  <input value={draft.name} placeholder="例如：中转站 A / 官方 API" onChange={set('name')} />
                </label>
                
                <div className="f">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>API 密钥</span>
                    <button className="test-btn" onClick={handleTestConnection} disabled={testing}>
                      {testing ? '检测中...' : '检测'}
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
                      {showKey ? '🔒' : '👁️'}
                    </button>
                  </div>
                  <span className="sub-hint">多个密钥使用逗号分隔</span>
                </div>

                <label className="f">
                  <span>API 地址</span>
                  <input value={draft.baseUrl} placeholder="https://api.example.com" onChange={set('baseUrl')} />
                  <span className="sub-hint">预览: {draft.baseUrl ? `${draft.baseUrl}/v1/chat/completions` : '未设置'}</span>
                </label>

                {/* Model Configuration Area */}
                <div className="f" style={{ marginTop: '8px' }}>
                  <div className="model-header-row">
                    <div className="model-header-title">
                      <span>模型</span>
                      <span className="model-count-badge">{(draft.models || []).filter(m => m.visible).length}</span>
                    </div>
                    <div className="model-header-actions">
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
                    {Object.keys(groupedModels).length === 0 ? (
                      <div className="no-models-hint">无可用模型，点击“获取模型列表”加载</div>
                    ) : (
                      Object.entries(groupedModels).map(([groupName, groupItems]) => (
                        <div key={groupName} className="settings-model-group">
                          <div className="settings-group-title">{groupName}</div>
                          <div className="settings-group-items">
                            {groupItems.map((m) => (
                              <div key={m.id} className="settings-model-item">
                                <span className="settings-model-name" title={m.id}>{m.id}</span>
                                <div className="settings-model-item-actions">
                                  <button 
                                    className={`action-icon-btn visible-toggle ${m.visible ? 'active' : ''}`}
                                    onClick={(e) => { e.preventDefault(); toggleModelVisible(m.id); }}
                                    title={m.visible ? '已选择 (在对话框中显示)' : '未选择 (在对话框中隐藏)'}
                                  >
                                    👁️
                                  </button>
                                  <button 
                                    className={`action-icon-btn default-toggle ${m.isDefault ? 'active' : ''}`}
                                    onClick={(e) => { e.preventDefault(); toggleModelDefault(m.id); }}
                                    title={m.isDefault ? '已设为默认' : '设为默认'}
                                  >
                                    ☀️
                                  </button>
                                  <button 
                                    className="action-icon-btn type-toggle"
                                    onClick={(e) => { e.preventDefault(); toggleModelType(m.id); }}
                                    title={`类型: ${m.type || 'image'} (点击切换)`}
                                  >
                                    🔧 <span className="type-badge">{m.type || 'image'}</span>
                                  </button>
                                  <button 
                                    className="action-icon-btn delete-btn"
                                    onClick={(e) => { e.preventDefault(); deleteModel(m.id); }}
                                    title="删除模型"
                                  >
                                    🗑️
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
