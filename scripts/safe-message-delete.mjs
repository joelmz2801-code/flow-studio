import { readFileSync, writeFileSync } from 'node:fs'

const chatPath = new URL('../src/ChatPage.jsx', import.meta.url)
let chat = readFileSync(chatPath, 'utf8')
chat = chat.replace(
  'onClick={() => onDelete(m.id)} title="删除此消息"',
  'onClick={(event) => { event.stopPropagation(); onDelete?.(m.id) }} title="删除此消息"',
)
chat = chat.replace(
  'onClick={() => onDelete(m.id)}\n title="删除此消息"',
  'onClick={(event) => { event.stopPropagation(); onDelete?.(m.id) }}\n title="删除此消息"',
)
chat = chat.replace(/onDelete=\{handleDeleteChat\}/g, 'onDelete={handleDeleteMessage}')
if (!chat.includes('event.stopPropagation(); onDelete?.(m.id)')) {
  throw new Error('Could not isolate the message delete button')
}
writeFileSync(chatPath, chat)

const storePath = new URL('../src/store.js', import.meta.url)
let store = readFileSync(storePath, 'utf8')
const oldBlock = ` deleteMessage: (chatId, msgId) => {
 const chats = get().chats.map((c) =>
 c.id === chatId ? { ...c, messages: c.messages.filter((m) => m.id !== msgId) } : c,
 )
 persistChats(chats)
 set({ chats })
 const chat = chats.find((c) => c.id === chatId)
 if (chat) debouncedSaveChat(chat)
 },`
const newBlock = ` deleteMessage: (chatId, msgId) => {
 if (!chatId || !msgId) return
 const before = get().chats
 const target = before.find((c) => c.id === chatId)
 if (!target) return
 const messages = (target.messages || []).filter((m) => m.id !== msgId)
 if (messages.length === (target.messages || []).length) return
 const updatedChat = { ...target, messages }
 const chats = before.map((c) => (c.id === chatId ? updatedChat : c))
 // Invariant: deleting a message may update one chat, never remove a chat.
 if (chats.length !== before.length) return
 persistChats(chats)
 set({ chats })
 debouncedSaveChat(updatedChat)
 },`
if (store.includes(oldBlock)) store = store.replace(oldBlock, newBlock)
if (!store.includes('Invariant: deleting a message may update one chat, never remove a chat.')) {
  throw new Error('Could not install safe message deletion invariant')
}
writeFileSync(storePath, store)
console.log('Single-message deletion is isolated and cannot remove its conversation')
