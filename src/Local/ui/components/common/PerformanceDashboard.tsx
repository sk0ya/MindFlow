import React, { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { usePerformanceMonitor } from '../../features/collaboration/useRealtimeOptimization.js';

/**
 * パフォーマンス監視ダッシュボード
 * 開発環境でのリアルタイム機能のパフォーマンス確認用
 */
const PerformanceDashboard = memo(({ 
  isVisible = false, 
  onClose,
  position = 'bottom-right'
}) => {
  const { getMetrics } = usePerformanceMonitor();
  const [metrics, setMetrics] = useState({});
  const [history, setHistory] = useState([]);
  const [isRecording, setIsRecording] = useState(true);

  useEffect(() => {
    if (!isVisible || !isRecording) return;

    const interval = setInterval(() => {
      const currentMetrics = getMetrics();
      setMetrics(currentMetrics);
      
      // 履歴を保持（最大50ポイント）
      setHistory(prev => {
        const newHistory = [...prev, {
          ...currentMetrics,
          timestamp: Date.now()
        }];
        return newHistory.slice(-50);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, isRecording, getMetrics]);

  const getPerformanceStatus = (renderTime) => {
    if (renderTime < 8) return { status: 'excellent', color: '#28a745' };
    if (renderTime < 16) return { status: 'good', color: '#ffc107' };
    if (renderTime < 33) return { status: 'acceptable', color: '#fd7e14' };
    return { status: 'poor', color: '#dc3545' };
  };

  const getMemoryStatus = (memoryMB) => {
    if (memoryMB < 50) return { status: 'low', color: '#28a745' };
    if (memoryMB < 100) return { status: 'moderate', color: '#ffc107' };
    if (memoryMB < 200) return { status: 'high', color: '#fd7e14' };
    return { status: 'critical', color: '#dc3545' };
  };

  const getConnectionStatus = (messageRate) => {
    if (messageRate < 5) return { status: 'light', color: '#28a745' };
    if (messageRate < 20) return { status: 'moderate', color: '#ffc107' };
    if (messageRate < 50) return { status: 'heavy', color: '#fd7e14' };
    return { status: 'overloaded', color: '#dc3545' };
  };

  if (!isVisible) return null;

  const renderStatus = getPerformanceStatus(metrics.averageRenderTime || 0);
  const memoryStatus = getMemoryStatus(metrics.memoryUsage || 0);
  const connectionStatus = getConnectionStatus(metrics.wsMessageRate || 0);

  return (
    <div className={`performance-dashboard ${position}`}>
      <div className="dashboard-header">
        <h4>⚡ Performance Monitor</h4>
        <div className="header-controls">
          <button
            className={`toggle-button ${isRecording ? 'recording' : 'paused'}`}
            onClick={() => setIsRecording(!isRecording)}
            title={isRecording ? 'Pause monitoring' : 'Resume monitoring'}
          >
            {isRecording ? '⏸️' : '▶️'}
          </button>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        {/* Render Performance */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon">🎨</span>
            <span className="metric-title">Rendering</span>
          </div>
          <div className="metric-value">
            <span 
              className="value-number"
              style={{ color: renderStatus.color }}
            >
              {(metrics.averageRenderTime || 0).toFixed(1)}ms
            </span>
            <span className="value-label">avg render</span>
          </div>
          <div className="metric-status" style={{ color: renderStatus.color }}>
            {renderStatus.status}
          </div>
          <div className="metric-detail">
            Renders: {metrics.renderCount || 0}
          </div>
        </div>

        {/* Memory Usage */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon">🧠</span>
            <span className="metric-title">Memory</span>
          </div>
          <div className="metric-value">
            <span 
              className="value-number"
              style={{ color: memoryStatus.color }}
            >
              {(metrics.memoryUsage || 0).toFixed(1)}MB
            </span>
            <span className="value-label">heap used</span>
          </div>
          <div className="metric-status" style={{ color: memoryStatus.color }}>
            {memoryStatus.status}
          </div>
        </div>

        {/* WebSocket Performance */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon">🌐</span>
            <span className="metric-title">WebSocket</span>
          </div>
          <div className="metric-value">
            <span 
              className="value-number"
              style={{ color: connectionStatus.color }}
            >
              {metrics.wsMessageRate || 0}
            </span>
            <span className="value-label">msgs/sec</span>
          </div>
          <div className="metric-status" style={{ color: connectionStatus.color }}>
            {connectionStatus.status}
          </div>
          <div className="metric-detail">
            Total: {metrics.wsMessageCount || 0}
          </div>
        </div>

        {/* FPS Estimate */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon">📊</span>
            <span className="metric-title">FPS Est.</span>
          </div>
          <div className="metric-value">
            <span className="value-number">
              {metrics.lastRenderTime ? Math.min(60, Math.round(1000 / metrics.lastRenderTime)) : 60}
            </span>
            <span className="value-label">frames/sec</span>
          </div>
          <div className="metric-detail">
            Last: {(metrics.lastRenderTime || 0).toFixed(1)}ms
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="performance-chart">
        <div className="chart-header">
          <span>Render Time History</span>
        </div>
        <div className="chart-container">
          <svg width="100%" height="60" className="chart-svg">
            {history.length > 1 && history.map((point, index) => {
              if (index === 0) return null;
              
              const prevPoint = history[index - 1];
              const x1 = ((index - 1) / (history.length - 1)) * 100;
              const x2 = (index / (history.length - 1)) * 100;
              const y1 = Math.max(0, 60 - (prevPoint.averageRenderTime / 50) * 60);
              const y2 = Math.max(0, 60 - (point.averageRenderTime / 50) * 60);
              
              return (
                <line
                  key={index}
                  x1={`${x1}%`}
                  y1={y1}
                  x2={`${x2}%`}
                  y2={y2}
                  stroke={point.averageRenderTime > 16 ? '#dc3545' : '#007acc'}
                  strokeWidth="1"
                />
              );
            })}
            {/* FPS guideline */}
            <line
              x1="0%"
              y1={60 - (16 / 50) * 60}
              x2="100%"
              y2={60 - (16 / 50) * 60}
              stroke="#ffc107"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.5"
            />
          </svg>
        </div>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-color" style={{ background: '#007acc' }}></span>
            Good (&lt;16ms)
          </span>
          <span className="legend-item">
            <span className="legend-color" style={{ background: '#ffc107' }}></span>
            60fps line
          </span>
          <span className="legend-item">
            <span className="legend-color" style={{ background: '#dc3545' }}></span>
            Slow (&gt;16ms)
          </span>
        </div>
      </div>

      <style>{`
        .performance-dashboard {
          position: fixed;
          width: 300px;
          background: white;
          border: 1px solid #e1e1e1;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 2000;
          font-size: 12px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .performance-dashboard.bottom-right {
          bottom: 20px;
          right: 20px;
        }

        .performance-dashboard.bottom-left {
          bottom: 20px;
          left: 20px;
        }

        .performance-dashboard.top-right {
          top: 20px;
          right: 20px;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e1e1e1;
          border-radius: 8px 8px 0 0;
        }

        .dashboard-header h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .header-controls {
          display: flex;
          gap: 8px;
        }

        .toggle-button {
          background: none;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .toggle-button.recording {
          background: #dc3545;
          color: white;
          border-color: #dc3545;
        }

        .toggle-button.paused {
          background: #28a745;
          color: white;
          border-color: #28a745;
        }

        .close-button {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 12px;
        }

        .metric-card {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          padding: 8px;
        }

        .metric-header {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 4px;
        }

        .metric-icon {
          font-size: 12px;
        }

        .metric-title {
          font-weight: 500;
          color: #495057;
        }

        .metric-value {
          display: flex;
          flex-direction: column;
          margin-bottom: 4px;
        }

        .value-number {
          font-size: 16px;
          font-weight: bold;
          line-height: 1;
        }

        .value-label {
          font-size: 10px;
          color: #6c757d;
        }

        .metric-status {
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
        }

        .metric-detail {
          font-size: 10px;
          color: #6c757d;
          margin-top: 2px;
        }

        .performance-chart {
          border-top: 1px solid #e1e1e1;
          padding: 12px;
        }

        .chart-header {
          font-weight: 500;
          color: #495057;
          margin-bottom: 8px;
        }

        .chart-container {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .chart-svg {
          display: block;
        }

        .chart-legend {
          display: flex;
          gap: 8px;
          font-size: 10px;
          color: #6c757d;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .legend-color {
          width: 8px;
          height: 2px;
          border-radius: 1px;
        }

        /* レスポンシブ対応 */
        @media (max-width: 768px) {
          .performance-dashboard {
            position: fixed !important;
            bottom: 10px !important;
            left: 10px !important;
            right: 10px !important;
            width: auto !important;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }

        /* ダークモード対応 */
        @media (prefers-color-scheme: dark) {
          .performance-dashboard {
            background: #2d2d2d;
            border-color: #404040;
            color: #e1e1e1;
          }

          .dashboard-header {
            background: #383838;
            border-color: #404040;
          }

          .dashboard-header h4 {
            color: #e1e1e1;
          }

          .metric-card {
            background: #383838;
            border-color: #404040;
          }

          .chart-container {
            background: #383838;
            border-color: #404040;
          }
        }
      `}</style>
    </div>
  );
});

PerformanceDashboard.propTypes = {
  isVisible: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  position: PropTypes.oneOf(['bottom-right', 'bottom-left', 'top-right'])
};

export default PerformanceDashboard;