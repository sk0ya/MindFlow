import React, { useState, useEffect } from 'react';
import { X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import './KeyboardShortcutHelper.css';

interface ShortcutItem {
  keys: (string | React.ReactNode)[];
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
        { keys: [<ArrowUp size={14} />], description: '上のノードに移動', context: 'ノード選択時' },
        { keys: [<ArrowDown size={14} />], description: '下のノードに移動', context: 'ノード選択時' },
        { keys: [<ArrowLeft size={14} />], description: '左のノードに移動', context: 'ノード選択時' },
        { keys: [<ArrowRight size={14} />], description: '右のノードに移動', context: 'ノード選択時' }
      ]
    },
    {
      category: '編集操作',
      items: [
        { keys: ['Ctrl', 'Z'], description: '元に戻す', context: 'いつでも' },
        { keys: ['Ctrl', 'Y'], description: 'やり直し', context: 'いつでも' },
        { keys: ['Ctrl', 'Shift', 'Z'], description: 'やり直し', context: 'いつでも' },
        { keys: ['Ctrl', 'L'], description: '全体レイアウトを整列', context: 'いつでも' }
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
      item.keys.some(key => typeof key === 'string' && key.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })).filter(category => category.items.length > 0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

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
            <X size={20} />
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
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('bottom');
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    
    // ツールチップの表示位置を動的に決定
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;
      
      // 上下の表示位置を決定
      let position: 'top' | 'bottom' = 'bottom';
      if (spaceAbove >= 80 && spaceBelow < 80) {
        position = 'top';
      } else if (spaceAbove >= 80 && spaceBelow >= 80) {
        // 両方に十分なスペースがある場合は下を優先
        position = 'bottom';
      } else if (spaceAbove < 80 && spaceBelow >= 80) {
        position = 'bottom';
      } else {
        // どちらも狭い場合は広い方を選択
        position = spaceAbove >= spaceBelow ? 'top' : 'bottom';
      }
      
      setTooltipPosition(position);

      // 左右の位置調整（画面端からはみ出さないように）
      const tooltipMaxWidth = 300; // 最大想定幅
      const centerPosition = rect.left + rect.width / 2;
      let leftPosition = centerPosition - tooltipMaxWidth / 2;
      
      // 左端チェック
      if (leftPosition < 8) {
        leftPosition = 8;
      }
      
      // 右端チェック
      if (leftPosition + tooltipMaxWidth > viewportWidth - 8) {
        leftPosition = viewportWidth - tooltipMaxWidth - 8;
      }
      
      // 左の位置を調整（中央基準からの相対位置として計算）
      const offsetFromCenter = leftPosition + tooltipMaxWidth / 2 - centerPosition;
      
      setTooltipStyle({
        transform: `translateX(calc(-50% + ${offsetFromCenter}px))`
      });
    }
  };

  return (
    <div 
      ref={containerRef}
      className="shortcut-tooltip-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isHovered && (
        <div 
          className={`shortcut-tooltip ${tooltipPosition === 'bottom' ? 'tooltip-bottom' : 'tooltip-top'}`}
          style={tooltipStyle}
        >
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