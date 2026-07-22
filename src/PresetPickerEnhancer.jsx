import { useEffect } from 'react'
import { useStore } from './store.js'

const BUILTIN_KEY = '__builtin__'
const ALL_KEY = '__all__'

function modelIdFromItem(item) {
  return item.querySelector('.chat-model-item-label')?.textContent?.trim() || ''
}

export default function PresetPickerEnhancer() {
  const presets = useStore((state) => state.presets)

  useEffect(() => {
    const presetModels = new Map()
    presets.forEach((preset) => {
      ;(preset.models || []).forEach((model) => {
        if (model.visible && model.id) presetModels.set(model.id, preset.id)
      })
    })

    const enhance = () => {
      const popover = document.querySelector('.popover-models')
      if (!popover) return

      let bar = popover.querySelector('.preset-filterbar')
      if (!bar) {
        bar = document.createElement('div')
        bar.className = 'preset-filterbar'
        const search = popover.querySelector('.model-search')
        search?.before(bar)
      }

      const active = bar.dataset.active || ALL_KEY
      bar.innerHTML = ''
      const head = document.createElement('div')
      head.className = 'preset-filter-head'
      head.innerHTML = '<span>模型来源</span><small>按预设快速筛选</small>'
      bar.appendChild(head)

      const options = [
        { key: ALL_KEY, label: '全部', count: document.querySelectorAll('.chat-model-item').length },
        { key: BUILTIN_KEY, label: '内置', count: [...document.querySelectorAll('.chat-model-item')].filter((item) => !presetModels.has(modelIdFromItem(item))).length },
        ...presets.filter((preset) => (preset.models || []).some((model) => model.visible)).map((preset) => ({
          key: preset.id,
          label: preset.name || '未命名预设',
          count: (preset.models || []).filter((model) => model.visible).length,
        })),
      ]

      const applyFilter = (key) => {
        bar.dataset.active = key
        bar.querySelectorAll('.preset-filter-chip').forEach((chip) => chip.classList.toggle('is-active', chip.dataset.key === key))
        document.querySelectorAll('.chat-model-item').forEach((item) => {
          const id = modelIdFromItem(item)
          const belongs = key === ALL_KEY || (key === BUILTIN_KEY ? !presetModels.has(id) : presetModels.get(id) === key)
          item.style.display = belongs ? '' : 'none'
        })
      }

      options.forEach((option) => {
        const chip = document.createElement('button')
        chip.type = 'button'
        chip.className = 'preset-filter-chip'
        chip.dataset.key = option.key
        chip.innerHTML = `<span>${option.label}</span><b>${option.count}</b>`
        chip.addEventListener('click', () => applyFilter(option.key))
        bar.appendChild(chip)
      })
      applyFilter(active)
    }

    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true })
    enhance()
    return () => observer.disconnect()
  }, [presets])

  return null
}
