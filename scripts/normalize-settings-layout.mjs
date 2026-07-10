import { readFileSync, writeFileSync } from 'node:fs'

const modalPath = new URL('../src/SettingsModal.jsx', import.meta.url)
let source = readFileSync(modalPath, 'utf8')

function addPaneClass(tabName, className) {
  const marker = `{tab === '${tabName}' && (`
  const start = source.indexOf(marker)
  if (start < 0) throw new Error(`Could not locate ${tabName} tab`)
  const classStart = source.indexOf('className="', start)
  if (classStart < 0) throw new Error(`Could not locate ${tabName} pane class`)
  const valueStart = classStart + 'className="'.length
  const valueEnd = source.indexOf('"', valueStart)
  const current = source.slice(valueStart, valueEnd)
  if (!current.split(/\s+/).includes(className)) {
    source = source.slice(0, valueStart) + `${current} ${className}` + source.slice(valueEnd)
  }
}

addPaneClass('account', 'account-single-pane')
addPaneClass('prompts', 'prompt-single-pane')
writeFileSync(modalPath, source)

const cssPath = new URL('../src/ui-patch.css', import.meta.url)
let css = readFileSync(cssPath, 'utf8')
const marker = '/* Definitive single-pane settings layout */'
if (!css.includes(marker)) {
  css += `

${marker}
.modal-settings-split .account-single-pane,
.modal-settings-split .prompt-single-pane {
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  height: 100% !important;
  margin: 0 !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

.modal-settings-split .account-single-pane {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  padding: clamp(32px, 6vh, 64px) clamp(24px, 7vw, 88px) 48px !important;
}

.modal-settings-split .account-single-pane > * {
  width: min(100%, 680px) !important;
  max-width: 680px !important;
  flex: 0 0 auto !important;
}

.modal-settings-split .account-single-pane .account-actions {
  display: flex !important;
  justify-content: center !important;
}

.modal-settings-split .prompt-single-pane {
  display: block !important;
  padding: 36px clamp(24px, 7vw, 88px) 64px !important;
}

.modal-settings-split .prompt-single-pane > * {
  box-sizing: border-box !important;
  width: min(100%, 960px) !important;
  max-width: 960px !important;
  min-width: 0 !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.modal-settings-split .prompt-single-pane > * + * {
  margin-top: 20px !important;
}

.modal-settings-split .prompt-single-pane button {
  writing-mode: horizontal-tb !important;
  white-space: nowrap !important;
}

.modal-settings-split .prompt-single-pane textarea {
  display: block !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 140px !important;
  resize: vertical !important;
}

.modal-settings-split .prompt-single-pane [class*="variable"] {
  width: 100% !important;
  max-width: none !important;
}

@media (max-width: 900px) {
  .modal-settings-split .account-single-pane,
  .modal-settings-split .prompt-single-pane {
    padding: 24px 16px 40px !important;
  }
}
`
  writeFileSync(cssPath, css)
}

console.log('Account and prompt panes normalized')
