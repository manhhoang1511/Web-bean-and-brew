import { Component, type ReactNode } from 'react'

/** Bắt lỗi render để không làm trắng cả trang */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-5xl">☕💥</p>
        <h1 className="text-xl font-bold">Đã có lỗi xảy ra</h1>
        <p className="max-w-md text-sm text-coffee-500">{this.state.error.message}</p>
        <button className="btn-primary" onClick={() => { this.setState({ error: null }); window.location.href = '/' }}>
          Về trang chủ
        </button>
      </div>
    )
  }
}
