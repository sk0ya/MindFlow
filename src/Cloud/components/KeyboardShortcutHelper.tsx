import React, { useState, useEffect } from 'react';

interface ShortcutItem {
  keys: string[];
  description: string;
  context: string;
}

interface ShortcutCategory {
  category: string;
  items: ShortcutItem[];
}

interface KeyboardShortcutHelperProps {
  isVisible: boolean;
  onClose: () => void;
}

const KeyboardShortcutHelper: React.FC<KeyboardShortcutHelperProps> = ({ isVisible, onClose }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');

  const shortcuts: ShortcutCategory[] = [
    {
      category: 'ノード操作',
      items: [
        { keys: ['Tab'], description: '子ノードを追加', context: 'ノード選択時' },
        { keys: ['Enter'], description: '兄弟ノードを追加', context: 'ノード選択時' },
        { keys: ['Space'], description: 'ノードを編集', context: 'ノード選択時' },
        { keys: ['Delete'], description: 'ノードを削除', context: 'ノード選択時' },
        { keys: ['Escape'], description: '編集を終了/選択を解除', context: '編集時' }
      ]
    },
    {
      category: 'ナビゲーション',
      items: [
        { keys: ['↑'], description: '上のノードに移動', context: 'ノード選択時' },
        { keys: ['↓'], description: '下のノードに移動', context: 'ノード選択時' },
        { keys: ['←'], description: '左のノードに移動', context: 'ノード選択時' },
        { keys: ['→'], description: '右のノードに移動', context: 'ノード選択時' }
      ]
    },
    {
      category: 'ファイル操作',
      items: [
        { keys: ['Ctrl', 'S'], description: 'マインドマップを保存', context: 'いつでも' },
        { keys: ['Ctrl', 'Z'], description: '元に戻す', context: 'いつでも' },
        { keys: ['Ctrl', 'Y'], description: 'やり直し', context: 'いつでも' },
        { keys: ['Ctrl', 'Shift', 'Z'], description: 'やり直し', context: 'いつでも' }
      ]
    },
    {
      category: '表示・UI',
      items: [
        { keys: ['F1'], description: 'ヘルプを表示', context: 'いつでも' },
        { keys: ['?'], description: 'ショートカット一覧を表示', context: 'いつでも' },
        { keys: ['Escape'], description: 'パネルを閉じる', context: 'パネル表示時' }
      ]
    }
  ];

  const filteredShortcuts = shortcuts.map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.keys.some(key => key.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })).filter(category => category.items.length > 0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        onClose();
      }
      if (e.key === '?' && !isVisible) {
        e.preventDefault();
        onClose(); // トグル動作のため、表示状態を切り替え
      }
      if (e.key === 'F1') {
        e.preventDefault();
        onClose(); // トグル動作のため、表示状態を切り替え
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="shortcut-helper-overlay" onClick={onClose}>
      <div className="shortcut-helper-panel" onClick={e => e.stopPropagation()}>
        <div className="shortcut-helper-header">
          <h2>キーボードショートカット</h2>
          <button className="shortcut-helper-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="shortcut-helper-search">
          <input
            type="text"
            placeholder="ショートカットを検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="shortcut-search-input"
          />
        </div>

        <div className="shortcut-helper-content">
          {filteredShortcuts.map((category, categoryIndex) => (
            <div key={categoryIndex} className="shortcut-category">
              <h3 className="shortcut-category-title">{category.category}</h3>
              <div className="shortcut-list">
                {category.items.map((shortcut, index) => (
                  <div key={index} className="shortcut-item">
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <kbd className="shortcut-key">{key}</kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="shortcut-plus">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="shortcut-description">
                      <span className="shortcut-action">{shortcut.description}</span>
                      <span className="shortcut-context">{shortcut.context}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredShortcuts.length === 0 && (
            <div className="shortcut-no-results">
              <p>「{searchTerm}」に一致するショートカットが見つかりません。</p>
            </div>
          )}
        </div>

        <div className="shortcut-helper-footer">
          <p>
            <kbd>Esc</kbd> でこのパネルを閉じる | 
            <kbd>?</kbd> または <kbd>F1</kbd> でいつでも表示
          </p>
        </div>
      </div>

      <style>{`
        /* キーボードショートカットヘルパー */
        .shortcut-helper-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .shortcut-helper-panel {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 800px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: shortcutPanelSlideIn 0.3s ease-out;
        }

        @keyframes shortcutPanelSlideIn {
          from {
            opacity: 0;
            transform: translateY(-30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* ヘッダー */
        .shortcut-helper-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 24px 16px 24px;
          border-bottom: 1px solid #e1e5e9;
        }

        .shortcut-helper-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: #2c3e50;
        }

        .shortcut-helper-close {
          background: none;
          border: none;
          font-size: 28px;
          color: #7f8c8d;
          cursor: pointer;
          padding: 4px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .shortcut-helper-close:hover {
          background: #f8f9fa;
          color: #2c3e50;
        }

        /* 検索 */
        .shortcut-helper-search {
          padding: 16px 24px;
          border-bottom: 1px solid #e1e5e9;
        }

        .shortcut-search-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e1e5e9;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s ease;
        }

        .shortcut-search-input:focus {
          outline: none;
          border-color: #3498db;
        }

        .shortcut-search-input::placeholder {
          color: #95a5a6;
        }

        /* コンテンツ */
        .shortcut-helper-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .shortcut-category {
          margin-bottom: 32px;
        }

        .shortcut-category:last-child {
          margin-bottom: 0;
        }

        .shortcut-category-title {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: #2c3e50;
          padding-bottom: 8px;
          border-bottom: 2px solid #ecf0f1;
        }

        .shortcut-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .shortcut-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 8px;
          transition: background 0.2s ease;
        }

        .shortcut-item:hover {
          background: #e9ecef;
        }

        .shortcut-keys {
          display: flex;
          align-items: center;
          min-width: 120px;
          margin-right: 20px;
        }

        .shortcut-key {
          background: white;
          border: 2px solid #dee2e6;
          border-radius: 4px;
          padding: 4px 8px;
          font-family: monospace;
          font-size: 12px;
          font-weight: 600;
          color: #495057;
          box-shadow: 0 2px 0 #dee2e6;
          min-width: 28px;
          text-align: center;
        }

        .shortcut-plus {
          margin: 0 6px;
          color: #6c757d;
          font-size: 12px;
        }

        .shortcut-description {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .shortcut-action {
          font-size: 16px;
          color: #2c3e50;
          font-weight: 500;
        }

        .shortcut-context {
          font-size: 14px;
          color: #7f8c8d;
          margin-top: 2px;
        }

        /* 検索結果なし */
        .shortcut-no-results {
          text-align: center;
          padding: 40px 20px;
          color: #7f8c8d;
        }

        .shortcut-no-results p {
          margin: 0;
          font-size: 16px;
        }

        /* フッター */
        .shortcut-helper-footer {
          padding: 16px 24px;
          border-top: 1px solid #e1e5e9;
          background: #f8f9fa;
          text-align: center;
        }

        .shortcut-helper-footer p {
          margin: 0;
          font-size: 14px;
          color: #6c757d;
        }

        .shortcut-helper-footer kbd {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 3px;
          padding: 2px 6px;
          font-family: monospace;
          font-size: 12px;
          color: #495057;
          margin: 0 2px;
        }
      `}</style>
    </div>
  );
};

// ツールバーボタン用のショートカット表示コンポーネント
interface ShortcutTooltipProps {
  shortcut?: string;
  children: React.ReactNode;
  description: string;
}

export const ShortcutTooltip: React.FC<ShortcutTooltipProps> = ({ shortcut, children, description }) => {
  const [isHovered, setIsHovered] = useState<boolean>(false);

  return (
    <div 
      className="shortcut-tooltip-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isHovered && (
        <div className="shortcut-tooltip">
          <div className="shortcut-tooltip-description">{description}</div>
          {shortcut && (
            <div className="shortcut-tooltip-keys">
              {shortcut.split('+').map((key, index) => (
                <React.Fragment key={index}>
                  <kbd className="shortcut-tooltip-key">{key}</kbd>
                  {index < shortcut.split('+').length - 1 && (
                    <span className="shortcut-tooltip-plus">+</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        /* ツールチップコンポーネント */
        .shortcut-tooltip-container {
          position: relative;
          display: inline-block;
        }

        .shortcut-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: #2c3e50;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 1000;
          margin-bottom: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          animation: tooltipFadeIn 0.2s ease-out;
        }

        .shortcut-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: #2c3e50;
        }

        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .shortcut-tooltip-description {
          display: block;
          margin-bottom: 4px;
        }

        .shortcut-tooltip-keys {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
        }

        .shortcut-tooltip-key {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 2px;
          padding: 1px 4px;
          font-family: monospace;
          font-size: 10px;
        }

        .shortcut-tooltip-plus {
          color: rgba(255, 255, 255, 0.7);
          font-size: 10px;
          margin: 0 2px;
        }
      `}</style>
    </div>
  );
};

export default KeyboardShortcutHelper;