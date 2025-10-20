import React from 'react';
import { AppError, ErrorSeverity, logError } from '../utils/error-handler';

type Props = { children: React.ReactNode };
type State = { error?: Error; info?: { componentStack: string } };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info: { componentStack: info.componentStack || '' } });

    // Log error with centralized handler
    const appError = error instanceof AppError ? error : new AppError(
      error.message,
      'REACT_ERROR',
      ErrorSeverity.ERROR,
      {
        component: 'ErrorBoundary',
        componentStack: info.componentStack || undefined
      },
      error
    );

    logError(appError);

    // Also write to local file for debugging
    try {
      require('fs').appendFileSync('csli-errors.log', `[${new Date().toISOString()}] ${error.stack || error}\n${info.componentStack}\n\n`);
    } catch {}
  }

  render() {
    if (!this.state.error) return this.props.children;
    const stack = (this.state.error.stack || String(this.state.error));
    const comp = this.state.info?.componentStack || '';
    return (
      // Works under react-blessed: a simple <box> with scrollable text
      // No styles to avoid unknown blessed options in some versions
      // Users can quit with 'q' (bound in index.tsx)
      // or continue using other panes.
      // Intentionally minimal.
      // @ts-ignore - blessed typings may not exist in your env
      <box
        label=" ErrorBoundary "
        border={{ type: 'line' }}
        padding={{ left: 1, right: 1, top: 0, bottom: 0 }}
        scrollable={true}
        keys={true}
        mouse={true}
        vi={true}
        alwaysScroll={true}
        scrollbar={{ ch: ' ' }}
      >
        App pane crashed.
        {'\n\n'}Error:{'\n'}{stack}
        {'\n\n'}Component Stack:{'\n'}{comp}
      </box>
    );
  }
}