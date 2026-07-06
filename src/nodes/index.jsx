import React, { useRef, useState, useEffect } from 'react'

import { Handle, Position } from '@xyflow/react'
import { useStore, pickPresetFields } from '../store.js'

// ── 通用外壳 ──────────────────────────────────
const STATUS_LABEL = { running: '运行中', done: '完成', error: '出错' }

function Shell({ id, accent, icon, title, subtitle, status, error, children }) {
  return (
    <div className={`node-card accent-${accent} ${status === 'running' ? 'is-running' : ''}`}>
      <div className="node-header">
        <span className="node-icon">{icon}</span>
        <div className="node-titles">
          <span className="node-title">{title}</span>
          {subtitle && <span className="node-subtitle">{subtitle}</span>}
        </div>
        {status && (
          <span className={`status-dot status-${status}`} title={STATUS_LABEL[status] || ''} />
        )}
      </div>
      <div className="node-body">{children}</div>
      {error && <div className="node-error">⚠ {error}</div>}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

const useUpdate = (id) => {
  const updateData = useStore((s) => s.updateData)
  return (patch) => updateData(id, patch)
}

function InHandle({ id, label, top }) {
  return (
    <div className="port port-in" style={top ? { top } : undefined}>
      <Handle type="target" position={Position.Left} id={id} />
      <span className="port-label">{label}</span>
    </div>
  )
}
function OutHandle({ id, label, top }) {
  return (
    <div className="port port-out" style={top ? { top } : undefined}>
      <span className="port-label">{label}</span>
      <Handle type="source" position={Position.Right} id={id} />
    </div>
  )
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.readAsDataURL(file)
  })
}

// ── API 配置节点 ──────────────────────────────
export function ApiConfigNode({ id, data }) {
  const up = useUpdate(id)
  const presets = useStore((s) => s.presets)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)

  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef()

  useEffect(() => {
    if (!dropOpen) return
    const onClickOutside = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [dropOpen])

  const onPresetChange = (pid) => {
    if (!pid) { up({ presetId: '' }); return }
    const p = presets.find((x) => x.id === pid)
    if (p) up({ presetId: pid, ...pickPresetFields(p) })
  }
  // 手动改字段 → 自动脱离预设变为自定义
  const manual = (patch) => up({ ...patch, presetId: '' })

  return (
    <Shell id={id} accent="blue" icon="⚙️" title="API 配置" subtitle="自定义或切换预设" status={data.status} error={data.error}>
      <Field label="预设">
        <div className="preset-row">
          <div className="custom-dropdown-container nodrag" ref={dropRef}>
            <button className="custom-dropdown-btn" onClick={(e) => { e.preventDefault(); setDropOpen(!dropOpen); }}>
              <span>{presets.find(p => p.id === data.presetId)?.name || '✏️ 自定义'}</span>
              <span className="arrow">▼</span>
            </button>
            {dropOpen && (
              <div className="custom-dropdown-menu">
                <button 
                  className={`custom-dropdown-item ${!data.presetId ? 'active' : ''}`}
                  onClick={() => { onPresetChange(''); setDropOpen(false); }}
                >
                  ✏️ 自定义
                </button>
                {presets.map((p) => (
                  <button 
                    key={p.id}
                    className={`custom-dropdown-item ${data.presetId === p.id ? 'active' : ''}`}
                    onClick={() => { onPresetChange(p.id); setDropOpen(false); }}
                  >
                    {p.name || '未命名预设'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="mini-btn nodrag" title="管理预设" onClick={() => setSettingsOpen(true)}>⚙</button>
        </div>
      </Field>

      <Field label="Base URL">
        <input className="nodrag" value={data.baseUrl || ''} placeholder="https://api.example.com" onChange={(e) => manual({ baseUrl: e.target.value })} />
      </Field>
      <Field label="API Key">
        <input className="nodrag" type="password" value={data.apiKey || ''} placeholder="sk-..." onChange={(e) => manual({ apiKey: e.target.value })} />
      </Field>
      <div className="field-row">
        <Field label="图片模型">
          <input className="nodrag" value={data.imageModel || ''} onChange={(e) => manual({ imageModel: e.target.value })} />
        </Field>
        <Field label="视频模型">
          <input className="nodrag" value={data.videoModel || ''} onChange={(e) => manual({ videoModel: e.target.value })} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="图片接口路径">
          <input className="nodrag mono" value={data.imagePath || ''} onChange={(e) => manual({ imagePath: e.target.value })} />
        </Field>
        <Field label="视频接口路径">
          <input className="nodrag mono" value={data.videoPath || ''} onChange={(e) => manual({ videoPath: e.target.value })} />
        </Field>
      </div>
      <OutHandle id="config" label="配置" />
    </Shell>
  )
}

// ── 参考图节点 ────────────────────────────────
export function RefImageNode({ id, data }) {
  const up = useUpdate(id)
  const inputRef = useRef()
  const onFile = async (file) => {
    if (!file) return
    up({ image: await fileToDataUrl(file), name: file.name })
  }
  return (
    <Shell id={id} accent="green" icon="🖼️" title="参考图" subtitle="上传本地图片" status={data.status} error={data.error}>
      <div
        className="dropzone nodrag"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}
      >
        {data.image ? (
          <img src={data.image} alt="参考图" />
        ) : (
          <span>点击或拖入图片</span>
        )}
      </div>
      {data.name && <div className="file-name">{data.name}</div>}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <OutHandle id="image" label="图片" />
    </Shell>
  )
}

// ── 参考图聚合节点（最多 4 路输入）────────────
export function RefAggregateNode({ id, data }) {
  return (
    <Shell id={id} accent="green" icon="🧩" title="参考图聚合" subtitle="汇聚最多 4 张参考图" status={data.status} error={data.error}>
      <div className="agg-slots">
        {[1, 2, 3, 4].map((i) => (
          <div className="agg-slot" key={i}>
            <InHandle id={`img${i}`} label={`参考图 ${i}`} />
          </div>
        ))}
      </div>
      {data.count != null && <div className="hint">已聚合 {data.count} 张</div>}
      <OutHandle id="images" label="图集" />
    </Shell>
  )
}

// ── 图片生成节点 ──────────────────────────────
export function ImageGenNode({ id, data }) {
  const up = useUpdate(id)
  return (
    <Shell id={id} accent="red" icon="✨" title="图片生成" subtitle="文生图 / 多参考图生图" status={data.status} error={data.error}>
      <InHandle id="config" label="API 配置（可选）" top={52} />
      <InHandle id="refs" label="参考图集" top={80} />
      <Field label="提示词 Prompt">
        <textarea className="nodrag" rows={4} value={data.prompt || ''} placeholder="描述你想生成的画面…" onChange={(e) => up({ prompt: e.target.value })} />
      </Field>
      <Field label="尺寸">
        <select className="nodrag" value={data.size || '1024x1024'} onChange={(e) => up({ size: e.target.value })}>
          <option>1024x1024</option>
          <option>1024x1536</option>
          <option>1536x1024</option>
          <option>512x512</option>
        </select>
      </Field>
      {data.result && <img className="thumb" src={data.result} alt="结果" />}
      <OutHandle id="image" label="图片" />
    </Shell>
  )
}

// ── 视频节点 ──────────────────────────────────
export function VideoGenNode({ id, data }) {
  const up = useUpdate(id)
  return (
    <Shell id={id} accent="yellow" icon="🎬" title="视频处理" subtitle="文生视频 / 图生视频" status={data.status} error={data.error}>
      <InHandle id="config" label="API 配置（可选）" top={52} />
      <InHandle id="image" label="首帧参考图（可选）" top={80} />
      <Field label="提示词 Prompt">
        <textarea className="nodrag" rows={3} value={data.prompt || ''} placeholder="描述镜头与画面动态…" onChange={(e) => up({ prompt: e.target.value })} />
      </Field>
      <Field label="时长（秒，可选）">
        <input className="nodrag" type="number" min="1" max="60" value={data.duration || ''} onChange={(e) => up({ duration: e.target.value })} />
      </Field>
      {data.progressText && <div className="hint">{data.progressText}</div>}
      {data.result && <video className="thumb" src={data.result} controls muted />}
      <OutHandle id="video" label="视频" />
    </Shell>
  )
}

// ── 预览节点（仅查看，不保存）──────────────────
export function PreviewNode({ id, data }) {
  const media = data.media
  const isVideo = media && (media.includes('video') || /\.(mp4|webm|mov)(\?|$)/i.test(media))
  return (
    <Shell id={id} accent="purple" icon="👁️" title="预览" subtitle="仅查看 · 不执行保存" status={data.status} error={data.error}>
      <InHandle id="media" label="媒体" top={52} />
      <div className="preview-box">
        {media && (isVideo ? <video src={media} controls autoPlay loop muted /> : <img src={media} alt="预览" />)}
      </div>
    </Shell>
  )
}

// ── 保存节点 ──────────────────────────────────
export function SaveFileNode({ id, data }) {
  const up = useUpdate(id)
  return (
    <Shell id={id} accent="teal" icon="💾" title="保存文件" subtitle="将结果存储到本地" status={data.status} error={data.error}>
      <InHandle id="media" label="媒体" top={52} />
      <Field label="文件名">
        <input className="nodrag" value={data.filename || ''} placeholder="my-artwork" onChange={(e) => up({ filename: e.target.value })} />
      </Field>
      {data.savedAt && <div className="hint">✅ 已保存 · {data.savedAt}</div>}
    </Shell>
  )
}

export const nodeTypes = {
  apiConfig: ApiConfigNode,
  refImage: RefImageNode,
  refAggregate: RefAggregateNode,
  imageGen: ImageGenNode,
  videoGen: VideoGenNode,
  preview: PreviewNode,
  saveFile: SaveFileNode,
}
