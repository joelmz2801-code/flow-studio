// ─────────────────────────────────────────────
// 内置服务通道（应用默认使用，不在界面中展示）
// ─────────────────────────────────────────────
const _e = [
  'aHR0cHM6Ly94aW55dWFuYWk2NjYuY29t',
  'c2stdjZuMXA5d3R5ZjVDSDZhazJYQVhJczVldWZtTFpDYVJ0MVBldGhyUms3RmFMOVRG',
]

const _d = (s) => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('utf8'))

export function getBuiltinConfig() {
  return {
    baseUrl: _d(_e[0]),
    apiKey: _d(_e[1]),
    imageModel: 'gpt-image-1',
    videoModel: 'sora-2',
    imagePath: '/v1/images/generations',
    videoPath: '/v1/videos/generations',
  }
}
