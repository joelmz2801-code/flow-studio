import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/ui-patch.css', import.meta.url)
let css = readFileSync(path, 'utf8')
const marker = '/* Settings content balance fix */'

if (!css.includes(marker)) {
  css += `

${marker}
/* Account has no secondary pane. Center the complete profile composition. */
.modal-settings-split .settings-pane:has(.account-hero) {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: clamp(32px, 6vh, 64px) clamp(24px, 6vw, 72px) 48px;
  display: grid;
  justify-items: center;
  align-content: start;
  overflow-y: auto;
}

.modal-settings-split .settings-pane:has(.account-hero) > * {
  width: min(100%, 640px);
}

.modal-settings-split .account-hero {
  min-height: 112px;
  margin-bottom: 20px;
  padding: 22px 24px;
  border: 1px solid var(--settings-line);
  border-radius: 16px;
  background: var(--settings-surface);
  box-shadow: 0 10px 30px oklch(27% 0.024 275 / 0.055);
}

.modal-settings-split .account-detail-list {
  margin-bottom: 24px;
  border-color: var(--settings-line);
  border-radius: 14px;
  background: var(--settings-surface);
}

.modal-settings-split .account-detail-row {
  min-height: 56px;
  padding: 14px 18px;
  border-color: var(--settings-line);
}

.modal-settings-split .account-actions {
  justify-content: center;
}

/* Prompt management is a single reading column, not a fake split view. */
.modal-settings-split .settings-pane:has(textarea) {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 32px clamp(24px, 6vw, 72px) 56px;
  overflow-y: auto;
}

.modal-settings-split .settings-pane:has(textarea) > * {
  width: min(100%, 920px);
  margin-inline: auto;
}

.modal-settings-split .settings-pane:has(textarea) textarea {
  min-height: 132px;
  line-height: 1.65;
}

@media (max-width: 900px) {
  .modal-settings-split .settings-pane:has(.account-hero),
  .modal-settings-split .settings-pane:has(textarea) {
    padding: 24px 16px 40px;
  }
  .modal-settings-split .account-hero {
    min-height: 96px;
    padding: 18px;
  }
}
`
  writeFileSync(path, css)
}

console.log('Settings content layouts balanced')
