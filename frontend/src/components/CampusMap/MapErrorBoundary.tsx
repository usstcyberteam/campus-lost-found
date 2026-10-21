import { Component, type ErrorInfo, type ReactNode } from 'react'
import Button from '../ui/Button'
import styles from './MapErrorBoundary.module.css'

interface MapErrorBoundaryProps {
  children: ReactNode
}

interface MapErrorBoundaryState {
  hasError: boolean
}

export default class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('地图渲染出错', error, info.componentStack)
  }

  private retry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.fallback} role="alert">
          <p className={styles.title}>地图加载出错</p>
          <p className={styles.description}>请重试，或切换视图后再回来。</p>
          <Button type="button" onClick={this.retry}>
            重试
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}