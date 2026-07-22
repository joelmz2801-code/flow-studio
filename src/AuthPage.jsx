import React, { useState } from 'react'
import { supabase, isAuthEnabled } from './lib/supabase.js'
import { Logo } from './components/Logo.jsx'

function translateAuthError(message = '') {
  const lower = message.toLowerCase()
  if (lower.includes('rate limit')) return '操作太频繁，请稍后再试'
  if (lower.includes('password') && lower.includes('6')) return '密码至少需要 6 位'
  if (lower.includes('invalid email') || lower.includes('email is invalid')) return '请输入有效的邮箱地址'
  if (lower.includes('signup is disabled')) return '注册功能暂未开放'
  if (lower.includes('network') || lower.includes('fetch')) return '网络连接失败，请检查网络后重试'
  if (lower.includes('email not confirmed')) return '邮箱尚未验证，请检查收件箱'
  if (lower.includes('invalid login credentials')) return '邮箱或密码不正确'
  if (lower.includes('user already registered')) return '该邮箱已注册，请直接登录'
  return message || '操作失败，请稍后重试'
}

const FEATURES = [
  ['节点式工作流', '把对话、图片与视频模型串成可重复执行的创作流程。'],
  ['自带模型，也支持 BYOK', '使用内置通道，或连接兼容 OpenAI 格式的服务。'],
  ['跨设备同步', '工作流、对话与提示词保存在你的账户中。'],
]

export default function AuthPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setInfo('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!supabase) return setError('登录服务暂未配置')

    setLoading(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
      } else {
        const { data, error: authError } = await supabase.auth.signUp({ email, password })
        if (authError) throw authError
        if (!data.session) setInfo('注册成功，请打开验证邮件后再登录。')
      }
    } catch (err) {
      setError(translateAuthError(err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleGithubLogin = async () => {
    if (!supabase) return setError('登录服务暂未配置')
    setLoading(true)
    setError('')
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin },
      })
      if (authError) throw authError
    } catch (err) {
      setError(translateAuthError(err.message))
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!supabase) return setError('登录服务暂未配置')
    if (!email) return setError('先填写邮箱，我们才能发送重置链接')
    setLoading(true)
    setError('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (resetError) throw resetError
      setInfo('重置链接已发送，请检查邮箱。')
    } catch (err) {
      setError(translateAuthError(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="public-shell">
      <section className="public-story" aria-labelledby="product-title">
        <div className="public-brand"><Logo size={46} withText textSize={24} /></div>
        <p className="public-kicker">AI CREATION WORKSPACE</p>
        <h1 id="product-title">把灵感连成一条<br />真正能运行的工作流</h1>
        <p className="public-lede">Joel Flow Studio 把 AI 对话、生图与视频生成放进同一个可视化工作台。少切工具，多完成作品。</p>
        <div className="public-features">
          {FEATURES.map(([title, text], index) => (
            <article className="public-feature" key={title}>
              <span aria-hidden="true">0{index + 1}</span>
              <div><h2>{title}</h2><p>{text}</p></div>
            </article>
          ))}
        </div>
        <p className="public-trust">你的账户数据由 Supabase 身份验证和行级权限保护。</p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card auth-card-v2">
          <p className="auth-eyebrow">欢迎来到工作台</p>
          <h2 id="auth-title">{mode === 'signin' ? '继续你的创作' : '创建免费账户'}</h2>
          <p className="auth-subtitle">{mode === 'signin' ? '登录后同步对话、提示词和 API 预设。' : '注册不会覆盖任何现有数据库内容。'}</p>

          <div className="auth-tabs" role="tablist" aria-label="账户操作">
            <button type="button" role="tab" aria-selected={mode === 'signin'} className={`auth-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => switchMode('signin')}>登录</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => switchMode('signup')}>注册</button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field"><span>邮箱</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
            <label className="auth-field"><span>密码</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            {info && <div className="auth-info" role="status">{info}</div>}
            <button type="submit" className="auth-submit" disabled={loading || !isAuthEnabled}>{loading ? '处理中…' : mode === 'signin' ? '登录工作台' : '创建账户'}</button>
          </form>

          {mode === 'signin' && <button type="button" className="auth-reset" onClick={handleResetPassword} disabled={loading}>忘记密码？发送重置链接</button>}
          <div className="auth-divider"><span>或</span></div>
          <button type="button" className="auth-oauth-btn" onClick={handleGithubLogin} disabled={loading || !isAuthEnabled}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
            使用 GitHub 登录
          </button>
        </div>
      </section>
    </main>
  )
}
