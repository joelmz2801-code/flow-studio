import React, { useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import { useStore, nextId } from './store.js'
import { nodeTypes } from './nodes/index.jsx'
import { isValidConnection } from './engine/types.js'
import { runGraph } from './engine/runner.js'

const PALETTE = [
  { type: 'apiConfig', icon: '⚙️', label: 'API 配置', desc: '自定义 Base URL / Key' },
  { type: 'refImage', icon: '🖼️', label: '参考图', desc: '上传本地图片' },
  { type: 'refAggregate', icon: '🧩', label: '参考图聚合', desc: '汇聚最多 4 张参考图' },
  { type: 'imageGen', icon: '✨', label: '图片生成', desc: '文生图 / 参考图生图' },
  { type: 'videoGen', icon: '🎬', label: '视频处理', desc: '文生视频 / 图生视频' },
  { type: 'preview', icon: '👁️', label: '预览', desc: '仅查看，不保存' },
  { type: 'saveFile', icon: '💾', label: '保存文件', desc: '下载结果到本地' },
]

const DEFAULT_DATA = {
  apiConfig: {
    baseUrl: 'https://api.openai.com',
    imagePath: '/v1/images/generations',
    videoPath: '/v1/videos/generations',
    imageModel: 'gpt-image-1',
    videoModel: 'sora-2',
  },
  imageGen: { size: '1024x1024' },
  saveFile: { filename: 'my-artwork' },
}

function Flow() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, updateData } = useStore()
  const { screenToFlowPosition } = useReactFlow()
  const [running, setRunning] = useState(false)
  const [toast, setToast] = useState(null)

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('application/flow-node')
      if (!type) return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addNode({ id: nextId(), type, position, data: { ...(DEFAULT_DATA[type] || {}) } })
    },
    [screenToFlowPosition, addNode],
  )

  const run = async () => {
    if (running) return
    setRunning(true)
    setToast(null)
    try {
      // 终端节点：预览 + 保存；若无则运行所有生成节点
      const state = useStore.getState()
      let targets = state.nodes.filter((n) => ['preview', 'saveFile'].includes(n.type)).map((n) => n.id)
      if (targets.length === 0) {
        targets = state.nodes.filter((n) => ['imageGen', 'videoGen'].includes(n.type)).map((n) => n.id)
      }
      if (targets.length === 0) {
        setToast({ kind: 'warn', text: '画布上没有可执行的节点' })
        return
      }
      const results = await runGraph(targets, {
        nodes: state.nodes,
        edges: state.edges,
        updateData: state.updateData,
      })
      const failed = results.filter((r) => r.status === 'rejected').length
      setToast(
        failed === 0
          ? { kind: 'ok', text: '✅ 工作流执行完成' }
          : { kind: 'warn', text: `完成，但有 ${failed} 条分支出错，详见节点提示` },
      )
    } finally {
      setRunning(false)
      setTimeout(() => setToast(null), 6000)
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <span className="dot dot-b" /><span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
          </div>
          <div>
            <h1>Flow Studio</h1>
            <p>节点式 AI 创作工作流</p>
          </div>
        </div>
        <div className="palette-title">节点库 · 拖入画布</div>
        <div className="palette">
          {PALETTE.map((p) => (
            <div
              key={p.type}
              className="palette-item"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/flow-node', p.type)}
            >
              <span className="palette-icon">{p.icon}</span>
              <div>
                <div className="palette-label">{p.label}</div>
                <div className="palette-desc">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="sidebar-foot">
          <div className="tip">💡 连线规则：API 配置 → 生成节点；参考图 → 聚合 → 图片生成；结果 → 预览 / 保存</div>
        </div>
      </aside>

      <main className="canvas">
        <div className="topbar">
          <button className={`run-btn ${running ? 'running' : ''}`} onClick={run} disabled={running}>
            {running ? '⏳ 运行中…' : '▶ 运行工作流'}
          </button>
          {toast && <div className={`toast toast-${toast.kind}`}>{toast.text}</div>}
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={(c) => isValidConnection(c, useStore.getState().nodes)}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
          fitView
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#2c3245" />
          <Controls position="bottom-left" />
          <MiniMap pannable zoomable className="minimap" nodeColor="#4285F4" maskColor="rgba(10,12,20,0.75)" />
        </ReactFlow>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  )
}
