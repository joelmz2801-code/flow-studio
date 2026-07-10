import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/ui-patch.css', import.meta.url)
let css = readFileSync(path, 'utf8')
const marker = '/* True fullscreen account and prompt settings */'

if (!css.includes(marker)) {
  css += `

${marker}
/* These tabs are standalone pages. Remove the split-pane geometry entirely. */
.modal-settings-split:has(.account-single-pane),
.modal-settings-split:has(.prompt-single-pane) {
  width: 100vw !important;
  height: 100dvh !important;
  max-width: 100vw !important;
  max-height: 100dvh !important;
  margin: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.modal-mask:has(.account-single-pane),
.modal-mask:has(.prompt-single-pane) {
  padding: 0 !important;
  align-items: stretch !important;
  justify-content: stretch !important;
  background: var(--settings-canvas, oklch(97.5% 0.008 275)) !important;
}

.modal-settings-split:has(.account-single-pane) .settings-pane,
.modal-settings-split:has(.prompt-single-pane) .settings-pane {
  display: block !important;
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

.modal-settings-split:has(.account-single-pane) .settings-pane > .account-single-pane,
.modal-settings-split:has(.prompt-single-pane) .settings-pane > .prompt-single-pane,
.modal-settings-split:has(.account-single-pane) .account-single-pane,
.modal-settings-split:has(.prompt-single-pane) .prompt-single-pane {
  box-sizing: border-box !important;
  width: min(100% - 48px, 960px) !important;
  max-width: 960px !important;
  min-width: 0 !important;
  margin: 0 auto !important;
  padding: 48px 0 72px !important;
  float: none !important;
}

.modal-settings-split:has(.account-single-pane) .account-single-pane {
  width: min(100% - 48px, 680px) !important;
  max-width: 680px !important;
}

.modal-settings-split:has(.prompt-single-pane) .prompt-single-pane,
.modal-settings-split:has(.prompt-single-pane) .prompt-single-pane * {
  writing-mode: horizontal-tb !important;
}

.modal-settings-split:has(.prompt-single-pane) .prompt-single-pane > * {
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
}

.modal-settings-split:has(.prompt-single-pane) .prompt-single-pane button {
  width: auto !important;
  max-width: 100% !important;
  white-space: nowrap !important;
}

.modal-settings-split:has(.prompt-single-pane) .prompt-single-pane textarea {
  display: block !important;
  width: 100% !important;
  min-height: 152px !important;
}

@media (max-width: 720px) {
  .modal-settings-split:has(.account-single-pane) .account-single-pane,
  .modal-settings-split:has(.prompt-single-pane) .prompt-single-pane {
    width: calc(100% - 32px) !important;
    padding: 28px 0 48px !important;
  }
}
`
  writeFileSync(path, css)
}

console.log('Account and prompt settings are true fullscreen panes')
