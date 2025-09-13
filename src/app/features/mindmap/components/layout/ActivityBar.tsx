import React from 'react';
import { Workflow, Search, Paperclip, Download, Upload, Bot, Settings, Keyboard } from 'lucide-react';
import './ActivityBar.css';

interface ActivityBarItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
}

interface ActivityBarProps {
  activeView: string | null;
  onViewChange: (viewId: string | null) => void;
  onShowKeyboardHelper: () => void;
}

const ActivityBar: React.FC<ActivityBarProps> = ({ activeView, onViewChange, onShowKeyboardHelper }) => {
  const items: ActivityBarItem[] = [
    {
      id: 'maps',
      icon: <Workflow size={16} />,
      label: 'マップ一覧',
      isActive: activeView === 'maps'
    },
    {
      id: 'search',
      icon: <Search size={16} />,
      label: '検索',
      isActive: activeView === 'search'
    },
    {
      id: 'attachments',
      icon: <Paperclip size={16} />,
      label: '添付ファイル',
      isActive: activeView === 'attachments'
    },
    {
      id: 'import',
      icon: <Download size={16} />,
      label: 'インポート',
      isActive: activeView === 'import'
    },
    {
      id: 'export',
      icon: <Upload size={16} />,
      label: 'エクスポート',
      isActive: activeView === 'export'
    },
    {
      id: 'ai',
      icon: <Bot size={16} />,
      label: 'AI設定',
      isActive: activeView === 'ai'
    },
    {
      id: 'settings',
      icon: <Settings size={16} />,
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
          onClick={onShowKeyboardHelper}
        >
          <span className="activity-bar-icon"><Keyboard size={16} /></span>
        </button>
      </div>
    </div>
  );
};

export default ActivityBar;