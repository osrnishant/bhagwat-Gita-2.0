import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    if (!import.meta.env.PROD) {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
          <div className="text-center">
            <p className="font-serif text-xl text-cream mb-2">Something went wrong.</p>
            <p className="text-muted text-sm mb-6">Please refresh and try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="py-3 px-6 bg-gold text-white rounded-full text-sm font-medium hover:bg-gold-dim transition-all"
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
