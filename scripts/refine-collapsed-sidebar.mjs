import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/ui-patch.css', import.meta.url)
let css = readFileSync(path, 'utf8')
const marker = '/* Refined collapsed sidebar and premium typography */'

if (!css.includes(marker)) {
  css += `

${marker}
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;650;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap');

:root {
  --app-font: "Manrope", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body,
button,
input,
textarea,
select {
  font-family: var(--app-font) !important;
  font-optical-sizing: auto;
}

body {
  letter-spacing: -0.008em;
}

.sidebar.collapsed {
  box-sizing: border-box;
  width: 72px !important;
  padding: 12px 10px 14px !important;
  align-items: center !important;
  gap: 4px !important;
  background: oklch(98.5% 0.006 255) !important;
  border-right: 1px solid oklch(91% 0.01 255) !important;
  box-shadow: none !important;
}

.sidebar.collapsed .icon-btn {
  position: relative;
  display: grid !important;
  place-items: center !important;
  width: 44px !important;
  height: 44px !important;
  min-width: 44px !important;
  min-height: 44px !important;
  padding: 0 !important;
  margin: 0 !important;
  border: 1px solid transparent !important;
  border-radius: 12px !important;
  color: oklch(31% 0.018 255) !important;
  background: transparent !important;
  box-shadow: none !important;
  transition: transform 140ms cubic-bezier(0.22, 1, 0.36, 1), color 120ms linear, background 120ms linear, border-color 120ms linear !important;
}

.sidebar.collapsed .icon-btn svg {
  width: 19px !important;
  height: 19px !important;
  stroke-width: 1.8 !important;
}

.sidebar.collapsed .icon-btn:hover {
  transform: translateY(-1px) !important;
  color: oklch(22% 0.022 255) !important;
  background: oklch(94.5% 0.01 255) !important;
  border-color: oklch(90% 0.014 255) !important;
}

.sidebar.collapsed .icon-btn:active {
  transform: scale(0.96) !important;
}

.sidebar.collapsed .icon-btn.active {
  color: oklch(24% 0.02 255) !important;
  background: oklch(92.5% 0.012 255) !important;
  border-color: oklch(88% 0.016 255) !important;
}

.sidebar.collapsed .sb-toggle {
  margin-bottom: 10px !important;
  color: oklch(42% 0.018 255) !important;
}

.sidebar.collapsed .sb-spacer {
  flex: 1 1 auto !important;
  min-height: 16px !important;
}

/* New chat is the only emphasized action, but keep it quiet and GPT-like. */
.sidebar.collapsed .icon-btn:nth-of-type(2) {
  margin-bottom: 8px !important;
  color: oklch(20% 0.02 255) !important;
  background: oklch(93.5% 0.012 255) !important;
  border-color: oklch(89% 0.014 255) !important;
}

/* Native-looking tooltip replaces the browser's abrupt title-only feel. */
.sidebar.collapsed .icon-btn::after {
  content: attr(title);
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  z-index: 80;
  transform: translateY(-50%) translateX(-4px);
  padding: 7px 10px;
  border-radius: 8px;
  color: oklch(97% 0.005 255);
  background: oklch(25% 0.018 255);
  font-size: 12px;
  font-weight: 550;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms linear, transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sidebar.collapsed .icon-btn:hover::after,
.sidebar.collapsed .icon-btn:focus-visible::after {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

.sidebar:not(.collapsed) .brand-text,
.sidebar:not(.collapsed) .palette-label,
.sidebar:not(.collapsed) .sb-item-label,
.mobile-title,
.modal-header h2 {
  letter-spacing: -0.018em;
}

@media (prefers-reduced-motion: reduce) {
  .sidebar.collapsed .icon-btn,
  .sidebar.collapsed .icon-btn::after { transition: none !important; }
}
`
  writeFileSync(path, css)
}

console.log('Collapsed sidebar and typography refined')
