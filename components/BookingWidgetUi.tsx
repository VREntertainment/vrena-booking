'use client'

import { Share } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

export function ShareSymbol() {
  return <Share aria-hidden="true" className="share-symbol-icon" size={26} strokeWidth={2.2} />
}

export function ButtonIconText({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <span className="button-icon-text">
      {icon}
      <span>{children}</span>
    </span>
  )
}

type LocalErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
  resetKey: string
}

type LocalErrorBoundaryState = {
  hasError: boolean
}

export class LocalErrorBoundary extends Component<LocalErrorBoundaryProps, LocalErrorBoundaryState> {
  state: LocalErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(previousProps: LocalErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(error, info)
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
