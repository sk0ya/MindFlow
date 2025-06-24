import React, { useState, useEffect } from 'react';
import './KeyboardShortcutHelper.css';

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
    </div>
  );
};

export default KeyboardShortcutHelper;