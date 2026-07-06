import React, { useState } from 'react'
import { supabase, isAuthEnabled } from './lib/supabase.js'

function translateAuthError(msg) {
  const lower = msg.toLowerCase()
  if (lower.includes('rate limit'))
    return '操作太频繁，请等待 1~2 分钟后重试'
  if (lower.includes('password') && lower.includes('6'))
    return '密码至少需要 6 位'
  if (lower.includes('invalid email') || lower.includes('email is invalid'))
    return '请输入有效的邮箱地址'
  if (lower.includes('signup is disabled'))
    return '注册功能已关闭，请联系管理员'
  if (lower.includes('network') || lower.includes('fetch'))
    return '网络连接失败，请检查网络后重试'
  if (lower.includes('email not confirmed'))
    return '邮箱未验证，请检查收件箱中的确认邮件'
  return msg || '操作失败，请稍后重试'
}

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!supabase) {
      setError('Supabase 未配置')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (!signInError) return

      const msg = (signInError.message || '').toLowerCase()
      if (msg.includes('invalid login credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
      } else {
        throw signInError
      }
    } catch (err) {
      setError(translateAuthError(err.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const handleGithubLogin = async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    try {
      await supabase.auth.signInWithOAuth({ provider: 'github' })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="dot dot-b" /><span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
        </div>
        <h1 className="auth-title">Joel Flow Studio</h1>
        <p className="auth-subtitle">AI 创作工作台 · 输入邮箱和密码进入</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            <span>邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="auth-field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              required
              minLength={6}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading || !isAuthEnabled}>
            {loading ? '处理中…' : '进入'}
          </button>
        </form>

        <div className="auth-divider"><span>或</span></div>

        <button className="auth-oauth-btn" onClick={handleGithubLogin} disabled={loading || !isAuthEnabled}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          使用 GitHub 登录
        </button>
      </div>
    </div>
  )
}
