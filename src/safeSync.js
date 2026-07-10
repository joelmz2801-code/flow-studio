import {
  useStore,
  setSyncUserId,
  applyRealtimeChatChange,
  applyRealtimePresetChange,
  applyRealtimeCustomPromptChange,
} from './store.js'
import {
  loadChatsFromCloud,
  saveChatToCloud,
  loadPresetsFromCloud,
  savePresetToCloud,
  loadCustomPromptsFromCloud,
  saveCustomPromptToCloud,
} from './lib/sync.js'

let activeUserId = null
let syncGeneration = 0

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeArray(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* keep in-memory state */ }
}

function chatActivity(chat) {
  return Math.max(
    Number(chat?.createdAt) || 0,
    ...(chat?.messages || []).map((message) => Number(message?.time) || 0),
  )
}

function mergeChats(cloudChats, localChats) {
  const localById = new Map(localChats.map((chat) => [chat.id, chat]))
  const merged = cloudChats.map((cloudChat) => {
    const localChat = localById.get(cloudChat.id)
    if (!localChat) return cloudChat
    localById.delete(cloudChat.id)

    // Prefer the local snapshot on ties. This protects a just-failed image request
    // from being replaced by an older realtime echo containing an empty/loading row.
    return chatActivity(localChat) >= chatActivity(cloudChat) ? localChat : cloudChat
  })
  return [...merged, ...localById.values()].sort(
    (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0),
  )
}

export async function syncFromCloudSafely(userId) {
  if (!userId) return

  const generation = ++syncGeneration
  const isSameUser = activeUserId === userId
  activeUserId = userId
  setSyncUserId(userId)

  const chatKey = `flowstudio.chats.v1:${userId}`
  const presetKey = `flowstudio.presets.v1:${userId}`
  const promptKey = `flowstudio.customPrompts.v1:${userId}`
  const localChats = readArray(chatKey)
  const localPresets = readArray(presetKey)
  const localPrompts = readArray(promptKey)

  // Switching accounts must isolate data. Re-syncing the same account must never
  // blank the live UI while network requests are in flight or failing.
  if (!isSameUser) {
    useStore.setState({
      chats: localChats,
      presets: localPresets,
      customPrompts: localPrompts,
      activeView: localChats.length
        ? { type: 'chat', id: localChats[0].id }
        : { type: 'chat', id: null },
    })
  }

  const [cloudChats, cloudPresets, cloudPrompts] = await Promise.all([
    loadChatsFromCloud(userId),
    loadPresetsFromCloud(userId),
    loadCustomPromptsFromCloud(userId),
  ])

  if (generation !== syncGeneration || activeUserId !== userId) return

  if (cloudChats !== null) {
    const latestLocalChats = readArray(chatKey)
    const chats = cloudChats.length
      ? mergeChats(cloudChats, latestLocalChats)
      : latestLocalChats
    writeArray(chatKey, chats)
    useStore.setState((state) => ({
      chats,
      activeView:
        state.activeView?.type === 'chat' && chats.some((chat) => chat.id === state.activeView.id)
          ? state.activeView
          : chats.length ? { type: 'chat', id: chats[0].id } : { type: 'chat', id: null },
    }))
    if (cloudChats.length === 0) {
      latestLocalChats.forEach((chat) => saveChatToCloud(chat, userId))
    }
  }

  if (cloudPresets !== null) {
    const presets = cloudPresets.length ? cloudPresets : readArray(presetKey)
    writeArray(presetKey, presets)
    useStore.setState({ presets })
    if (cloudPresets.length === 0) {
      presets.forEach((preset) => savePresetToCloud(preset, userId))
    }
  }

  if (cloudPrompts !== null) {
    const prompts = cloudPrompts.length ? cloudPrompts : readArray(promptKey)
    writeArray(promptKey, prompts)
    useStore.setState({ customPrompts: prompts })
    if (cloudPrompts.length === 0) {
      prompts.forEach((prompt, index) => saveCustomPromptToCloud(prompt, userId, index))
    }
  }
}

export function applyRealtimeChatChangeSafely(payload) {
  if (payload?.eventType === 'DELETE') {
    applyRealtimeChatChange(payload)
    return
  }

  const incoming = payload?.new
  if (!incoming?.id) return
  const local = useStore.getState().chats.find((chat) => chat.id === incoming.id)
  const remoteChat = {
    id: incoming.id,
    title: incoming.title,
    messages: incoming.messages || [],
    createdAt: incoming.created_at,
  }

  // Ignore stale/self echoes. A newer remote message still wins for cross-device sync.
  if (local && chatActivity(local) >= chatActivity(remoteChat)) return
  applyRealtimeChatChange(payload)
}

export const applyRealtimePresetChangeSafely = applyRealtimePresetChange
export const applyRealtimeCustomPromptChangeSafely = applyRealtimeCustomPromptChange

export function resetSafeSync() {
  activeUserId = null
  syncGeneration++
}
