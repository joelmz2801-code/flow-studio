// ─────────────────────────────────────────────
// 提示词变量模板
// 在自定义提示词中可用 {{xxx}} 占位符，发起请求时自动替换
// 类似 Cherry Studio 的「可变量」系统
// ─────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0')

function getDateString(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getTimeString(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function getDateTimeString(d = new Date()) {
  return `${getDateString(d)} ${getTimeString(d)}`
}

function getSystemInfo() {
  if (typeof navigator === 'undefined') return 'Unknown'
  const ua = navigator.userAgent || ''
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11'
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown'
}

function getArchInfo() {
  if (typeof navigator === 'undefined') return 'Unknown'
  // navigator.userAgentData 较新；优先 platform + hardwareConcurrency 推测
  const uaData = navigator.userAgentData
  if (uaData && typeof uaData.getHighEntropyValues === 'function') {
    // 同步无法获取；尝试从 platforms 推
    const archs = uaData.platforms || []
    if (archs.length) return archs[0]
  }
  // 兜底
  if (navigator.platform) {
    if (/Win64|x64|x86_64|amd64/i.test(navigator.userAgent + navigator.platform)) return 'x86_64'
    if (/arm/i.test(navigator.platform)) return 'arm64'
  }
  if (/x86_64|Win64|x64;|amd64/i.test(navigator.userAgent)) return 'x86_64'
  if (/arm64/i.test(navigator.userAgent)) return 'arm64'
  return 'x86_64'
}

function getLanguage() {
  if (typeof navigator === 'undefined') return 'zh-CN'
  return navigator.language || navigator.userLanguage || 'zh-CN'
}

// 构建变量映射（每次请求动态计算，确保时间相关变量是最新的）
export function buildPromptVariables({ model, username } = {}) {
  return {
    date: getDateString(),
    time: getTimeString(),
    datetime: getDateTimeString(),
    system: getSystemInfo(),
    arch: getArchInfo(),
    language: getLanguage(),
    model_name: model || 'Unknown',
    username: username || 'User',
  }
}

// 把模板里的 {{xxx}} 替换为变量值
// 未识别的占位符原样保留（避免误删用户特殊语法）
export function renderPromptTemplate(text, variables) {
  if (!text || typeof text !== 'string') return text
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key])
    }
    return m
  })
}

// 当前支持的变量列表（供 UI 展示）
export const AVAILABLE_VARIABLES = [
  { key: 'date', desc: '日期', example: '2026-07-08' },
  { key: 'time', desc: '时间', example: '14:30:25' },
  { key: 'datetime', desc: '日期和时间', example: '2026-07-08 14:30:25' },
  { key: 'system', desc: '操作系统', example: 'Windows 10/11' },
  { key: 'arch', desc: 'CPU 架构', example: 'x86_64' },
  { key: 'language', desc: '语言', example: 'zh-CN' },
  { key: 'model_name', desc: '模型名称', example: 'command-a-vision' },
  { key: 'username', desc: '用户名', example: 'Joel' },
]
