import React from 'react';
import PropTypes from 'prop-types';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-container">
            <h2>Something went wrong</h2>
            <p>An error occurred while rendering the mindmap. Please try refreshing the page or resetting the view.</p>
            
            <div className="error-actions">
              <button onClick={this.handleReset} className="reset-button">
                Reset View
              </button>
              <button onClick={() => window.location.reload()} className="reload-button">
                Refresh Page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre className="error-stack">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>

          <style jsx>{`
            .error-boundary {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 400px;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 12px;
              border: 2px solid #e9ecef;
            }

            .error-container {
              max-width: 500px;
              text-align: center;
              background: white;
              padding: 30px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .error-container h2 {
              color: #dc3545;
              margin-bottom: 16px;
              font-size: 24px;
              font-weight: 600;
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
            }

            .reset-button, .reload-button {
              padding: 10px 20px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 500;
              transition: background-color 0.2s;
            }

            .reset-button {
              background: #4285f4;
              color: white;
            }

            .reset-button:hover {
              background: #3367d6;
            }

            .reload-button {
              background: #6c757d;
              color: white;
            }

            .reload-button:hover {
              background: #5a6268;
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
              font-family: 'Courier New', monospace;
              font-size: 12px;
              color: #dc3545;
              white-space: pre-wrap;
              max-height: 200px;
              overflow-y: auto;
              background: white;
              padding: 10px;
              border-radius: 4px;
              border: 1px solid #e9ecef;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
};

export default ErrorBoundary;