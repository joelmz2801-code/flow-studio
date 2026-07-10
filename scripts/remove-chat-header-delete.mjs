import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/ChatPage.jsx', import.meta.url)
let source = readFileSync(path, 'utf8')

source = source.replace(', removeChat, clearChatMedia, deleteMessage', ', deleteMessage')

const handlerStart = source.indexOf(' // 删除当前对话（带选项）')
const handlerEnd = source.indexOf(' // 删除单条消息', handlerStart)
if (handlerStart >= 0 && handlerEnd > handlerStart) {
  source = source.slice(0, handlerStart) + source.slice(handlerEnd)
}

const headerStart = source.indexOf(' {/* 顶部对话操作栏：仅在有消息时显示 */}')
const contentStart = source.indexOf('\n\n ', headerStart + 1)
if (headerStart >= 0 && contentStart > headerStart) {
  const block = source.slice(headerStart, contentStart)
  if (block.includes('删除对话')) {
    source = source.slice(0, headerStart) + source.slice(contentStart)
  }
}

if (source.includes('handleDeleteChat') || source.includes('删除当前对话')) {
  throw new Error('Header delete conversation action still exists')
}

writeFileSync(path, source)
console.log('Header delete conversation action removed')
