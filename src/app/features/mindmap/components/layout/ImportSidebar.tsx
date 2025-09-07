import React, { useState } from 'react';

interface ImportSidebarProps {
  onImport?: () => void;
}

const ImportSidebar: React.FC<ImportSidebarProps> = ({
  onImport
}) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const markdownFiles = files.filter(file => 
      file.type === 'text/markdown' || 
      file.name.endsWith('.md') || 
      file.name.endsWith('.txt')
    );

    if (markdownFiles.length > 0) {
      // ドラッグ&ドロップでのファイル処理をここに実装
      console.log('Dropped markdown files:', markdownFiles);
      onImport?.();
    }
  };

  return (
    <div className="import-sidebar">
      <div className="import-sidebar-header">
        <h3 className="import-sidebar-title">マップをインポート</h3>
      </div>

      <div className="import-sidebar-content">
        <div className="import-section">
          <h4 className="import-section-title">マークダウンファイル</h4>
          <p className="import-section-description">
            マークダウンファイル（.md）からマインドマップを作成します
          </p>
          
          <div 
            className={`import-drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="import-drop-zone-content">
              <div className="import-drop-zone-icon">📥</div>
              <div className="import-drop-zone-text">
                ファイルをここにドラッグ＆ドロップ
              </div>
              <div className="import-drop-zone-subtext">
                または下のボタンをクリック
              </div>
            </div>
          </div>

          <button 
            className="import-button primary"
            onClick={onImport}
          >
            <span className="import-button-icon">📄</span>
            ファイルを選択してインポート
          </button>
        </div>

        <div className="import-section">
          <h4 className="import-section-title">対応形式</h4>
          <div className="import-formats">
            <span className="import-format-text">📝 Markdown (.md) • 📄 テキスト (.txt)</span>
          </div>
        </div>
      </div>

      <style>{`
        .import-sidebar {
          padding: 16px;
          overflow-y: auto;
          background-color: var(--bg-primary);
          height: 100%;
        }

        .import-sidebar-header {
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .import-sidebar-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .import-sidebar-content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .import-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .import-section-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .import-section-description {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.4;
        }

        .import-drop-zone {
          border: 2px dashed var(--border-color);
          border-radius: 8px;
          padding: 32px 16px;
          text-align: center;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .import-drop-zone:hover,
        .import-drop-zone.drag-over {
          border-color: var(--accent-color);
          background-color: var(--hover-color);
        }

        .import-drop-zone-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .import-drop-zone-icon {
          font-size: 32px;
          opacity: 0.6;
        }

        .import-drop-zone-text {
          font-size: 14px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .import-drop-zone-subtext {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .import-button {
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

        .import-button:hover {
          background-color: var(--hover-color);
          border-color: var(--accent-color);
        }

        .import-button.primary {
          background: var(--accent-color);
          color: white;
          border-color: var(--accent-color);
        }

        .import-button.primary:hover {
          background: var(--accent-color-hover);
        }

        .import-button-icon {
          font-size: 16px;
        }

        .import-formats {
          text-align: center;
        }

        .import-format-text {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.3;
        }
      `}</style>
    </div>
  );
};

export default ImportSidebar;