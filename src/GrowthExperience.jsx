import React, { useEffect, useState } from 'react'
import { useStore } from './store.js'
import './growth-experience.css'

const TASKS = [
  { id: 'product', label: '电商主图', kicker: '卖点更清楚', art: 'product', ratio: '1:1', style: '写实摄影', prompt: '为一款高端护肤精华制作电商主图：产品瓶居中悬浮，雾面玻璃渐变背景，柔和棚拍光，清晰材质细节，留出品牌文案空间，1:1 方图，无文字无水印。' },
  { id: 'social', label: '社媒封面', kicker: '一眼抓住注意力', art: 'social', ratio: '3:4', style: '编辑设计', prompt: '制作一张小红书风格的城市周末指南封面：明快编辑排版感，咖啡店与街景拼贴，奶油黄和钴蓝配色，年轻轻松，3:4 竖版，画面不要出现乱码文字。' },
  { id: 'poster', label: '品牌海报', kicker: '直接交付成片', art: 'poster', ratio: '2:3', style: '3D 渲染', prompt: '制作未来科技品牌发布会主视觉海报：半透明金属球体悬浮，深紫背景，克制的霓虹边缘光，强烈空间层次，2:3 竖版，预留标题区域，无文字无水印。' },
  { id: 'avatar', label: '头像', kicker: '稳定又有辨识度', art: 'avatar', ratio: '1:1', style: '动漫插画', prompt: '生成一张有辨识度的社交头像：自信的年轻创作者半身像，简洁轮廓，柔和侧光，细腻插画质感，背景干净，人物居中，1:1 方图。' },
  { id: 'wallpaper', label: '壁纸', kicker: '氛围感拉满', art: 'wallpaper', ratio: '16:9', style: '电影感', prompt: '生成宽屏桌面壁纸：雨后清晨的未来城市天台，远处云层被日光穿透，湿润地面反射微光，安静电影感，16:9，高清细节，无文字。' },
  { id: 'storyboard', label: '漫画分镜', kicker: '快速展开故事', art: 'storyboard', ratio: '16:9', style: '黑白漫画', prompt: '创作一页四格电影分镜：侦探在雨夜车站发现一只遗失的红色手提箱，镜头从全景推进到手部特写，黑白漫画线稿，仅手提箱保留红色，16:9 构图。' }
]

function typeIntoComposer(text, attempt = 0) {
  const textarea = document.querySelector('.main-area textarea')
  if (!textarea) {
    if (attempt < 15) setTimeout(() => typeIntoComposer(text, attempt + 1), 40)
    return
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  if (setter) setter.call(textarea, text)
  else textarea.value = text
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  textarea.focus()
}

function pickImageModel() {
  const trigger = document.querySelector('button[title="选择生图模型"]')
  if (!trigger) return
  trigger.click()
  setTimeout(() => {
    const buttons = [...document.querySelectorAll('button')]
    const option = buttons.find((button) => /agnes-image-2\.1-flash|agnes image 2\.1 flash/i.test(button.textContent || ''))
      || buttons.find((button) => /图片模型/.test(button.textContent || '') && !/选择模型/.test(button.textContent || ''))
    option?.click()
  }, 100)
}

export default function GrowthExperience({ activeView }) {
  const chats = useStore((state) => state.chats)
  const createChat = useStore((state) => state.createChat)
  const [dismissedChatId, setDismissedChatId] = useState(null)
  const [notice, setNotice] = useState('')
  const chat = chats.find((item) => item.id === activeView?.id)
  const messages = chat?.messages || []
  const isChat = activeView?.type !== 'flow'
  const empty = isChat && messages.length === 0
  const onboardingVisible = empty && dismissedChatId !== (activeView?.id || null)

  useEffect(() => {
    document.documentElement.classList.toggle('jfs-growth-empty', onboardingVisible)
    return () => document.documentElement.classList.remove('jfs-growth-empty')
  }, [onboardingVisible])

  const applyTask = (task) => {
    const targetChatId = activeView?.id || createChat()
    setDismissedChatId(targetChatId)
    document.documentElement.classList.remove('jfs-growth-empty')
    localStorage.setItem('jfs-last-task', task.id)
    localStorage.setItem('jfs-model', 'agnes-image-2.1-flash')

    requestAnimationFrame(() => {
      typeIntoComposer(task.prompt)
      setTimeout(() => typeIntoComposer(task.prompt), 60)
    })
    setTimeout(pickImageModel, 100)
    setNotice(`已套用「${task.label}」，可以直接生成`)
  }

  if (!isChat) return null

  return (
    <>
      {onboardingVisible && (
        <section className="growth-onboarding" aria-labelledby="growth-title">
          <div className="growth-copy">
            <span className="growth-eyebrow">2 分钟完成第一张作品</span>
            <h1 id="growth-title">今天想完成什么？</h1>
            <p>不用先学提示词。选一个任务，我把描述、画幅和风格都准备好。</p>
          </div>
          <div className="growth-tasks" role="list">
            {TASKS.map((task) => (
              <button className="growth-task" key={task.id} onClick={() => applyTask(task)} role="listitem">
                <span className={`growth-art growth-art-${task.art}`} aria-hidden="true"><i /></span>
                <span className="growth-task-copy"><strong>{task.label}</strong><small>{task.kicker}</small><span>{task.ratio} · {task.style}</span></span>
                <b aria-hidden="true">↗</b>
              </button>
            ))}
          </div>
          <button className="growth-free" onClick={() => {
            setDismissedChatId(activeView?.id || null)
            document.documentElement.classList.remove('jfs-growth-empty')
            setTimeout(() => document.querySelector('.main-area textarea')?.focus(), 0)
          }}>我有自己的想法，直接描述</button>
        </section>
      )}
      {notice && <button className="growth-notice" onClick={() => setNotice('')}>{notice}</button>}
    </>
  )
}
