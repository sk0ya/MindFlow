import React from 'react';
import { Workflow, Package, Inbox } from 'lucide-react';
import type { MindMapData } from '../../../../shared/types';

interface ExportSidebarProps {
  currentMap?: MindMapData | null;
  onExport?: () => void;
}

const ExportSidebar: React.FC<ExportSidebarProps> = ({
  currentMap,
  onExport
}) => {
  const handleExportClick = () => {
    onExport?.();
  };

  const getNodeCount = (map: MindMapData): number => {
    const countNodes = (node: any): number => {
      let count = 1;
      if (node.children && Array.isArray(node.children)) {
        count += node.children.reduce((sum: number, child: any) => sum + countNodes(child), 0);
      }
      return count;
    };
    
    return map?.rootNode ? countNodes(map.rootNode) : 0;
  };

  return (
    <div className="export-sidebar">
      <div className="export-sidebar-header">
        <h3 className="export-sidebar-title">マップをエクスポート</h3>
      </div>

      <div className="export-sidebar-content">
        {currentMap ? (
          <>
            <div className="export-section">
              <h4 className="export-section-title">現在のマップ</h4>
              <div className="export-current-map">
                <div className="export-map-info">
                  <div className="export-map-name">{currentMap.title}</div>
                  <div className="export-map-details">
                    <span className="export-map-nodes">{getNodeCount(currentMap)} ノード</span>
                    <span className="export-map-date">
                      更新: {new Date(currentMap.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="export-map-preview"><Workflow size={16} /></div>
              </div>
            </div>

            <div className="export-section">
              <h4 className="export-section-title">エクスポート内容</h4>
              <div className="export-content-info">
                <p className="export-description">
                  ZIP形式でマップデータと添付ファイルを一括保存
                </p>
                <div className="export-includes">
                  <span className="export-include-text">
                    JSON • Markdown • 添付ファイル
                  </span>
                </div>
              </div>
            </div>

            <div className="export-section">
              <button 
                className="export-button primary"
                onClick={handleExportClick}
              >
                <span className="export-button-icon"><Package size={16} /></span>
                ZIPファイルでエクスポート
              </button>
            </div>

          </>
        ) : (
          <div className="export-no-map">
            <div className="export-no-map-icon"><Inbox size={32} /></div>
            <div className="export-no-map-title">マップが選択されていません</div>
            <div className="export-no-map-description">
              エクスポートするには、まずマップを開いてください
            </div>
          </div>
        )}
      </div>

      <style>{`
        .export-sidebar {
          padding: 16px;
          overflow-y: auto;
          background-color: var(--bg-primary);
          height: 100%;
        }

        .export-sidebar-header {
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .export-sidebar-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .export-sidebar-content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .export-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .export-section-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .export-current-map {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-secondary);
        }

        .export-map-info {
          flex: 1;
        }

        .export-map-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .export-map-details {
          display: flex;
          gap: 12px;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .export-map-preview {
          font-size: 24px;
          opacity: 0.6;
        }

        .export-content-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .export-description {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.4;
        }

        .export-includes {
          text-align: center;
        }

        .export-include-text {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.3;
        }

        .export-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-primary);
          color: var(--text-primary);
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .export-button:hover:not(.disabled) {
          background-color: var(--hover-color);
          border-color: var(--accent-color);
        }

        .export-button.primary {
          background: var(--accent-color);
          color: white;
          border-color: var(--accent-color);
        }

        .export-button.primary:hover {
          background: var(--accent-color-hover);
        }

        .export-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .export-button-icon {
          font-size: 16px;
        }

        .export-tips-list {
          list-style: none;
          padding: 0;
          margin: 0;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .export-tips-list li {
          margin-bottom: 8px;
          padding-left: 16px;
          position: relative;
        }

        .export-tips-list li::before {
          /* content: "💡"; */ /* Replaced with Lucide icons */
          position: absolute;
          left: 0;
          top: 0;
        }

        .export-no-map {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
        }

        .export-no-map-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.6;
        }

        .export-no-map-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .export-no-map-description {
          font-size: 14px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
};

export default ExportSidebar;