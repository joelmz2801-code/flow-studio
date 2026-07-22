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
  ['从一句话开始', '直接描述想做的画面、故事或方向，先聊天，再决定要不要生成。'],
  ['文字、图片、视频放在一起', '在同一个对话里切换模型、画幅、风格和参考图，不用来回搬运素材。'],
  ['你的工作随时接着做', '对话、提示词和自定义模型设置会随账户同步，换设备也不用重来。'],
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
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
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
        <h1 id="product-title">少切几个工具，<br />多完成一个作品</h1>
        <p className="public-lede">Joel Flow Studio 是一个以对话为入口的 AI 创作工作台。先把想法说清楚，再用图片、视频和提示词把它做出来。</p>
        <div className="public-features">
          {FEATURES.map(([title, text], index) => (
            <article className="public-feature" key={title}>
              <span aria-hidden="true">0{index + 1}</span>
              <div><h2>{title}</h2><p>{text}</p></div>
            </article>
          ))}
        </div>
        <p className="public-trust">登录只用于保护你的工作内容和同步设置，不会改变现有账户数据。</p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card auth-card-v2">
          <p className="auth-eyebrow">你的创作空间</p>
          <h2 id="auth-title">{mode === 'signin' ? '继续创作' : '创建免费账户'}</h2>
          <p className="auth-subtitle">{mode === 'signin' ? '登录后继续你的对话和生成记录。' : '注册后即可保存提示词、模型设置和作品记录。'}</p>
          <div className="auth-tabs" role="tablist" aria-label="账户操作">
            <button type="button" role="tab" aria-selected={mode === 'signin'} className={`auth-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => switchMode('signin')}>登录</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => switchMode('signup')}>注册</button>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field"><span>邮箱</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
            <label className="auth-field"><span>密码</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            {info && <div className="auth-info" role="status">{info}</div>}
            <button type="submit" className="auth-submit" disabled={loading || !isAuthEnabled}>{loading ? '处理中…' : mode === 'signin' ? '进入工作台' : '创建账户'}</button>
          </form>
          {mode === 'signin' && <button type="button" className="auth-reset" onClick={handleResetPassword} disabled={loading}>忘记密码？发送重置链接</button>}
          <div className="auth-divider"><span>也可以</span></div>
          <button type="button" className="auth-oauth-btn" onClick={handleGithubLogin} disabled={loading || !isAuthEnabled}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-.135-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
            使用 GitHub 登录
          </button>
        </div>
      </section>
    </main>
  )
}
