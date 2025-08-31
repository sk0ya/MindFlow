import React from 'react';

interface MapControlButtonsProps {
  onAddMap: () => void;
  onAddFolder: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const MapControlButtons: React.FC<MapControlButtonsProps> = ({
  onAddMap,
  onAddFolder,
  onExpandAll,
  onCollapseAll
}) => {
  return (
    <div className="map-control-buttons">
      <button 
        className="control-button add-map"
        onClick={onAddMap}
        title="マップ追加"
      >
        🗺️
      </button>
      
      <button 
        className="control-button add-folder"
        onClick={onAddFolder}
        title="フォルダ追加"
      >
        📁
      </button>
      
      <button 
        className="control-button expand-all"
        onClick={onExpandAll}
        title="すべて展開"
      >
        ➕
      </button>
      
      <button 
        className="control-button collapse-all"
        onClick={onCollapseAll}
        title="すべて折りたたみ"
      >
        ➖
      </button>
    </div>
  );
};

export default MapControlButtons;