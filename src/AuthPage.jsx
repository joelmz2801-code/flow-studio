import React, { useState } from 'react'
import { supabase, isAuthEnabled } from './lib/supabase.js'

function translateAuthError(msg) {
  const lower = msg.toLowerCase()
  if (lower.includes('rate limit'))
    return '操作太频繁，请等待 1~2 分钟后重试。建议在 Supabase Dashboard → Authentication → Settings 中关闭 "Confirm email" 以避免频率限制。'
  if (lower.includes('invalid login credentials'))
    return '邮箱或密码错误'
  if (lower.includes('user already registered') || lower.includes('already been registered'))
    return '该邮箱已注册，请直接登录'
  if (lower.includes('password') && lower.includes('6'))
    return '密码至少需要 6 位'
  if (lower.includes('invalid email') || lower.includes('email is invalid'))
    return '请输入有效的邮箱地址'
  if (lower.includes('signup is disabled'))
    return '注册功能已关闭，请联系管理员'
  if (lower.includes('network') || lower.includes('fetch'))
    return '网络连接失败，请检查网络后重试'
  return msg || '操作失败，请稍后重试'
}

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!supabase) {
      setError('Supabase 未配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
      return
    }
    setLoading(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data?.user) {
          if (data.user.identities?.length === 0) {
            setError('该邮箱已注册，请直接登录')
            setMode('login')
          } else if (!data.session) {
            setInfo('注册成功！请检查邮箱确认链接后登录。')
            setMode('login')
          }
        }
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
        <p className="auth-subtitle">AI 创作工作台 · 登录后开始创作</p>

        {!isAuthEnabled && (
          <div className="auth-warning">
            <p>⚠️ Supabase 尚未配置</p>
            <p className="auth-warning-desc">
              请在项目根目录创建 <code>.env</code> 文件，添加以下变量后重启服务：
            </p>
            <pre className="auth-env-example">{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}</pre>
            <p className="auth-warning-desc">配置前可继续以访客身份使用。</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); setInfo('') }}
            >登录</button>
            <button
              type="button"
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); setInfo('') }}
            >注册</button>
          </div>

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
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}

          <button type="submit" className="auth-submit" disabled={loading || !isAuthEnabled}>
            {loading ? '处理中…' : mode === 'login' ? '登录' : '注册'}
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
