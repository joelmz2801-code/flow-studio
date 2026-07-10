import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/ui-patch.css', import.meta.url)
let css = readFileSync(path, 'utf8')
const marker = '/* Consistent windowed settings for every tab */'

if (!css.includes(marker)) {
  css += `

${marker}
/* The modal shell never changes size between tabs. Account and prompts only
   fill the modal content viewport, not the browser viewport. */
.modal-mask:has(.modal-settings-split) {
  padding: 24px !important;
  align-items: center !important;
  justify-content: center !important;
  background: oklch(27% 0.024 275 / 0.30) !important;
}

.modal-settings-split,
.modal-settings-split:has(.account-single-pane),
.modal-settings-split:has(.prompt-single-pane) {
  width: min(1240px, calc(100vw - 48px)) !important;
  height: min(900px, calc(100dvh - 48px)) !important;
  max-width: 1240px !important;
  max-height: 900px !important;
  margin: 0 !important;
  border: 1px solid var(--settings-line) !important;
  border-radius: 22px !important;
  box-shadow: 0 24px 72px oklch(27% 0.024 275 / 0.16) !important;
  overflow: hidden !important;
}

/* Account and prompts consume the complete viewport below the tabs. */
.modal-settings-split .modal-body:has(> .settings-pane) {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
}

.modal-settings-split .modal-body:has(> .settings-pane) > .settings-pane {
  box-sizing: border-box !important;
  display: block !important;
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  height: 100% !important;
  margin: 0 !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

.modal-settings-split .modal-body:has(> .account-pane) > .account-pane {
  padding: 40px max(24px, calc((100% - 680px) / 2)) 64px !important;
}

.modal-settings-split .modal-body:has(> .settings-pane:not(.account-pane)) > .settings-pane {
  padding: 40px max(24px, calc((100% - 960px) / 2)) 64px !important;
}

.modal-settings-split .modal-body:has(> .account-pane) > .account-pane > * {
  width: 100% !important;
  max-width: 680px !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.modal-settings-split .modal-body:has(> .settings-pane:not(.account-pane)) > .settings-pane > * {
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: 960px !important;
  min-width: 0 !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

@media (max-width: 900px) {
  .modal-mask:has(.modal-settings-split) { padding: 0 !important; }
  .modal-settings-split,
  .modal-settings-split:has(.account-single-pane),
  .modal-settings-split:has(.prompt-single-pane) {
    width: 100vw !important;
    height: 100dvh !important;
    max-width: 100vw !important;
    max-height: 100dvh !important;
    border: 0 !important;
    border-radius: 0 !important;
  }
  .modal-settings-split .modal-body:has(> .settings-pane) > .settings-pane {
    padding: 24px 16px 48px !important;
  }
}
`
  writeFileSync(path, css)
}

console.log('All settings tabs now share one consistent window')
