import React from 'react';

const NotesSidebar: React.FC = () => {
  return (
    <div className="notes-sidebar">
      <div className="notes-content">
        <div className="notes-empty-state">
          <div className="notes-empty-icon">📝</div>
          <div className="notes-empty-title">ノート機能</div>
          <div className="notes-empty-description">
            ノート機能は今後実装予定です。<br />
            現在は右側のノートパネルをご利用ください。
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesSidebar;