import React from 'react';
import AdvancedMindMapApp from '../ui/components/mindmap/MindMapApp';

type StorageMode = 'local' | 'cloud';

interface Props {
  onModeChange: (mode: StorageMode) => void;
}

/**
 * LocalApp - ローカルモードのマインドマップアプリケーション
 * 
 * LocalEngineを使用してlocalStorageにデータを保存します。
 * IndexedDBは使用せず、統一されたストレージアプローチを採用しています。
 */
const LocalApp: React.FC<Props> = ({ onModeChange }) => {
  // 高度な実装（LocalEngine使用）を直接使用
  return <AdvancedMindMapApp onModeChange={onModeChange} />;
};

export default LocalApp;