import React from 'react';
import './ActivityBar.css';

interface ActivityBarItem {
  id: string;
  icon: string;
  label: string;
  isActive?: boolean;
}

interface ActivityBarProps {
  activeView: string | null;
  onViewChange: (viewId: string | null) => void;
}

const ActivityBar: React.FC<ActivityBarProps> = ({ activeView, onViewChange }) => {
  const items: ActivityBarItem[] = [
    {
      id: 'maps',
      icon: '🗺️',
      label: 'マップ一覧',
      isActive: activeView === 'maps'
    },
    {
      id: 'search',
      icon: '🔍',
      label: '検索',
      isActive: activeView === 'search'
    },
    {
      id: 'notes',
      icon: '📝',
      label: 'ノート',
      isActive: activeView === 'notes'
    },
    {
      id: 'import',
      icon: '📥',
      label: 'インポート',
      isActive: activeView === 'import'
    },
    {
      id: 'export',
      icon: '📤',
      label: 'エクスポート',
      isActive: activeView === 'export'
    },
    {
      id: 'ai',
      icon: '🤖',
      label: 'AI設定',
      isActive: activeView === 'ai'
    },
    {
      id: 'settings',
      icon: '⚙️',
      label: '設定',
      isActive: activeView === 'settings'
    }
  ];

  const handleItemClick = (itemId: string) => {
    // 同じアイテムをクリックした場合はトグル
    if (activeView === itemId) {
      onViewChange(null);
    } else {
      onViewChange(itemId);
    }
  };

  return (
    <div className="activity-bar">
      <div className="activity-bar-items">
        {items.map((item) => (
          <button
            key={item.id}
            className={`activity-bar-item ${item.isActive ? 'active' : ''}`}
            onClick={() => handleItemClick(item.id)}
            title={item.label}
            aria-label={item.label}
          >
            <span className="activity-bar-icon">{item.icon}</span>
          </button>
        ))}
      </div>
      
      <div className="activity-bar-bottom">
        <button
          className="activity-bar-item"
          title="キーボードショートカット"
          aria-label="キーボードショートカット"
        >
          <span className="activity-bar-icon">⌨️</span>
        </button>
      </div>
    </div>
  );
};

export default ActivityBar;