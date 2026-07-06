import React, { memo } from 'react'

// 直接使用您提供的"Joel Flow Studio"手写 logo 图片
// 图片需放在 public/logo.png（public 目录会被 Vite 原样部署）
const LOGO_SRC = '/logo.png'

function LogoBase({
  size = 32,
  withText = false, // 保留参数以兼容旧调用，但已无意义（文字在图片里）
  textSize,
  withHeart = true, // 兼容参数
  showMark = true,
  className = '',
}) {
  // 用户原图是横向的（1.25:1 左右），height 设 size，width 自动
  return (
    <img
      src={LOGO_SRC}
      alt="Joel Flow Studio"
      className={`ts-logo ${className}`}
      style={{
        height: size,
        width: 'auto',
        display: 'block',
        objectFit: 'contain',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
      draggable={false}
    />
  )
}

export const Logo = memo(LogoBase)
export const LogoAvatar = memo(function LogoAvatar({ size = 28 }) {
  return <LogoBase size={size} />
})
export const LogoTitle = memo(function LogoTitle({ size = 32 }) {
  return <LogoBase size={size} />
})
