import React from 'react'

export function Logo({ size = 32, withText = false, textSize = 14 }) {
  const dotSize = Math.round(size * 0.22)
  return (
    <div className="ts-logo" style={{ gap: Math.round(size * 0.18) }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        className="ts-logo-mark"
      >
        <defs>
          <linearGradient id="ts-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4285f4" />
            <stop offset="100%" stopColor="#1a73e8" />
          </linearGradient>
          <linearGradient id="ts-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea4335" />
            <stop offset="100%" stopColor="#d33b2c" />
          </linearGradient>
          <linearGradient id="ts-grad-3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbc05" />
            <stop offset="100%" stopColor="#f29900" />
          </linearGradient>
          <linearGradient id="ts-grad-4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34a853" />
            <stop offset="100%" stopColor="#1e8e3e" />
          </linearGradient>
          <linearGradient id="ts-grad-heart" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a73e8" />
            <stop offset="50%" stopColor="#7c4dff" />
            <stop offset="100%" stopColor="#ea4335" />
          </linearGradient>
        </defs>

        <circle cx="10" cy="10" r={dotSize} fill="url(#ts-grad-1)" />
        <circle cx="30" cy="10" r={dotSize} fill="url(#ts-grad-2)" />
        <circle cx="10" cy="30" r={dotSize} fill="url(#ts-grad-3)" />
        <circle cx="30" cy="30" r={dotSize} fill="url(#ts-grad-4)" />

        <text
          x="20"
          y="20"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'Brush Script MT', 'Pacifico', 'Comic Sans MS', cursive"
          fontSize="13"
          fontWeight="700"
          fill="url(#ts-grad-heart)"
        >
          ts
        </text>
      </svg>

      {withText && (
        <div className="ts-logo-text-wrap">
          <span className="ts-logo-text" style={{ fontSize: textSize }}>ts studio</span>
          <span className="ts-logo-heart" style={{ fontSize: Math.round(textSize * 0.95) }}>
            <svg width={textSize * 0.9} height={textSize * 0.9} viewBox="0 0 24 24" fill="url(#ts-grad-heart)">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </span>
        </div>
      )}
    </div>
  )
}

export function LogoAvatar({ size = 28 }) {
  return <Logo size={size} withText={false} />
}

export function LogoTitle() {
  return (
    <div className="ts-logo ts-logo-title">
      <span className="ts-logo-script">ts</span>
      <span className="ts-logo-divider" />
      <span className="ts-logo-script">studio</span>
    </div>
  )
}
