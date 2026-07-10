import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/ui-patch.css', import.meta.url)
let css = readFileSync(path, 'utf8')
const marker = '/* Remove API grid leakage from account and prompt tabs */'

if (!css.includes(marker)) {
  css += `

${marker}
/* API uses a 280px + content grid. Account and prompts render one .settings-pane,
   so force their parent back to a normal full-width block. */
.modal-settings-split .modal-body:has(> .settings-pane) {
  display: block !important;
  grid-template-columns: none !important;
  width: 100% !important;
  min-width: 0 !important;
  overflow: hidden !important;
}

.modal-settings-split .modal-body:has(> .settings-pane) > .settings-pane {
  display: block !important;
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 40px 24px 64px !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

.modal-settings-split .modal-body:has(> .account-pane) > .account-pane {
  width: 100% !important;
  max-width: none !important;
  padding-left: max(24px, calc((100% - 680px) / 2)) !important;
  padding-right: max(24px, calc((100% - 680px) / 2)) !important;
}

.modal-settings-split .modal-body:has(> .account-pane) > .account-pane > * {
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: 680px !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.modal-settings-split .modal-body:has(> .settings-pane:not(.account-pane)) > .settings-pane {
  padding-left: max(24px, calc((100% - 960px) / 2)) !important;
  padding-right: max(24px, calc((100% - 960px) / 2)) !important;
}

.modal-settings-split .modal-body:has(> .settings-pane:not(.account-pane)) > .settings-pane > * {
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: 960px !important;
  min-width: 0 !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

@media (max-width: 720px) {
  .modal-settings-split .modal-body:has(> .settings-pane) > .settings-pane {
    padding: 24px 16px 48px !important;
  }
}
`
  writeFileSync(path, css)
}

console.log('Single-pane settings no longer inherit the API grid')
