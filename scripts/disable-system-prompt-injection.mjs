import { readFileSync, writeFileSync } from 'node:fs'

const runnerPath = new URL('../src/engine/runner.js', import.meta.url)
let runner = readFileSync(runnerPath, 'utf8')

const startMarker = ' // 注入用户自定义提示词（按顺序拼接为 system message）'
const endMarker = ' const body = {'

if (runner.includes(startMarker)) {
  const start = runner.indexOf(startMarker)
  const end = runner.indexOf(endMarker, start)
  if (end < 0) throw new Error('Could not locate system prompt injection block')
  const replacement = ` // 自定义提示词仅作为用户管理的素材库保存，不自动注入 system message。\n const finalMessages = messages\n`
  runner = runner.slice(0, start) + replacement + runner.slice(end)
}

if (!runner.includes('const finalMessages = messages')) {
  throw new Error('System prompt injection was not disabled')
}

writeFileSync(runnerPath, runner)

const settingsPath = new URL('../src/SettingsModal.jsx', import.meta.url)
let settings = readFileSync(settingsPath, 'utf8')
settings = settings.replace(
  '这里是你定义 AI 身份与行为的唯一入口。每条独立管理，按顺序拼接到 system message。可无上限添加，字数无限制',
  '保存和整理常用提示词。内容不会自动注入 system message，使用时请手动插入对话。',
)
settings = settings.replace(
  '这些提示词将自动注入到所有 chat 模型的 system 消息。',
  '这些提示词仅作为素材保存，不会自动注入模型。',
)
writeFileSync(settingsPath, settings)

console.log('Runtime system prompt injection disabled')
