import React, { useState, useEffect } from 'react';
import { usePerformanceMonitor, PERFORMANCE_THRESHOLDS, checkPerformanceWarnings, type PerformanceMetrics } from '../../../shared/utils/performanceMonitor';

interface PerformanceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  nodeCount: number;
  onOptimize?: () => void;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  isOpen,
  onClose,
  nodeCount,
  onOptimize
}) => {
  const {
    getStats,
    getCurrentFPS,
    getMemoryUsage,
    exportResults,
    clear
  } = usePerformanceMonitor();

  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    nodeCount,
    connectionCount: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    fps: 0,
    frameTime: 0
  });

  const [stats, setStats] = useState(getStats());
  const [warnings, setWarnings] = useState<string[]>([]);

  // Update metrics every second
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const newMetrics: PerformanceMetrics = {
        renderTime: 0, // Will be updated by benchmark
        nodeCount,
        connectionCount: Math.max(0, nodeCount - 1),
        memoryUsage: getMemoryUsage(),
        cacheHitRate: 0, // To be filled by cache system
        fps: getCurrentFPS(),
        frameTime: 1000 / getCurrentFPS()
      };

      setCurrentMetrics(newMetrics);
      setStats(getStats());
      setWarnings(checkPerformanceWarnings(newMetrics));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, nodeCount, getMemoryUsage, getCurrentFPS, getStats]);

  const handleExport = () => {
    const data = exportResults();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mindflow-performance-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getMetricColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return '#ff4444';
    if (value >= thresholds.warning) return '#ff8800';
    return '#00aa00';
  };

  const getFPSColor = (fps: number) => {
    if (fps < PERFORMANCE_THRESHOLDS.FPS_CRITICAL) return '#ff4444';
    if (fps < PERFORMANCE_THRESHOLDS.FPS_WARNING) return '#ff8800';
    return '#00aa00';
  };

  if (!isOpen) return null;

  return (
    <div className="performance-dashboard">
      <div className="dashboard-overlay" onClick={onClose} />
      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>🚀 Performance Dashboard</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="dashboard-body">
          {/* Current Metrics */}
          <div className="metrics-section">
            <h3>リアルタイム メトリクス</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-value" style={{ color: getFPSColor(currentMetrics.fps) }}>
                  {currentMetrics.fps}
                </div>
                <div className="metric-label">FPS</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-value" style={{ color: getMetricColor(currentMetrics.memoryUsage, { warning: 100, critical: 200 }) }}>
                  {currentMetrics.memoryUsage.toFixed(1)}
                </div>
                <div className="metric-label">Memory (MB)</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-value">
                  {currentMetrics.nodeCount}
                </div>
                <div className="metric-label">Nodes</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-value">
                  {currentMetrics.frameTime.toFixed(2)}
                </div>
                <div className="metric-label">Frame Time (ms)</div>
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="stats-section">
            <h3>パフォーマンス統計</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span>平均レンダリング時間:</span>
                <span>{stats.averageRenderTime.toFixed(2)}ms</span>
              </div>
              <div className="stat-item">
                <span>最大レンダリング時間:</span>
                <span>{stats.maxRenderTime.toFixed(2)}ms</span>
              </div>
              <div className="stat-item">
                <span>最小レンダリング時間:</span>
                <span>{stats.minRenderTime.toFixed(2)}ms</span>
              </div>
              <div className="stat-item">
                <span>平均FPS:</span>
                <span>{stats.averageFPS.toFixed(1)}</span>
              </div>
              <div className="stat-item">
                <span>メモリ使用量推移:</span>
                <span>{stats.memoryTrend >= 0 ? '+' : ''}{stats.memoryTrend.toFixed(2)}MB</span>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="warnings-section">
              <h3>⚠️ パフォーマンス警告</h3>
              <div className="warnings-list">
                {warnings.map((warning, index) => (
                  <div key={index} className="warning-item">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="recommendations-section">
            <h3>💡 最適化提案</h3>
            <div className="recommendations-list">
              {currentMetrics.nodeCount > 1000 && (
                <div className="recommendation">
                  • 大量のノードが検出されました。仮想化レンダリングの使用を検討してください
                </div>
              )}
              {currentMetrics.fps < 45 && (
                <div className="recommendation">
                  • FPSが低下しています。キャッシュ設定を確認してください
                </div>
              )}
              {currentMetrics.memoryUsage > 100 && (
                <div className="recommendation">
                  • メモリ使用量が高いです。不要なデータの削除を検討してください
                </div>
              )}
              {stats.averageRenderTime > 16 && (
                <div className="recommendation">
                  • レンダリング時間が長いです。コンポーネントの最適化を検討してください
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="controls-section">
            <button className="btn-primary" onClick={handleExport}>
              📊 データエクスポート
            </button>
            <button className="btn-secondary" onClick={clear}>
              🗑️ データクリア
            </button>
            {onOptimize && (
              <button className="btn-primary" onClick={onOptimize}>
                ⚡ 最適化実行
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .performance-dashboard {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dashboard-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }

        .dashboard-content {
          position: relative;
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #eee;
        }

        .dashboard-header h2 {
          margin: 0;
          color: #333;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 8px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: #f5f5f5;
          color: #333;
        }

        .dashboard-body {
          padding: 20px;
        }

        .metrics-section, .stats-section, .warnings-section, .recommendations-section, .controls-section {
          margin-bottom: 24px;
        }

        .metrics-section h3, .stats-section h3, .warnings-section h3, .recommendations-section h3 {
          margin: 0 0 16px 0;
          color: #333;
          font-size: 16px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 16px;
        }

        .metric-card {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          border: 1px solid #e9ecef;
        }

        .metric-value {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 4px;
        }

        .metric-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stats-grid {
          display: grid;
          gap: 8px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .stat-item:last-child {
          border-bottom: none;
        }

        .warnings-list, .recommendations-list {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
        }

        .warning-item {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 4px;
          padding: 8px 12px;
          margin-bottom: 8px;
          color: #856404;
        }

        .warning-item:last-child {
          margin-bottom: 0;
        }

        .recommendation {
          margin-bottom: 8px;
          color: #666;
        }

        .recommendation:last-child {
          margin-bottom: 0;
        }

        .controls-section {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .btn-primary, .btn-secondary {
          padding: 10px 16px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #4285f4;
          color: white;
        }

        .btn-primary:hover {
          background: #3367d6;
        }

        .btn-secondary {
          background: #f8f9fa;
          color: #666;
          border: 1px solid #ddd;
        }

        .btn-secondary:hover {
          background: #e9ecef;
        }

        @media (max-width: 768px) {
          .dashboard-content {
            width: 95%;
            margin: 20px;
          }

          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .controls-section {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default PerformanceDashboard;