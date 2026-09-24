import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface State {
  error: Error | null
}

/** 统一错误边界：捕获渲染错误并给出恢复入口。 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary 捕获错误：', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
            <h1 className="text-base font-semibold text-foreground">页面出现错误</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              发生了一个未预期的错误，你可以尝试重新加载页面。
            </p>
            <p className="mt-2 break-all text-xs text-danger/80">
              {this.state.error.message}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
                重新加载
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => this.setState({ error: null })}
              >
                继续使用
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
