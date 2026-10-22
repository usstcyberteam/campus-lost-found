import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// 兜底错误边界：任一子组件抛错时展示可恢复的提示，而不是让 React 卸载整棵树导致整页白屏
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('页面渲染出错：', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: 24 }}>
          <h1>页面出错了</h1>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}