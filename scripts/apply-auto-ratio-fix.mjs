import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/ChatPage.jsx', import.meta.url)
let source = readFileSync(path, 'utf8')

const oldBlockStart = ' // Auto 模式智能画幅：按 prompt 关键词决定比例'
const newBlockStart = ' // Auto 模式智能画幅：先尊重明确比例，再按主体、构图和投放场景判断。'

if (source.includes(oldBlockStart)) {
  const start = source.indexOf(oldBlockStart)
  const end = source.indexOf('\n\n const send = async', start)
  if (end < 0) throw new Error('Could not locate Auto ratio block end')

  const replacement = ` // Auto 模式智能画幅：先尊重明确比例，再按主体、构图和投放场景判断。
 // 无明确线索时使用更通用的 4:3，不再悄悄退回 1:1。
 const detectAutoRatio = (text) => {
 const t = (text || '').toLowerCase()
 const pick = (id) => RATIOS.find((r) => r.id === id)

 const explicit = t.match(/(?:^|\\s)(16:9|9:16|4:3|3:4|2:3|1:1)(?:$|\\s|，|,|。)/)?.[1]
 if (explicit) return pick(explicit)

 if (/(短视频|手机壁纸|竖屏|reels?|stories?|tiktok|小红书竖图|vertical video)/i.test(t)) return pick('9:16')
 if (/(海报|电影海报|宣传海报|全身像|全身照|杂志封面|poster|full[- ]?body|editorial cover)/i.test(t)) return pick('2:3')
 if (/(竖幅|半身像|时装模特|穿搭|portrait photo|fashion portrait|standing portrait)/i.test(t)) return pick('3:4')
 if (/(头像|证件照|icon|图标|logo|徽标|avatar|profile picture|sticker|贴纸)/i.test(t)) return pick('1:1')
 if (/(人像|人物|肖像|脸部|人脸|特写|半身|情侣|合照|家庭照|portrait|headshot|close[- ]?up|people|person|model)/i.test(t)) return pick('4:3')
 if (/(全景|宽屏|电影感|电影画面|视频封面|横幅|电脑壁纸|风景|山川|草原|大海|城市天际线|panorama|panoramic|cinematic|banner|landscape|wide shot|wallpaper)/i.test(t)) return pick('16:9')
 if (/(产品|静物|美食|菜品|室内|建筑|街景|店铺|电商|product|still life|food|interior|architecture)/i.test(t)) return pick('4:3')

 return pick('4:3')
 }`

  source = source.slice(0, start) + replacement + source.slice(end)
}

source = source.replace(
  "ratio: ratio.id === 'auto' ? null : { w: ratio.w, h: ratio.h }, time: Date.now(),",
  "ratio: { w: effectiveRatio.w, h: effectiveRatio.h }, time: Date.now(),",
)
source = source.replace(
  "size: effectiveRatio.id === 'auto' ? sizeForRatio(effectiveRatio.w, effectiveRatio.h) : sizeForRatio(ratio.w, ratio.h)",
  "size: sizeForRatio(effectiveRatio.w, effectiveRatio.h)",
)

if (!source.includes(newBlockStart)) throw new Error('Smart Auto ratio logic was not applied')
if (!source.includes('size: sizeForRatio(effectiveRatio.w, effectiveRatio.h)')) throw new Error('Effective image size was not applied')

writeFileSync(path, source)
console.log('Smart Auto ratio logic ready')
