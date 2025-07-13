import { useCallback } from 'react';
import { useMindMapStore } from '../store/mindMapStore';
import type { MindMapNode, Position } from '@shared/types';
import type { ImageFile } from '@local/shared/types';

/**
 * UI状態管理に特化したHook
 * パネル、モーダル、ビューポート等のUI制御を担当
 */
export const useMindMapUI = () => {
  const store = useMindMapStore();

  const uiOperations = {
    // ズームとパン
    setZoom: useCallback((zoom: number) => {
      store.setZoom(zoom);
    }, [store]),

    setPan: useCallback((pan: Position | ((prev: Position) => Position)) => {
      if (typeof pan === 'function') {
        store.setPan(pan(store.ui.pan));
      } else {
        store.setPan(pan);
      }
    }, [store]),

    resetZoom: useCallback(() => {
      store.resetZoom();
    }, [store]),

    // パネル管理
    setShowCustomizationPanel: useCallback((show: boolean) => {
      store.setShowCustomizationPanel(show);
    }, [store]),

    closeAllPanels: useCallback(() => {
      store.closeAllPanels();
    }, [store]),

    // サイドバー
    toggleSidebar: useCallback(() => {
      store.toggleSidebar();
    }, [store]),

    setSidebarCollapsed: useCallback((collapsed: boolean) => {
      store.setSidebarCollapsed(collapsed);
    }, [store]),

    // モーダル制御
    showImageModal: useCallback((image: ImageFile) => {
      store.setSelectedImage(image);
      store.setShowImageModal(true);
    }, [store]),

    hideImageModal: useCallback(() => {
      store.setShowImageModal(false);
    }, [store]),

    // カスタマイズパネル
    showCustomization: useCallback((_node: MindMapNode, position: Position) => {
      store.showCustomization(position);
    }, [store]),

    // ノードマップリンクパネル
    showNodeMapLinks: useCallback((node: MindMapNode, position: Position) => {
      store.showNodeMapLinks(node, position);
    }, [store]),

    closeNodeMapLinksPanel: useCallback(() => {
      store.closeNodeMapLinksPanel();
    }, [store]),

    // ファイルアクションメニュー
    showFileActionMenu: useCallback((fileAttachment: any, position: Position) => {
      store.setSelectedFile(fileAttachment);
      store.setFileMenuPosition(position);
      store.setShowFileActionMenu(true);
    }, [store]),

    hideFileActionMenu: useCallback(() => {
      store.setShowFileActionMenu(false);
    }, [store])
  };

  return {
    // UI状態
    ui: store.ui,
    
    // 操作
    ...uiOperations
  };
};