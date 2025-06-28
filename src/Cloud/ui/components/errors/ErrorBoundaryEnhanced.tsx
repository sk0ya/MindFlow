import React, { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorDetails {
  errorId: string;
  message: string;
  stack?: string;
  componentStack: string;
  timestamp: string;
  userAgent: string;
  url: string;
  retryCount: number;
  context: string;
}

interface FallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
  onReload: () => void;
  onReport: () => void;
}

interface ErrorBoundaryEnhancedProps {
  children: ReactNode;
  fallback?: React.ComponentType<FallbackProps>;
  showDetails?: boolean;
  allowRetry?: boolean;
  context?: string;
}

interface ErrorBoundaryEnhancedState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

// 拡張されたエラーバウンダリーコンポーネント
class ErrorBoundaryEnhanced extends Component<ErrorBoundaryEnhancedProps, ErrorBoundaryEnhancedState> {
  constructor(props: ErrorBoundaryEnhancedProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryEnhancedState> {
    // エラーが発生した際の状態更新
    return { 
      hasError: true,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // エラー詳細を状態に保存
    this.setState({
      error,
      errorInfo
    });

    // エラーログの詳細記録
    this.logError(error, errorInfo);

    // 開発環境では詳細なエラー情報をコンソールに出力
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 ErrorBoundary caught an error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  logError = (error: Error, errorInfo: ErrorInfo): void => {
    const errorDetails: ErrorDetails = {
      errorId: this.state.errorId || 'unknown',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount,
      context: this.props.context || 'unknown'
    };

    // エラーをセッションに記録（クラウド専用）
    try {
      console.error('💾 Error logged (cloud mode):', errorDetails);
      // Cloud mode: errors are logged to console and could be sent to cloud logging service
      // No localStorage dependency - errors are handled through cloud infrastructure
    } catch (logError) {
      console.warn('Failed to log error:', logError);
    }

    // カスタムイベントでエラーを通知
    window.dispatchEvent(new CustomEvent('mindflow-error', {
      detail: errorDetails
    }));
  };

  handleRetry = (): void => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleReportError = (): void => {
    const errorReport = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      timestamp: new Date().toISOString(),
      context: this.props.context
    };

    // エラーレポートをクリップボードにコピー
    navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
      .then(() => {
        alert('エラーレポートがクリップボードにコピーされました。サポートチームに送信してください。');
      })
      .catch(() => {
        console.log('エラーレポート:', errorReport);
        alert('エラーレポートをコンソールに出力しました。');
      });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { fallback: Fallback, showDetails = false, allowRetry = true } = this.props;
      
      // カスタムフォールバックUIが提供されている場合
      if (Fallback) {
        return (
          <Fallback 
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            onRetry={this.handleRetry}
            onReload={this.handleReload}
            onReport={this.handleReportError}
          />
        );
      }

      // デフォルトのエラーUI
      return (
        <div style={{
          padding: '20px',
          border: '2px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#fff5f5',
          margin: '20px',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h2 style={{ color: '#d63031', marginTop: 0 }}>
            🚨 申し訳ございません。エラーが発生しました
          </h2>
          
          <p style={{ color: '#636e72', marginBottom: '20px' }}>
            予期しないエラーが発生しました。以下のオプションをお試しください。
          </p>

          <div style={{ marginBottom: '20px' }}>
            {allowRetry && (
              <button
                onClick={this.handleRetry}
                style={{
                  backgroundColor: '#00b894',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  marginRight: '10px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🔄 再試行
              </button>
            )}
            
            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: '#0984e3',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                marginRight: '10px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔃 ページを再読み込み
            </button>

            <button
              onClick={this.handleReportError}
              style={{
                backgroundColor: '#fdcb6e',
                color: '#2d3436',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              📋 エラーレポートをコピー
            </button>
          </div>

          {showDetails && this.state.error && (
            <details style={{ marginTop: '20px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                技術的な詳細を表示
              </summary>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '15px',
                marginTop: '10px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px',
                overflow: 'auto'
              }}>
                <p><strong>エラーID:</strong> {this.state.errorId}</p>
                <p><strong>メッセージ:</strong> {this.state.error.message}</p>
                <p><strong>再試行回数:</strong> {this.state.retryCount}</p>
                <p><strong>コンテキスト:</strong> {this.props.context || 'unknown'}</p>
                {process.env.NODE_ENV === 'development' && (
                  <details>
                    <summary>スタックトレース</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '10px' }}>
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryEnhanced;