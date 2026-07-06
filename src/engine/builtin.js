// ─────────────────────────────────────────────
// 内置服务通道（应用默认使用，不在界面中展示明文）
// 支持多通道 + 同构多 Key，额度不足时自动切换
// ─────────────────────────────────────────────
const _d = (s) => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('utf8'))

// 通道数据（编码存储）
const _P = {
  xy: {
    u: 'aHR0cHM6Ly94aW55dWFuYWk2NjYuY29t',
    k: [
      'c2stdjZuMXA5d3R5ZjVDSDZhazJYQVhJczVldWZtTFpDYVJ0MVBldGhyUms3RmFMOVRG',
      'c2stekhIMHBBUjJTZ2JWd0NZMUhrR1dEVnR1SzJ0bVk4UHk4YzU5dm5RRGpiSHJzYVV6',
      'c2stYXVHNllTRHJrcnhCR0hYTmpXQ3F5N1pNQjRPMGprTWJvaHRGS2F3N0VpZXdyRzlp',
      'c2stbHdqYk9URVA0VXlFclA1UzE1eU1BQ0ZHaWV5RUc0YldIUmkydWV6MHlaaEFTRjhJ',
      'c2stRk5zQVA5amhsNTN3NTlhYzRwY3dPV2RhaHhSdWJSR3J5bGd6RUlabXJoYURZVDRi',
      'c2stcGVYcVdTdnpQbEVYbGZyWllCajRZTFBYZFJqelFoNFQxWVpLUmo4T1JWbWlrZFFT',
    ],
  },
  ag: {
    u: 'aHR0cHM6Ly9hcGlodWIuYWduZXMtYWkuY29t',
    k: ['c2stdGd1Tm42b2dHRUtNd2NlSjk2U1dFc1NVdDZ1U1pOczltTzBOM0xsRDZFaTRHa2wz'],
  },
}

// 对话框中展示的内置模型
export const BUILTIN_MODELS = [
  { id: 'image-2', label: 'Image 2', provider: 'xy', apiModel: 'gpt-image-2', desc: '多通道保障 · 高质量' },
  { id: 'agnes-image-2.1-flash', label: 'Agnes 2.1 Flash', provider: 'ag', apiModel: 'agnes-image-2.1-flash', desc: 'Agnes 通道 · 快速' },
  { id: 'agnes-image-2.0-flash', label: 'Agnes 2.0 Flash', provider: 'ag', apiModel: 'agnes-image-2.0-flash', desc: 'Agnes 通道 · 经典' },
]

export const DEFAULT_MODEL = 'agnes-image-2.1-flash'

// 解析模型 → 通道配置；未知模型走 xy 通道并原样透传模型名
export function resolveModel(modelId) {
  const m = BUILTIN_MODELS.find((x) => x.id === modelId)
  const pid = m ? m.provider : 'xy'
  const p = _P[pid]
  return {
    providerId: pid,
    baseUrl: _d(p.u),
    keys: p.k.map(_d),
    apiModel: m ? m.apiModel : modelId,
    imagePath: '/v1/images/generations',
  }
}

// ── Key 轮换指针（跨会话记忆，用户无感）──
const _idxKey = (pid) => `jfs-ch-${pid}`
export function getKeyIndex(pid, total) {
  const n = parseInt(localStorage.getItem(_idxKey(pid)) || '0', 10)
  return Number.isFinite(n) ? ((n % total) + total) % total : 0
}
export function setKeyIndex(pid, idx) {
  try { localStorage.setItem(_idxKey(pid), String(idx)) } catch { /* ignore */ }
}

// 判断是否为「额度/配额」类错误 → 应切换下一个 Key
export function isQuotaError(err) {
  const msg = String(err?.message || '').toLowerCase()
  if (/api (401|402|403|429)/.test(msg)) return true
  return /quota|insufficient|balance|exceed|limit|billing|余额|额度|欠费|不足/.test(msg)
}

// 兼容旧接口：工作流节点默认配置（使用 xy 通道当前 Key）
export function getBuiltinConfig() {
  const r = resolveModel('image-2')
  const idx = getKeyIndex('xy', r.keys.length)
  return {
    baseUrl: r.baseUrl,
    apiKey: r.keys[idx],
    imageModel: r.apiModel,
    videoModel: 'sora-2',
    imagePath: '/v1/images/generations',
    videoPath: '/v1/videos/generations',
  }
}
