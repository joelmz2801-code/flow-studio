import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react'
import { loadChatsFromCloud, saveChatToCloud, deleteChatFromCloud, loadPresetsFromCloud, savePresetToCloud, deletePresetFromCloud } from './lib/sync.js'

let counter = 100
export const nextId = () => `n${counter++}`

let _syncUserId = null
let _saveTimers = {}

function debouncedSaveChat(chat) {
  if (!_syncUserId) return
  clearTimeout(_saveTimers[chat.id])
  _saveTimers[chat.id] = setTimeout(() => {
    saveChatToCloud(chat, _syncUserId)
    delete _saveTimers[chat.id]
  }, 1500)
}

function debouncedSavePreset(preset) {
  if (!_syncUserId) return
  clearTimeout(_saveTimers[preset.id])
  _saveTimers[preset.id] = setTimeout(() => {
    savePresetToCloud(preset, _syncUserId)
    delete _saveTimers[preset.id]
  }, 1500)
}

export function forceFlushPendingSaves() {
  for (const [id, timer] of Object.entries(_saveTimers)) {
    clearTimeout(timer)
  }
  _saveTimers = {}
}

// ── localStorage key 管理：按用户隔离 ─────────────
function chatKey() {
  return _syncUserId ? `flowstudio.chats.v1:${_syncUserId}` : 'flowstudio.chats.v1'
}

function presetKey() {
  return _syncUserId ? `flowstudio.presets.v1:${_syncUserId}` : 'flowstudio.presets.v1'
}

// ── API 预设 ─────────────────────────────────────
export const PRESET_FIELDS = ['baseUrl', 'apiKey', 'imageModel', 'videoModel', 'imagePath', 'videoPath']

const DEFAULT_PRESETS = []

function loadPresetsFromStorage(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length) {
        return arr.map(p => ({ ...p, models: p.models || [] }))
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_PRESETS
}

function persistPresets(presets) {
  try { localStorage.setItem(presetKey(), JSON.stringify(presets)) } catch { /* ignore */ }
}

// ── 对话会话 ──────────────────────────────────────
function loadChatsFromStorage(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        return arr.map((c) => ({
          ...c,
          messages: (c.messages || []).map((m) =>
            m.status === 'loading' ? { ...m, status: 'error', text: '生成已中断，请重新发送' } : m,
          ),
        }))
      }
    }
  } catch { /* ignore */ }
  return []
}

function persistChats(chats) {
  try {
    localStorage.setItem(chatKey(), JSON.stringify(chats))
  } catch {
    try {
      const slim = chats.map((c) => ({
        ...c,
        messages: c.messages.map((m) => ({
          ...m,
          images: (m.images || []).map((u) => (u.startsWith('data:') ? '' : u)),
          refs: [],
        })),
      }))
      localStorage.setItem(chatKey(), JSON.stringify(slim))
    } catch { /* ignore */ }
  }
}

// ── 初始数据（匿名状态） ──────────────────────────
const initialPresets = loadPresetsFromStorage(presetKey())
const initialChats = loadChatsFromStorage(chatKey())

const initialNodes = [
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
  { id: 'e2', source: 'ref1', sourceHandle: 'image', target: 'agg1', targetHandle: 'img1', animated: true },
  { id: 'e3', source: 'ref2', sourceHandle: 'image', target: 'agg1', targetHandle: 'img2', animated: true },
  { id: 'e4', source: 'agg1', sourceHandle: 'images', target: 'gen1', targetHandle: 'refs', animated: true },
  { id: 'e5', source: 'gen1', sourceHandle: 'image', target: 'prev1', targetHandle: 'media', animated: true },
  { id: 'e6', source: 'gen1', sourceHandle: 'image', target: 'save1', targetHandle: 'media', animated: true },
]

export const newChatId = () => `c${Date.now()}${Math.floor(Math.random() * 1000)}`

export const useStore = create((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  presets: initialPresets,
  settingsOpen: false,
  settingsTab: 'api',

  chats: initialChats,
  activeView: initialChats.length ? { type: 'chat', id: initialChats[0].id } : { type: 'chat', id: null },
  sidebarCollapsed: false,
  mobileNavOpen: false,
  searchQuery: '',

  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  // ── 提示词灵感库 ──
  promptLibOpen: false,
  pendingPrompt: null,
  setPromptLibOpen: (v) => set({ promptLibOpen: v }),
  usePrompt: (text) => {
    const st = get()
    let view = st.activeView
    if (view.type !== 'chat' || !view.id) {
      if (st.chats.length) view = { type: 'chat', id: st.chats[0].id }
      else { st.createChat(); view = get().activeView }
    }
    set({ pendingPrompt: text, activeView: view, promptLibOpen: false, mobileNavOpen: false })
  },
  consumePendingPrompt: () => set({ pendingPrompt: null }),

  // ── 对话 CRUD ──
  createChat: () => {
    const chat = { id: newChatId(), title: '新对话', messages: [], createdAt: Date.now() }
    const chats = [chat, ...get().chats]
    persistChats(chats)
    set({ chats, activeView: { type: 'chat', id: chat.id } })
    debouncedSaveChat(chat)
    return chat.id
  },
  removeChat: (id) => {
    const chats = get().chats.filter((c) => c.id !== id)
    persistChats(chats)
    const av = get().activeView
    set({
      chats,
      activeView:
        av.type === 'chat' && av.id === id
          ? { type: 'chat', id: chats[0]?.id || null }
          : av,
    })
    deleteChatFromCloud(id, _syncUserId)
  },
  renameChat: (id, title) => {
    const chats = get().chats.map((c) => (c.id === id ? { ...c, title } : c))
    persistChats(chats)
    set({ chats })
    const chat = chats.find((c) => c.id === id)
    if (chat) debouncedSaveChat(chat)
  },
  appendMessage: (chatId, message) => {
    const chats = get().chats.map((c) =>
      c.id === chatId ? { ...c, messages: [...c.messages, message] } : c,
    )
    persistChats(chats)
    set({ chats })
    const chat = chats.find((c) => c.id === chatId)
    if (chat) debouncedSaveChat(chat)
  },
  deleteMessage: (chatId, msgId) => {
    const chats = get().chats.map((c) =>
      c.id === chatId ? { ...c, messages: c.messages.filter((m) => m.id !== msgId) } : c,
    )
    persistChats(chats)
    set({ chats })
    const chat = chats.find((c) => c.id === chatId)
    if (chat) debouncedSaveChat(chat)
  },
  clearChatMedia: (chatId) => {
    // 仅清除图片/视频，保留对话文本与时间戳
    const chats = get().chats.map((c) => {
      if (c.id !== chatId) return c
      return {
        ...c,
        messages: c.messages.map((m) => ({
          ...m,
          images: [],
          videos: [],
          refs: [],
        })),
      }
    })
    persistChats(chats)
    set({ chats })
    const chat = chats.find((c) => c.id === chatId)
    if (chat) debouncedSaveChat(chat)
  },
  updateMessage: (chatId, msgId, patch) => {
    const chats = get().chats.map((c) =>
      c.id === chatId
        ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) }
        : c,
    )
    persistChats(chats)
    set({ chats })
    const chat = chats.find((c) => c.id === chatId)
    if (chat) debouncedSaveChat(chat)
  },

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (conn) =>
    set({
      edges: addEdge({ ...conn, animated: true }, get().edges.filter(
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
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  openSettings: (tab) => set({ settingsTab: tab, settingsOpen: true }),

  // ── 预设 CRUD ──
  addPreset: (preset) => {
    const presets = [...get().presets, { id: `p${Date.now()}`, name: '新预设', ...preset }]
    persistPresets(presets)
    set({ presets })
    const added = presets[presets.length - 1]
    debouncedSavePreset(added)
  },
  updatePreset: (id, patch) => {
    const presets = get().presets.map((p) => (p.id === id ? { ...p, ...patch } : p))
    persistPresets(presets)
    set({ presets })
    const updated = presets.find((p) => p.id === id)
    if (updated) {
      debouncedSavePreset(updated)
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
      nodes: get().nodes.map((n) =>
        n.type === 'apiConfig' && n.data.presetId === id ? { ...n, data: { ...n.data, presetId: '' } } : n,
      ),
    })
    deletePresetFromCloud(id, _syncUserId)
  },
}))

// ── 账户切换：登录时加载该用户数据，退出时清除 ──────

export async function syncFromCloud(userId) {
  _syncUserId = userId

  // 登录时先清空内存，防止旧账户数据残留
  useStore.setState({
    chats: [],
    presets: DEFAULT_PRESETS,
    activeView: { type: 'chat', id: null },
  })

  const [cloudChats, cloudPresets] = await Promise.all([
    loadChatsFromCloud(userId),
    loadPresetsFromCloud(userId),
  ])

  // 加载该用户本地缓存
  const localChats = loadChatsFromStorage(chatKey())
  const localPresets = loadPresetsFromStorage(presetKey())

  // 云端有数据 → 以云端为准（云端是权威源）
  if (cloudChats !== null) {
    const chats = cloudChats.length > 0 ? cloudChats : localChats
    persistChats(chats)
    useStore.setState({
      chats,
      activeView: chats.length ? { type: 'chat', id: chats[0].id } : { type: 'chat', id: null },
    })
    // 云端为空但本地有数据 → 首次登录，上传本地数据
    if (cloudChats.length === 0 && localChats.length > 0) {
      for (const chat of localChats) saveChatToCloud(chat, userId)
    }
  }

  if (cloudPresets !== null) {
    const presets = cloudPresets.length > 0 ? cloudPresets : localPresets
    persistPresets(presets)
    useStore.setState({ presets })
    if (cloudPresets.length === 0 && localPresets.length > 0) {
      for (const preset of localPresets) savePresetToCloud(preset, userId)
    }
  }
}

export function clearUserData() {
  _syncUserId = null
  for (const t of Object.values(_saveTimers)) clearTimeout(t)
  _saveTimers = {}

  const chats = loadChatsFromStorage(chatKey())
  const presets = loadPresetsFromStorage(presetKey())
  useStore.setState({
    chats,
    presets,
    activeView: chats.length ? { type: 'chat', id: chats[0].id } : { type: 'chat', id: null },
  })
}

// ── 实时增量更新（不触发重新加载） ──────────────────
function toCamelChat(row) {
  if (!row) return null
  return { id: row.id, title: row.title, messages: row.messages || [], createdAt: row.created_at }
}

function toCamelPreset(row) {
  if (!row) return null
  return {
    id: row.id, name: row.name, baseUrl: row.base_url, apiKey: row.api_key,
    imageModel: row.image_model, videoModel: row.video_model,
    imagePath: row.image_path, videoPath: row.video_path, models: row.models || [],
  }
}

export function applyRealtimeChatChange(payload) {
  const { eventType, new: newRow, old: oldRow } = payload
  const store = useStore.getState()
  let chats

  if (eventType === 'DELETE') {
    chats = store.chats.filter(c => c.id !== oldRow.id)
  } else {
    const chat = toCamelChat(newRow)
    if (!chat) return
    const idx = store.chats.findIndex(c => c.id === chat.id)
    if (idx >= 0) {
      chats = [...store.chats]
      chats[idx] = chat
    } else {
      chats = [chat, ...store.chats]
    }
  }

  persistChats(chats)
  useStore.setState({ chats })
}

export function applyRealtimePresetChange(payload) {
  const { eventType, new: newRow, old: oldRow } = payload
  const store = useStore.getState()
  let presets

  if (eventType === 'DELETE') {
    presets = store.presets.filter(p => p.id !== oldRow.id)
  } else {
    const preset = toCamelPreset(newRow)
    if (!preset) return
    const idx = store.presets.findIndex(p => p.id === preset.id)
    if (idx >= 0) {
      presets = [...store.presets]
      presets[idx] = preset
    } else {
      presets = [...store.presets, preset]
    }
  }

  persistPresets(presets)
  useStore.setState({ presets })
}

export function setSyncUserId(userId) {
  _syncUserId = userId
}

export function pickPresetFields(preset) {
  const out = {}
  for (const k of PRESET_FIELDS) out[k] = preset[k] ?? ''
  return out
}
