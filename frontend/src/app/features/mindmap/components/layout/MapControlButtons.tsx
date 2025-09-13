import React from 'react';
import { Workflow, FolderPlus, Plus, Minus } from 'lucide-react';

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
<Workflow size={16} />
      </button>
      
      <button 
        className="control-button add-folder"
        onClick={onAddFolder}
        title="フォルダ追加"
      >
        <FolderPlus size={16} />
      </button>
      
      <button 
        className="control-button expand-all"
        onClick={onExpandAll}
        title="すべて展開"
      >
        <Plus size={16} />
      </button>
      
      <button 
        className="control-button collapse-all"
        onClick={onCollapseAll}
        title="すべて折りたたみ"
      >
        <Minus size={16} />
      </button>
    </div>
  );
};

export default MapControlButtons;