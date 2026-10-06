import React, { Component, ErrorInfo, ReactNode } from 'react';

export class ErrorBoundary extends Component<{children: ReactNode, fallback?: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: '20px', background: 'red', color: 'white', height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
          <h2>Something went wrong.</h2>
          <pre style={{whiteSpace: 'pre-wrap'}}>{this.state.error?.toString()}</pre>
          <pre style={{whiteSpace: 'pre-wrap', marginTop: 10}}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
