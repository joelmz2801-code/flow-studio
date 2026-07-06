import React, { memo } from 'react'

// 简化的"ts studio"logo: 透明背景 + 手写体文字 + 可选心形
// 不再使用 4 个圆点；所有元素使用 CSS gradient 文本，无 SVG 渐变定义
// 使用 React.memo 防止父组件 re-render 时重复渲染（修复对话框中头像卡顿）
function LogoBase({
  size = 32,
  withText = false,
  textSize,
  withHeart = true,
  showMark = true,
}) {
  const studioSize = textSize || Math.round(size * 0.55)
  const heartSize = withHeart
    ? Math.round((withText ? studioSize : size) * 0.9)
    : 0
  const wrapGap = withText ? Math.round(size * 0.2) : 0

  return (
    <span
      className="ts-logo"
      style={{ gap: wrapGap }}
      aria-label="ts studio"
    >
      {showMark && (
        <span className="ts-logo-mark" style={{ fontSize: size, lineHeight: 1 }}>
          ts
        </span>
      )}
      {withText && (
        <span
          className="ts-logo-text-wrap"
          style={{ fontSize: studioSize, lineHeight: 1, gap: 4 }}
        >
          <span className="ts-logo-text" style={{ fontSize: studioSize }}>
            studio
          </span>
          {withHeart && (
            <svg
              className="ts-logo-heart"
              width={heartSize}
              height={heartSize}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill="currentColor"
              />
            </svg>
          )}
        </span>
      )}
    </span>
  )
}

// React.memo 防止在 ChatPage 大量消息 re-render 时重复创建 logo
export const Logo = memo(LogoBase)
export const LogoAvatar = memo(function LogoAvatar({ size = 28 }) {
  return <LogoBase size={size} withText={false} />
})
export const LogoTitle = memo(function LogoTitle() {
  return (
    <span className="ts-logo ts-logo-title">
      <span className="ts-logo-script">ts</span>
      <span className="ts-logo-divider" />
      <span className="ts-logo-script">studio</span>
    </span>
  )
})
