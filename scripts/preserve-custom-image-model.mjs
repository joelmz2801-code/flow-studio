import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/ChatPage.jsx', import.meta.url)
let source = readFileSync(path, 'utf8')

const oldBlock = ` // 自动转接逻辑：
 // 1. 上传了参考图 → 一律走图生图（agnes-image-2.1-flash）
 // 2. 文本模型不再基于关键词自动转生图（避免误触）
 // 3. 文本模型可通过 tool_calls 调用 generate_image 工具主动生图
 let activeModel = model
 let activeIsVideo = isVideo
 let activeIsChat = isChat
 if (activeRefs.length > 0) {
 // 有参考图 → 图生图模式
 activeModel = 'agnes-image-2.1-flash'
 activeIsVideo = false
 activeIsChat = false
 }`

const newBlock = ` // 自动转接逻辑：
 // 1. 已选择图片模型（包括自定义模型）时，图生图必须保留该模型。
 // 2. 只有当前选择不是图片模型时，上传参考图才回退到系统图片模型。
 // 3. 文本模型可通过 tool_calls 主动调用 generate_image 工具。
 let activeModel = model
 let activeIsVideo = isVideo
 let activeIsChat = isChat
 if (activeRefs.length > 0) {
 // 自定义图片模型和内置图片模型都直接接收参考图，不再被默认模型覆盖。
 activeModel = isImage ? model : 'agnes-image-2.1-flash'
 activeIsVideo = false
 activeIsChat = false
 }`

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock)
} else if (source.includes("activeModel = 'agnes-image-2.1-flash'")) {
  source = source.replace(
    "activeModel = 'agnes-image-2.1-flash'",
    "activeModel = isImage ? model : 'agnes-image-2.1-flash'",
  )
}

if (!source.includes("activeModel = isImage ? model : 'agnes-image-2.1-flash'")) {
  throw new Error('Could not apply custom image model preservation')
}

writeFileSync(path, source)
console.log('Selected custom image model is preserved for image-to-image')
