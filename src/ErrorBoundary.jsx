import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[app] 未捕获的界面错误', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="fatal-state" role="alert">
        <div>
          <p>FLOW STUDIO</p>
          <h1>页面暂时出了点问题</h1>
          <span>你的云端数据没有被删除。刷新页面即可重新连接。</span>
          <button type="button" onClick={() => window.location.reload()}>刷新页面</button>
        </div>
      </main>
    )
  }
}
