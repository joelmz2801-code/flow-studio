import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react'

let counter = 100
export const nextId = () => `n${counter++}`

// ── API 预设：持久化到 localStorage ─────────────
const PRESET_KEY = 'flowstudio.apiPresets.v1'

export const PRESET_FIELDS = ['baseUrl', 'apiKey', 'imageModel', 'videoModel', 'imagePath', 'videoPath']

const DEFAULT_PRESETS = [
  {
    id: 'p-openai',
    name: 'OpenAI 官方',
    baseUrl: 'https://api.openai.com',
    apiKey: '',
    imageModel: 'gpt-image-1',
    videoModel: 'sora-2',
    imagePath: '/v1/images/generations',
    videoPath: '/v1/videos/generations',
  },
]

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESET_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch { /* ignore */ }
  return DEFAULT_PRESETS
}

function persistPresets(presets) {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(presets)) } catch { /* ignore */ }
}

const initialPresets = loadPresets()
const firstPreset = initialPresets[0]

const initialNodes = [
  {
    id: 'api1',
    type: 'apiConfig',
    position: { x: 40, y: 120 },
    data: {
      presetId: firstPreset?.id || '',
      baseUrl: firstPreset?.baseUrl || 'https://api.openai.com',
      apiKey: firstPreset?.apiKey || '',
      imagePath: firstPreset?.imagePath || '/v1/images/generations',
      videoPath: firstPreset?.videoPath || '/v1/videos/generations',
      imageModel: firstPreset?.imageModel || 'gpt-image-1',
      videoModel: firstPreset?.videoModel || 'sora-2',
    },
  },
  { id: 'ref1', type: 'refImage', position: { x: 40, y: 480 }, data: {} },
  { id: 'ref2', type: 'refImage', position: { x: 40, y: 700 }, data: {} },
  { id: 'agg1', type: 'refAggregate', position: { x: 340, y: 520 }, data: {} },
  {
    id: 'gen1',
    type: 'imageGen',
    position: { x: 640, y: 200 },
    data: { prompt: '一只戴着宇航员头盔的柴犬，赛博朋克城市夜景，电影感光效', size: '1024x1024' },
  },
  { id: 'prev1', type: 'preview', position: { x: 1030, y: 140 }, data: {} },
  { id: 'save1', type: 'saveFile', position: { x: 1030, y: 520 }, data: { filename: 'my-artwork' } },
]

const initialEdges = [
  { id: 'e1', source: 'api1', sourceHandle: 'config', target: 'gen1', targetHandle: 'config', animated: true },
  { id: 'e2', source: 'ref1', sourceHandle: 'image', target: 'agg1', targetHandle: 'img1', animated: true },
  { id: 'e3', source: 'ref2', sourceHandle: 'image', target: 'agg1', targetHandle: 'img2', animated: true },
  { id: 'e4', source: 'agg1', sourceHandle: 'images', target: 'gen1', targetHandle: 'refs', animated: true },
  { id: 'e5', source: 'gen1', sourceHandle: 'image', target: 'prev1', targetHandle: 'media', animated: true },
  { id: 'e6', source: 'gen1', sourceHandle: 'image', target: 'save1', targetHandle: 'media', animated: true },
]

export const useStore = create((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  presets: initialPresets,
  settingsOpen: false,

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (conn) =>
    set({
      edges: addEdge({ ...conn, animated: true }, get().edges.filter(
        // 同一输入桩只允许一条连线（refAggregate 的每个口也是单连）
        (e) => !(e.target === conn.target && e.targetHandle === conn.targetHandle),
      )),
    }),
  updateData: (id, patch) =>
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    }),
  addNode: (node) => set({ nodes: [...get().nodes, node] }),

  // ── 设置面板 ──
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  // ── 预设 CRUD ──
  addPreset: (preset) => {
    const presets = [...get().presets, { id: `p${Date.now()}`, name: '新预设', ...preset }]
    persistPresets(presets)
    set({ presets })
  },
  updatePreset: (id, patch) => {
    const presets = get().presets.map((p) => (p.id === id ? { ...p, ...patch } : p))
    persistPresets(presets)
    set({ presets })
    // 同步更新所有正在使用该预设的 API 配置节点
    const updated = presets.find((p) => p.id === id)
    if (updated) {
      set({
        nodes: get().nodes.map((n) =>
          n.type === 'apiConfig' && n.data.presetId === id
            ? { ...n, data: { ...n.data, ...pickPresetFields(updated) } }
            : n,
        ),
      })
    }
  },
  removePreset: (id) => {
    const presets = get().presets.filter((p) => p.id !== id)
    persistPresets(presets)
    set({
      presets,
      // 使用中的节点转为自定义（保留当前值）
      nodes: get().nodes.map((n) =>
        n.type === 'apiConfig' && n.data.presetId === id ? { ...n, data: { ...n.data, presetId: '' } } : n,
      ),
    })
  },
}))

export function pickPresetFields(preset) {
  const out = {}
  for (const k of PRESET_FIELDS) out[k] = preset[k] ?? ''
  return out
}
