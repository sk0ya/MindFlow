import React from 'react';
import { logger } from '../../../../shared/utils/logger';
import type { MindMapData, MindMapNode } from '@shared/types';

interface ImportExportManagerProps {
  store: any;
  addImportedMapToList?: (mapData: MindMapData) => Promise<void>;
  applyAutoLayout: () => void;
  showNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  handleError: (error: Error, context: string, operation: string) => void;
}

export const useImportExportManager = ({
  store,
  addImportedMapToList,
  applyAutoLayout,
  showNotification,
  handleError,
}: ImportExportManagerProps) => {
  
  // エクスポートハンドラー
  const handleExport = React.useCallback(() => {
    // Export functionality would be handled by the ExportModal
    return true;
  }, []);

  // マークダウンインポートハンドラー
  const handleImport = React.useCallback(() => {
    // Import functionality would be handled by the ImportModal
    return true;
  }, []);

  // インポート成功時のハンドラー
  const handleImportSuccess = React.useCallback(async (importedData: MindMapData, warnings?: string[]) => {
    try {
      logger.info('マークダウンインポートが成功しました', {
        title: importedData.title,
        nodeCount: countNodes(importedData.rootNode),
        warnings,
        rootNode: importedData.rootNode,
        rootNodeChildren: importedData.rootNode?.children?.length || 0
      });

      // インポートされたデータを直接ストアに設定
      logger.info('ストアにデータを設定中...', { 
        hasData: !!importedData, 
        hasRootNode: !!importedData?.rootNode,
        rootNodeText: importedData?.rootNode?.text 
      });
      store.setData(importedData);

      // マップをマップリストに追加（永続化）
      logger.info('マップリストに追加中...', { mapId: importedData.id, title: importedData.title });
      if (typeof addImportedMapToList === 'function') {
        await addImportedMapToList(importedData);
        logger.info('✅ マップリストに追加完了');
      } else {
        logger.warn('⚠️ addImportedMapToList関数が利用できません');
      }
      
      // 設定後の確認
      const currentData = store.data;
      logger.info('ストア設定後の確認', {
        currentTitle: currentData?.title,
        currentRootText: currentData?.rootNode?.text,
        currentChildrenCount: currentData?.rootNode?.children?.length || 0
      });

      // インポート後に自動整列を適用
      logger.info('インポート後の自動整列を適用中...');
      if (typeof applyAutoLayout === 'function') {
        applyAutoLayout();
        logger.info('✅ 自動整列が完了しました');
      } else {
        logger.warn('⚠️ applyAutoLayout関数が利用できません');
      }

      // 成功通知
      showNotification('success', `「${importedData.title}」をインポートしました`);
      
      // 警告がある場合は表示
      if (warnings && warnings.length > 0) {
        warnings.forEach(warning => {
          showNotification('warning', warning);
        });
      }
    } catch (error) {
      logger.error('インポート後の処理でエラーが発生しました:', error);
      handleError(error as Error, 'インポート処理', 'データ作成');
    }
  }, [store, addImportedMapToList, applyAutoLayout, showNotification, handleError]);

  // ノード数を数える補助関数
  const countNodes = React.useCallback((node: MindMapNode): number => {
    let count = 1; // 現在のノード
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }
    return count;
  }, []);

  return {
    handleExport,
    handleImport,
    handleImportSuccess,
  };
};