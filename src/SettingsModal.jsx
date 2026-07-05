import React, { useState, useEffect } from 'react'
import { useStore } from './store.js'

const EMPTY = {
  name: '',
  baseUrl: '',
  apiKey: '',
  imageModel: '',
  videoModel: '',
  imagePath: '/v1/images/generations',
  videoPath: '/v1/videos/generations',
}

export default function SettingsModal() {
  const { settingsOpen, setSettingsOpen, presets, addPreset, updatePreset, removePreset } = useStore()
  const [activeId, setActiveId] = useState(presets[0]?.id || null)
  const [draft, setDraft] = useState(null)

  const active = presets.find((p) => p.id === activeId) || null

  useEffect(() => {
    if (settingsOpen) {
      const first = presets.find((p) => p.id === activeId) || presets[0]
      setActiveId(first?.id || null)
      setDraft(first ? { ...first } : null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen])

  if (!settingsOpen) return null

  const select = (p) => {
    setActiveId(p.id)
    setDraft({ ...p })
  }

  const create = () => {
    const preset = { ...EMPTY, name: `预设 ${presets.length + 1}` }
    addPreset(preset)
    // addPreset 生成 id，选中最新一个
    setTimeout(() => {
      const list = useStore.getState().presets
      const last = list[list.length - 1]
      setActiveId(last.id)
      setDraft({ ...last })
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
      setDraft(first ? { ...first } : null)
    }, 0)
  }

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))
  const dirty = active && draft && JSON.stringify(pick(active)) !== JSON.stringify(pick(draft))

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
            {!draft && <div className="empty-hint">暂无预设，点击左侧「新建预设」开始</div>}
            {draft && (
              <>
                <label className="f">
                  <span>预设名称</span>
                  <input value={draft.name} placeholder="例如：中转站 A / 官方 API" onChange={set('name')} />
                </label>
                <label className="f">
                  <span>Base URL</span>
                  <input value={draft.baseUrl} placeholder="https://api.example.com" onChange={set('baseUrl')} />
                </label>
                <label className="f">
                  <span>API Key</span>
                  <input type="password" value={draft.apiKey} placeholder="sk-..." onChange={set('apiKey')} />
                </label>
                <div className="f-row">
                  <label className="f">
                    <span>图片模型</span>
                    <input value={draft.imageModel} placeholder="gpt-image-1" onChange={set('imageModel')} />
                  </label>
                  <label className="f">
                    <span>视频模型</span>
                    <input value={draft.videoModel} placeholder="sora-2" onChange={set('videoModel')} />
                  </label>
                </div>
                <div className="f-row">
                  <label className="f">
                    <span>图片接口路径</span>
                    <input className="mono" value={draft.imagePath} onChange={set('imagePath')} />
                  </label>
                  <label className="f">
                    <span>视频接口路径</span>
                    <input className="mono" value={draft.videoPath} onChange={set('videoPath')} />
                  </label>
                </div>

                <div className="form-actions">
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
  const { name, baseUrl, apiKey, imageModel, videoModel, imagePath, videoPath } = o
  return { name, baseUrl, apiKey, imageModel, videoModel, imagePath, videoPath }
}
