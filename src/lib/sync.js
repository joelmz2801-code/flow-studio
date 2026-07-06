import { supabase } from './supabase.js'

function snakeToCamel(row) {
  if (!row) return row
  return {
    id: row.id,
    title: row.title,
    messages: row.messages || [],
    createdAt: row.created_at,
  }
}

function presetToRow(preset, userId) {
  return {
    id: preset.id,
    user_id: userId,
    name: preset.name || '新预设',
    base_url: preset.baseUrl || '',
    api_key: preset.apiKey || '',
    image_model: preset.imageModel || '',
    video_model: preset.videoModel || '',
    image_path: preset.imagePath || '',
    video_path: preset.videoPath || '',
    models: preset.models || [],
  }
}

function rowToPreset(row) {
  if (!row) return row
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    imageModel: row.image_model,
    videoModel: row.video_model,
    imagePath: row.image_path,
    videoPath: row.video_path,
    models: row.models || [],
  }
}

export async function loadChatsFromCloud(userId) {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(snakeToCamel)
  } catch (err) {
    console.warn('[sync] 加载对话失败:', err.message)
    return null
  }
}

export async function saveChatToCloud(chat, userId) {
  if (!supabase || !userId) return
  try {
    const { error } = await supabase
      .from('chats')
      .upsert({
        id: chat.id,
        user_id: userId,
        title: chat.title || '新对话',
        messages: chat.messages || [],
        created_at: chat.createdAt || Date.now(),
      }, { onConflict: 'id' })
    if (error) throw error
  } catch (err) {
    console.warn('[sync] 保存对话失败:', err.message)
  }
}

export async function deleteChatFromCloud(chatId, userId) {
  if (!supabase || !userId) return
  try {
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', userId)
    if (error) throw error
  } catch (err) {
    console.warn('[sync] 删除对话失败:', err.message)
  }
}

export async function loadPresetsFromCloud(userId) {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('presets')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    return (data || []).map(rowToPreset)
  } catch (err) {
    console.warn('[sync] 加载预设失败:', err.message)
    return null
  }
}

export async function savePresetToCloud(preset, userId) {
  if (!supabase || !userId) return
  try {
    const { error } = await supabase
      .from('presets')
      .upsert(presetToRow(preset, userId), { onConflict: 'id' })
    if (error) throw error
  } catch (err) {
    console.warn('[sync] 保存预设失败:', err.message)
  }
}

export async function deletePresetFromCloud(presetId, userId) {
  if (!supabase || !userId) return
  try {
    const { error } = await supabase
      .from('presets')
      .delete()
      .eq('id', presetId)
      .eq('user_id', userId)
    if (error) throw error
  } catch (err) {
    console.warn('[sync] 删除预设失败:', err.message)
  }
}

export function subscribeToChanges(userId, onChatsChange, onPresetsChange) {
  if (!supabase || !userId) return () => {}

  const channel = supabase
    .channel('db-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'chats', filter: `user_id=eq.${userId}` },
      (payload) => { onChatsChange(payload) }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'presets', filter: `user_id=eq.${userId}` },
      (payload) => { onPresetsChange(payload) }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
