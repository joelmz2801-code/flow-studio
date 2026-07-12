import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from './store.js'
import './growth-experience.css'

const TASKS = [
  {
    id: 'product', label: '电商主图', kicker: '卖点更清楚', art: 'product', ratio: '1:1', style: '写实摄影',
    prompt: '为一款高端护肤精华制作电商主图：产品瓶居中悬浮，雾面玻璃渐变背景，柔和棚拍光，清晰材质细节，留出品牌文案空间，1:1 方图，无文字无水印。'
  },
  {
    id: 'social', label: '社媒封面', kicker: '一眼抓住注意力', art: 'social', ratio: '3:4', style: '编辑设计',
    prompt: '制作一张小红书风格的城市周末指南封面：明快编辑排版感，咖啡店与街景拼贴，奶油黄和钴蓝配色，年轻轻松，3:4 竖版，画面不要出现乱码文字。'
  },
  {
    id: 'poster', label: '品牌海报', kicker: '直接交付成片', art: 'poster', ratio: '2:3', style: '3D 渲染',
    prompt: '制作未来科技品牌发布会主视觉海报：半透明金属球体悬浮，深紫背景，克制的霓虹边缘光，强烈空间层次，2:3 竖版，预留标题区域，无文字无水印。'
  },
  {
    id: 'avatar', label: '头像', kicker: '稳定又有辨识度', art: 'avatar', ratio: '1:1', style: '动漫插画',
    prompt: '生成一张有辨识度的社交头像：自信的年轻创作者半身像，简洁轮廓，柔和侧光，细腻插画质感，背景干净，人物居中，1:1 方图。'
  },
  {
    id: 'wallpaper', label: '壁纸', kicker: '氛围感拉满', art: 'wallpaper', ratio: '16:9', style: '电影感',
    prompt: '生成宽屏桌面壁纸：雨后清晨的未来城市天台，远处云层被日光穿透，湿润地面反射微光，安静电影感，16:9，高清细节，无文字。'
  },
  {
    id: 'storyboard', label: '漫画分镜', kicker: '快速展开故事', art: 'storyboard', ratio: '16:9', style: '黑白漫画',
    prompt: '创作一页四格电影分镜：侦探在雨夜车站发现一只遗失的红色手提箱，镜头从全景推进到手部特写，黑白漫画线稿，仅手提箱保留红色，16:9 构图。'
  }
]

function track(name, data = {}) {
  try {
    const key = 'jfs-growth-events'
    const items = JSON.parse(localStorage.getItem(key) || '[]')
    items.push({ name, ...data, device: innerWidth <= 768 ? 'mobile' : 'desktop', at: Date.now() })
    localStorage.setItem(key, JSON.stringify(items.slice(-300)))
  } catch {}
  window.dispatchEvent(new CustomEvent('jfs:analytics', { detail: { name, ...data } }))
}

function pickImageModel() {
  const trigger = document.querySelector('button[title="选择生图模型"]')
  if (!trigger) return
  trigger.click()
  setTimeout(() => {
    const options = [...document.querySelectorAll('button')]
    const choice = options.find((button) => /agnes-image-2\.1-flash|agnes image 2\.1 flash/i.test(button.textContent || ''))
      || options.find((button) => /图片模型/.test(button.textContent || '') && !/选择模型/.test(button.textContent || ''))
    choice?.click()
  }, 100)
}

export default function GrowthExperience({ activeView }) {
  const chats = useStore((state) => state.chats)
  const usePrompt = useStore((state) => state.usePrompt)
  const [notice, setNotice] = useState('')
  const chat = chats.find((item) => item.id === activeView?.id)
  const messages = chat?.messages || []
  const isChat = activeView?.type !== 'flow'
  const empty = isChat && messages.length === 0

  const latest = useMemo(() => {
    let image = ''
    let prompt = ''
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i]
      if (!image && message.role === 'assistant') image = (message.images || []).find(Boolean) || ''
      if (!prompt && message.role === 'user') prompt = message.text || ''
      if (image && prompt) break
    }
    return { image, prompt }
  }, [messages])

  useEffect(() => {
    document.documentElement.classList.toggle('jfs-growth-empty', empty)
    return () => document.documentElement.classList.remove('jfs-growth-empty')
  }, [empty])

  useEffect(() => {
    if (latest.image) track('result_actions_viewed', { chatId: activeView?.id })
  }, [latest.image, activeView?.id])

  const applyTask = (task) => {
    localStorage.setItem('jfs-last-task', task.id)
    localStorage.setItem('jfs-model', 'agnes-image-2.1-flash')
    usePrompt(task.prompt)
    pickImageModel()
    track('task_template_applied', { task: task.id, ratio: task.ratio, style: task.style })
    setNotice(`已套用「${task.label}」，可以直接生成`)
  }

  const inject = (prompt, sendNow = false) => {
    usePrompt(prompt)
    pickImageModel()
    if (sendNow) {
      setTimeout(() => {
        const textarea = document.querySelector('.main-area textarea')
        textarea?.focus()
        textarea?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
      }, 220)
    }
  }

  const makeVariants = () => {
    inject(`${latest.prompt}\n\n基于同一主题生成四个明显不同但风格统一的版本，以四联画呈现；分别变化构图、光线、景别与细节，保持主体一致。`, true)
    track('result_variant_requested')
  }

  const refine = () => {
    inject(`${latest.prompt}\n\n请基于上一版继续微调：背景更干净，主体层次更明确，光线更高级，保留核心构图。`)
    track('result_refine_started')
    setNotice('微调指令已填好，改几个词就能继续')
  }

  const shareOrDownload = async () => {
    track('result_share_clicked')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Joel Flow Studio 作品', text: latest.prompt, url: latest.image })
        return
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
    }
    const link = document.createElement('a')
    link.href = latest.image
    link.download = `joel-flow-${Date.now()}.png`
    link.target = '_blank'
    link.rel = 'noopener'
    link.click()
    setNotice('作品已打开，可保存或分享')
  }

  if (!isChat) return null

  return (
    <>
      {empty && (
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
                <span className="growth-task-copy">
                  <strong>{task.label}</strong>
                  <small>{task.kicker}</small>
                  <span>{task.ratio} · {task.style}</span>
                </span>
                <b aria-hidden="true">↗</b>
              </button>
            ))}
          </div>
          <button className="growth-free" onClick={() => document.querySelector('.main-area textarea')?.focus()}>我有自己的想法，直接描述</button>
        </section>
      )}

      {!empty && latest.image && (
        <aside className="growth-result-actions" aria-label="生成后的下一步">
          <div className="growth-result-copy"><strong>这张图可以继续变好</strong><span>选下一步，不用重写提示词</span></div>
          <div className="growth-result-buttons">
            <button onClick={makeVariants}>再生成 4 个版本</button>
            <button onClick={refine}>基于这张图微调</button>
            <button className="growth-result-primary" onClick={shareOrDownload}>下载 / 分享</button>
          </div>
        </aside>
      )}

      {notice && <button className="growth-notice" onClick={() => setNotice('')}>{notice}</button>}
    </>
  )
}
