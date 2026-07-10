import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/ui-patch.css', import.meta.url)
let css = readFileSync(path, 'utf8')
const marker = '/* Premium sidebar navigation */'

if (!css.includes(marker)) {
  css += `

${marker}
.sidebar {
  --sb-ink: oklch(25% 0.018 265);
  --sb-muted: oklch(52% 0.018 265);
  --sb-line: oklch(91% 0.010 265);
  --sb-surface: oklch(98.7% 0.006 265);
  --sb-hover: oklch(95.5% 0.012 265);
  --sb-active: oklch(93.5% 0.022 265);
  width: 272px;
  padding: 14px 12px 16px;
  color: var(--sb-ink);
  background: var(--sb-surface);
  border-right: 1px solid var(--sb-line);
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
  font-optical-sizing: auto;
}

.sidebar .brand {
  min-height: 44px;
  margin: 0 2px 16px;
  padding: 0 8px;
  gap: 10px;
}
.sidebar .brand-text p {
  margin: 0;
  color: var(--sb-ink);
  font-size: 15px;
  line-height: 1.3;
  font-weight: 680;
  letter-spacing: -0.018em;
}
.sidebar .brand .ts-logo {
  width: 27px !important;
  height: 27px !important;
}
.sidebar .sb-toggle {
  width: 34px;
  height: 34px;
  margin-left: auto;
  border-radius: 9px;
  color: var(--sb-muted);
}
.sidebar .sb-toggle:hover { color: var(--sb-ink); background: var(--sb-hover); }

.sidebar .new-chat-btn {
  min-height: 44px;
  margin: 0 2px 14px;
  padding: 0 13px;
  justify-content: flex-start;
  gap: 11px;
  color: var(--sb-ink);
  background: transparent;
  border: 1px solid var(--sb-line);
  border-radius: 11px;
  box-shadow: none;
  font-size: 13px;
  font-weight: 620;
  letter-spacing: -0.005em;
}
.sidebar .new-chat-btn:hover {
  transform: none;
  color: var(--sb-ink);
  background: var(--sb-hover);
  border-color: oklch(84% 0.018 265);
  box-shadow: none;
}
.sidebar .new-chat-btn svg { width: 18px; height: 18px; stroke-width: 1.8; }

.sidebar .search-box {
  min-height: 42px;
  margin: 0 2px 18px;
  padding: 0 12px;
  gap: 10px;
  color: var(--sb-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
}
.sidebar .search-box:hover { background: var(--sb-hover); }
.sidebar .search-box:focus-within {
  background: oklch(99.2% 0.004 265);
  border-color: oklch(80% 0.035 265);
  box-shadow: 0 0 0 3px oklch(55% 0.12 265 / 0.10);
}
.sidebar .search-box input {
  font: inherit;
  font-size: 13px;
  font-weight: 450;
  color: var(--sb-ink);
}

.sidebar .sb-section { margin-bottom: 18px; }
.sidebar .sb-section-title {
  margin: 0 10px 7px;
  color: oklch(58% 0.015 265);
  font-size: 10px;
  line-height: 1.4;
  font-weight: 650;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.sidebar .sb-item {
  min-height: 40px;
  padding: 0 10px;
  gap: 11px;
  border-radius: 9px;
  color: var(--sb-ink);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 470;
  letter-spacing: -0.006em;
}
.sidebar .sb-item:hover { background: var(--sb-hover); }
.sidebar .sb-item.active {
  color: var(--sb-ink);
  background: var(--sb-active);
  font-weight: 620;
}
.sidebar .sb-item-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  flex: 0 0 20px;
  color: currentColor;
}
.sidebar .sb-item-icon svg {
  width: 18px;
  height: 18px;
  stroke-width: 1.65;
}
.sidebar .sb-item-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar .sb-item-badge {
  margin-left: auto;
  padding: 2px 7px;
  color: var(--sb-muted);
  background: oklch(93% 0.012 265);
  border-radius: 999px;
  font-size: 9px;
  font-weight: 650;
  letter-spacing: 0.04em;
}
.sidebar .sb-item-del {
  width: 28px;
  height: 28px;
  margin-left: auto;
  display: grid;
  place-items: center;
  border-radius: 7px;
  opacity: 0;
  color: var(--sb-muted);
}
.sidebar .sb-item:hover .sb-item-del { opacity: 1; }
.sidebar .sb-item-del:hover { color: var(--sb-ink); background: oklch(91% 0.012 265); }

.sidebar .sb-foot {
  padding-top: 10px;
  border-top: 1px solid var(--sb-line);
}
.sidebar .sb-user {
  margin-top: 8px;
  padding: 8px 6px 0;
  border-top: 1px solid var(--sb-line);
}
.sidebar .sb-user-avatar {
  background: var(--sb-ink);
  color: var(--sb-surface);
  box-shadow: none;
}
.sidebar .sb-user-email { font-size: 11px; color: var(--sb-muted); }

/* Compact rail, inspired by GPT's restraint without copying its branding. */
.sidebar.collapsed {
  width: 64px;
  padding: 12px 8px 14px;
  align-items: center;
  gap: 8px;
  background: var(--sb-surface);
}
.sidebar.collapsed .icon-btn,
.sidebar.collapsed .sb-toggle {
  width: 44px;
  height: 44px;
  padding: 0;
  display: grid;
  place-items: center;
  color: var(--sb-ink);
  background: transparent;
  border: 0;
  border-radius: 10px;
  box-shadow: none;
}
.sidebar.collapsed .icon-btn:hover,
.sidebar.collapsed .sb-toggle:hover { color: var(--sb-ink); background: var(--sb-hover); }
.sidebar.collapsed .icon-btn.active { color: var(--sb-ink); background: var(--sb-active); }
.sidebar.collapsed .icon-btn svg,
.sidebar.collapsed .sb-toggle svg {
  width: 21px;
  height: 21px;
  stroke-width: 1.65;
}
.sidebar.collapsed .sb-toggle {
  margin: 0 0 10px;
  position: relative;
}
.sidebar.collapsed .sb-toggle::after {
  content: "J";
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--sb-ink);
  background: var(--sb-surface);
  border: 1px solid var(--sb-line);
  border-radius: 11px;
  font-size: 16px;
  line-height: 1;
  font-weight: 720;
  letter-spacing: -0.04em;
}
.sidebar.collapsed .sb-toggle:hover::after { background: var(--sb-hover); }
.sidebar.collapsed .sb-spacer { flex: 1; }

@media (max-width: 768px) {
  .sidebar { width: min(292px, 88vw); padding-top: 12px; }
}
`
  writeFileSync(path, css)
}

console.log('Premium sidebar styles ready')
