/**
 * Comprehensive ErrorBoundary component with error reporting and recovery
 * Handles both expected and unexpected errors with proper logging
 */

import { Component, ReactNode, ErrorInfo } from 'react';
import { isDevelopment } from '../utils/env';
import { logger } from '../../app/shared/utils/logger';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'widget';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

// Error reporting service
class ErrorReporter {
  static reportError(error: Error, errorInfo: ErrorInfo, level: string = 'component'): string {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorReport = {
      id: errorId,
      timestamp: new Date().toISOString(),
      level,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: sessionStorage.getItem('auth_user') ? 
        JSON.parse(sessionStorage.getItem('auth_user') || '{}').id : 'anonymous'
    };

    // Log error report
    if (isDevelopment()) {
      logger.error('🚨 ErrorBoundary Report:', errorReport);
    } else {
      logger.error('ErrorBoundary caught error', { errorId, message: error.message, level });
    }

    // Store error locally for debugging
    try {
      const storedErrors = JSON.parse(localStorage.getItem('mindflow_errors') || '[]');
      storedErrors.push(errorReport);
      // Keep only last 10 errors
      if (storedErrors.length > 10) {
        storedErrors.splice(0, storedErrors.length - 10);
      }
      localStorage.setItem('mindflow_errors', JSON.stringify(storedErrors));
    } catch (e) {
      logger.warn('Failed to store error report:', e);
    }

    // TODO: Send to remote error reporting service in production
    // if (isProduction()) {
    //   this.sendToRemoteService(errorReport);
    // }

    return errorId;
  }

  // static async sendToRemoteService(errorReport: unknown): Promise<void> {
  //   try {
  //     await fetch('/api/errors', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify(errorReport)
  //     });
  //   } catch (e) {
  //     console.warn('Failed to send error report to remote service:', e);
  //   }
  // }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  override componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    const errorId = ErrorReporter.reportError(_error, _errorInfo, this.props.level);
    
    this.setState({
      error: _error,
      errorInfo: _errorInfo,
      errorId
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(_error, _errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null, 
      errorId: null 
    });
  };

  handleReportProblem = (): void => {
    const { error, errorInfo, errorId } = this.state;
    if (!error || !errorInfo || !errorId) return;

    const reportData = {
      errorId,
      // eslint-disable-next-line no-alert
      userDescription: prompt('Please describe what you were doing when this error occurred:') || '',
      timestamp: new Date().toISOString()
    };

    // TODO: Send user report
    logger.info('User error report:', reportData);
    // eslint-disable-next-line no-alert
    alert('Thank you for the report. We will investigate this issue.');
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI based on level
      const { error, errorInfo, errorId } = this.state;
      const { level = 'component', showDetails = false } = this.props;

      if (level === 'widget') {
        return (
          <div className="error-widget">
            <span className="error-icon">⚠️</span>
            <span className="error-message">Widget failed to load</span>
            <button onClick={this.handleReset} className="error-retry">
              Retry
            </button>
          </div>
        );
      }

      if (level === 'page') {
        return (
          <div className="error-page">
            <div className="error-container">
              <h1>Application Error</h1>
              <p>The application encountered an unexpected error and needs to restart.</p>
              
              <div className="error-actions">
                <button onClick={() => window.location.reload()} className="primary-button">
                  Refresh Application
                </button>
                <button onClick={this.handleReportProblem} className="secondary-button">
                  Report Problem
                </button>
              </div>

              {errorId && (
                <p className="error-id">Error ID: {errorId}</p>
              )}
            </div>
          </div>
        );
      }

      // Default component-level error UI
      return (
        <div className="error-boundary">
          <div className="error-container">
            <h2>Something went wrong</h2>
            <p>This component encountered an error. You can try to reset it or refresh the page.</p>
            
            <div className="error-actions">
              <button onClick={this.handleReset} className="reset-button">
                Reset Component
              </button>
              <button onClick={() => window.location.reload()} className="reload-button">
                Refresh Page
              </button>
              <button onClick={this.handleReportProblem} className="report-button">
                Report Issue
              </button>
            </div>

            {errorId && (
              <p className="error-id">Error ID: {errorId}</p>
            )}

            {(showDetails || isDevelopment()) && error && errorInfo && (
              <details className="error-details">
                <summary>Error Details {isDevelopment() ? '(Development)' : ''}</summary>
                <div className="error-stack">
                  <h4>Error:</h4>
                  <pre>{error.toString()}</pre>
                  <h4>Component Stack:</h4>
                  <pre>{errorInfo.componentStack}</pre>
                  <h4>Stack Trace:</h4>
                  <pre>{error.stack}</pre>
                </div>
              </details>
            )}
          </div>

          <style>{`
            .error-boundary {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 300px;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 12px;
              border: 2px solid #e9ecef;
              margin: 10px;
            }

            .error-page {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #f8f9fa;
            }

            .error-widget {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px 12px;
              background: #fff3cd;
              border: 1px solid #ffeaa7;
              border-radius: 6px;
              font-size: 14px;
              color: #856404;
            }

            .error-container {
              max-width: 600px;
              text-align: center;
              background: white;
              padding: 30px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .error-container h1, .error-container h2 {
              color: #dc3545;
              margin-bottom: 16px;
              font-weight: 600;
            }

            .error-container h1 {
              font-size: 28px;
            }

            .error-container h2 {
              font-size: 24px;
            }

            .error-container p {
              color: #6c757d;
              margin-bottom: 24px;
              line-height: 1.5;
            }

            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
              margin-bottom: 20px;
              flex-wrap: wrap;
            }

            .primary-button, .reset-button {
              background: #4285f4;
              color: white;
            }

            .secondary-button, .reload-button {
              background: #6c757d;
              color: white;
            }

            .report-button {
              background: #e74c3c;
              color: white;
            }

            .error-retry {
              background: #28a745;
              color: white;
              padding: 4px 8px;
              font-size: 12px;
            }

            .primary-button, .secondary-button, .reset-button, .reload-button, .report-button, .error-retry {
              padding: 10px 20px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 500;
              transition: opacity 0.2s;
              font-size: 14px;
            }

            .primary-button:hover, .reset-button:hover,
            .secondary-button:hover, .reload-button:hover,
            .report-button:hover, .error-retry:hover {
              opacity: 0.9;
            }

            .error-id {
              font-family: monospace;
              font-size: 12px;
              color: #6c757d;
              margin-top: 16px;
              padding: 8px;
              background: #f8f9fa;
              border-radius: 4px;
            }

            .error-details {
              text-align: left;
              margin-top: 20px;
              padding: 16px;
              background: #f8f9fa;
              border-radius: 8px;
              border: 1px solid #e9ecef;
            }

            .error-details summary {
              cursor: pointer;
              color: #6c757d;
              font-weight: 500;
              margin-bottom: 10px;
            }

            .error-stack {
              font-size: 12px;
            }

            .error-stack h4 {
              color: #495057;
              margin: 10px 0 5px 0;
              font-size: 13px;
            }

            .error-stack pre {
              font-family: 'Courier New', monospace;
              color: #dc3545;
              white-space: pre-wrap;
              max-height: 150px;
              overflow-y: auto;
              background: white;
              padding: 10px;
              border-radius: 4px;
              border: 1px solid #e9ecef;
              margin-bottom: 10px;
              font-size: 11px;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) => {
  return (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

// Hook for programmatic error handling
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: ErrorInfo) => {
    ErrorReporter.reportError(error, errorInfo || { componentStack: '' });
    throw error; // Re-throw to trigger ErrorBoundary
  };
};

export default ErrorBoundary;