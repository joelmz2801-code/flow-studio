// ─────────────────────────────────────────────
// 内置服务通道（应用默认使用，不在界面中展示明文）
// 支持多通道 + 同构多 Key，额度不足时自动切换
// ─────────────────────────────────────────────
const _d = (s) => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('utf8'))

// 通道数据（编码存储）
// 系统现在统一使用 Agnes 通道（ag）；co / or 通道定义仅作历史兼容保留，
// 不再被任何内置模型引用，旧聊天记录若仍引用 command-a-vision / hy3，
// 仍可由对应通道继续响应。
const _P = {
  ag: {
    u: 'aHR0cHM6Ly9qb2VsLWFwaS1rZXktcHJveHkuam9lbHRpbmcwMi53b3JrZXJzLmRldi9hZ25lc2Fp',
    k: ['eHVXako4T1pOTVVWU1gtRjA1c2hJSk41c0hpN0JlX1NrVFROdXFLajFKTQ=='],
    imagePath: '/images/generations',
    videoPath: '/videos',
    chatPath: '/chat/completions',
  },
  // 兼容保留：旧消息中可能仍引用 Command / HY3
  co: {
    u: 'aHR0cHM6Ly9hcGkuY29oZXJlLmFpL2NvbXBhdGliaWxpdHk=',
    k: ['aDRVQzNUVHR3dVdwSEZSYkVPWk9teU40aGlndlNlQWZVeDVsQndobA=='],
  },
  or: {
    u: 'aHR0cHM6Ly9vcGVucm91dGVyLmFp',
    k: ['c2stb3ItdjEtZjU1YzUyNTE4Nzg1YWFjMmJlOTI3NzBiMzdlOTU1NzIwNjUwOTNkYTI1ODdlZWE3YjYwYzYwZDk0NjY5MDE0Yg=='],
  },
  // xy 通道：用户自定义 / 获取模型列表时的兜底（透传模型名到 xinyuanai）
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
}

// 对话框中展示的内置模型
// 仅保留 Agnes 系列；Command AI 和 HY3 已下线。
// 2.0 文本模型（chat）与 2.0 图片模型（image）id 不同、label 明确区分：
//   agnes-2.0-flash           → 「Agnes 2.0 Flash」      (chat)
//   agnes-image-2.0-flash     → 「Agnes Image 2.0 Flash」(image)
//   agnes-image-2.1-flash     → 「Agnes Image 2.1 Flash」(image)
//   agnes-video-2.0           → 「Agnes Video V2.0」     (video)
export const BUILTIN_MODELS = [
  { id: 'agnes-2.0-flash',         label: 'Agnes 2.0 Flash',       provider: 'ag', apiModel: 'agnes-2.0-flash',         desc: 'Agnes 官方 · 文本对话',         type: 'chat' },
  { id: 'agnes-image-2.0-flash',   label: 'Agnes Image 2.0 Flash', provider: 'ag', apiModel: 'agnes-image-2.0-flash',   desc: 'Agnes 官方 · 文生图经典',       type: 'image' },
  { id: 'agnes-image-2.1-flash',   label: 'Agnes Image 2.1 Flash', provider: 'ag', apiModel: 'agnes-image-2.1-flash',   desc: 'Agnes 官方 · 文生图快速',       type: 'image' },
  { id: 'agnes-video-2.0',         label: 'Agnes Video V2.0',      provider: 'ag', apiModel: 'agnes-video-v2.0',        desc: 'Agnes 官方 · 文生视频',         type: 'video' },
]

export const DEFAULT_MODEL = 'agnes-2.0-flash'


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
    imagePath: p.imagePath || '/v1/images/generations',
    videoPath: p.videoPath || '/v1/videos',
    chatPath: m?.chatPath || p.chatPath || '/v1/chat/completions',
    type: m ? m.type : 'image',
    supportsTools: m ? !!m.supportsTools : false
  }
}

// ── Key 随机负载均衡：每次请求随机抽取起始 Key，失败则顺序 failover ──
// 用户量小（1-2 人），随机即可实现简单负载均衡，无需服务端协调
export function randomKeyIndex(total) {
  if (total <= 0) return 0
  return Math.floor(Math.random() * total)
}

// 保留旧接口以兼容工作流节点（getBuiltinConfig）— 内部改为随机
const _idxKey = (pid) => `jfs-ch-${pid}`
export function getKeyIndex(pid, total) {
  return randomKeyIndex(total)
}
export function setKeyIndex(pid, idx) {
  // 随机模式下不再持久化指针，保留空函数以兼容旧调用点
}

// 判断是否为「额度/配额」类错误 → 应切换下一个 Key
export function isQuotaError(err) {
  const msg = String(err?.message || '').toLowerCase()
  if (/api (401|402|403|429)/.test(msg)) return true
  return /quota|insufficient|balance|exceed|limit|billing|余额|额度|欠费|不足/.test(msg)
}

// 兼容旧接口：工作流节点默认配置（使用 ag 通道随机 Key）
export function getBuiltinConfig() {
  const r = resolveModel('agnes-image-2.1-flash')
  const idx = randomKeyIndex(r.keys.length)
  return {
    baseUrl: r.baseUrl,
    apiKey: r.keys[idx],
    imageModel: r.apiModel,
    videoModel: 'agnes-video-v2.0',
    imagePath: r.imagePath,
    videoPath: r.videoPath,
  }
}
