import React from 'react';
import MindMapSidebar from './MindMapSidebar';
import NotesSidebar from './NotesSidebar';
import SettingsSidebar from './SettingsSidebar';
import type { MindMapData } from '../../../../shared/types';
import './PrimarySidebar.css';

interface PrimarySidebarProps {
  activeView: string | null;
  isVisible: boolean;
  // Maps view props
  mindMaps?: MindMapData[];
  currentMapId?: string | null;
  onSelectMap?: (mapId: string) => void;
  onCreateMap?: (title: string, category?: string) => void;
  onDeleteMap?: (mapId: string) => void;
  onRenameMap?: (mapId: string, newTitle: string) => void;
  onChangeCategory?: (mapId: string, category: string) => void;
  onChangeCategoryBulk?: (mapUpdates: Array<{id: string, category: string}>) => Promise<void>;
  availableCategories?: string[];
  // Settings props
  storageMode?: 'local' | 'cloud';
  onStorageModeChange?: (mode: 'local' | 'cloud') => void;
  onShowKeyboardHelper?: () => void;
  onAutoLayout?: () => void;
  onExport?: () => void;
  onImport?: () => void;
}

const PrimarySidebar: React.FC<PrimarySidebarProps> = ({
  activeView,
  isVisible,
  // Maps props
  mindMaps = [],
  currentMapId,
  onSelectMap,
  onCreateMap,
  onDeleteMap,
  onRenameMap,
  onChangeCategory,
  onChangeCategoryBulk,
  availableCategories = [],
  // Settings props
  storageMode,
  onStorageModeChange,
  onShowKeyboardHelper,
  onAutoLayout,
  onExport,
  onImport
}) => {
  if (!isVisible || !activeView) {
    return null;
  }

  const renderContent = () => {
    switch (activeView) {
      case 'maps':
        return (
          <MindMapSidebar
            mindMaps={mindMaps}
            currentMapId={currentMapId || null}
            onSelectMap={onSelectMap || (() => {})}
            onCreateMap={onCreateMap || (() => {})}
            onDeleteMap={onDeleteMap || (() => {})}
            onRenameMap={onRenameMap || (() => {})}
            onChangeCategory={onChangeCategory || (() => {})}
            onChangeCategoryBulk={onChangeCategoryBulk}
            availableCategories={availableCategories}
            isCollapsed={false}
            onToggleCollapse={undefined}
          />
        );
      
      case 'notes':
        return <NotesSidebar />;
      
      case 'settings':
        return (
          <SettingsSidebar
            storageMode={storageMode}
            onStorageModeChange={onStorageModeChange}
            onShowKeyboardHelper={onShowKeyboardHelper}
            onAutoLayout={onAutoLayout}
            onExport={onExport}
            onImport={onImport}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="primary-sidebar">      
      <div className="primary-sidebar-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default PrimarySidebar;