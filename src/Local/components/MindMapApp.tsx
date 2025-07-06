import React from 'react';
import AdvancedMindMapApp from '../ui/components/mindmap/MindMapApp';

/**
 * LocalApp - ローカルモードのマインドマップアプリケーション
 * 
 * LocalEngineを使用してlocalStorageにデータを保存します。
 * ローカルモード専用で、クラウド機能は一切含まれません。
 */
const LocalApp: React.FC = () => {
  return <AdvancedMindMapApp />;
};

export default LocalApp;