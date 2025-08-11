import React from 'react';

interface SidebarCollapsedProps {
  onToggleCollapse: () => void;
  onCreateMap: (title: string, category?: string) => void;
}

const SidebarCollapsed: React.FC<SidebarCollapsedProps> = ({
  onToggleCollapse,
  onCreateMap
}) => {
  const handleCreateCategory = () => {
    // eslint-disable-next-line no-alert
    const newCategory = prompt('新しいカテゴリー名を入力してください:', '');
    if (newCategory && newCategory.trim()) {
      // eslint-disable-next-line no-alert
      const mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
      if (mapName && mapName.trim()) {
        onCreateMap(mapName.trim(), newCategory.trim());
      }
    }
  };

  return (
    <div className="mindmap-sidebar collapsed">
      <button 
        className="sidebar-expand-toggle"
        onClick={onToggleCollapse}
        title="サイドバーを表示"
      >
        ▶
      </button>
      
      <div className="collapsed-actions">
        <button 
          className="action-button create"
          onClick={() => {
            // eslint-disable-next-line no-alert
            const mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
            if (mapName && mapName.trim()) {
              onCreateMap(mapName.trim());
            }
          }}
          title="新しいマインドマップ"
        >
          +
        </button>
        <button 
          className="action-button category"
          onClick={handleCreateCategory}
          title="新しいカテゴリー"
        >
          📁
        </button>
      </div>
    </div>
  );
};

export default SidebarCollapsed;