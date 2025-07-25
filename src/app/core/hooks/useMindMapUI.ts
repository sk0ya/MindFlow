import { useCallback } from 'react';
import { useMindMapStore } from '../store/mindMapStore';
import type { MindMapNode, Position, FileAttachment } from '@shared/types';
import type { ImageFile } from '../../shared/types';

/**
 * UI状態管理に特化したHook
 * パネル、モーダル、ビューポート等のUI制御を担当
 */
export const useMindMapUI = () => {
  const {
    setZoom,
    setPan: storeSetPan,
    resetZoom,
    setShowCustomizationPanel,
    closeAllPanels,
    toggleSidebar,
    setSidebarCollapsed,
    setSelectedImage,
    setShowImageModal,
    showCustomization,
    showNodeMapLinks,
    closeNodeMapLinksPanel,
    setSelectedFile,
    setFileMenuPosition,
    setShowFileActionMenu,
    ui
  } = useMindMapStore();

  const uiOperations = {
    // ズームとパン
    setZoom: useCallback((zoom: number) => {
      setZoom(zoom);
    }, [setZoom]),

    setPan: useCallback((pan: Position | ((prev: Position) => Position)) => {
      if (typeof pan === 'function') {
        storeSetPan(pan(ui.pan));
      } else {
        storeSetPan(pan);
      }
    }, [storeSetPan, ui.pan]),

    resetZoom: useCallback(() => {
      resetZoom();
    }, [resetZoom]),

    // パネル管理
    setShowCustomizationPanel: useCallback((show: boolean) => {
      setShowCustomizationPanel(show);
    }, [setShowCustomizationPanel]),

    closeAllPanels: useCallback(() => {
      closeAllPanels();
    }, [closeAllPanels]),

    // サイドバー
    toggleSidebar: useCallback(() => {
      toggleSidebar();
    }, [toggleSidebar]),

    setSidebarCollapsed: useCallback((collapsed: boolean) => {
      setSidebarCollapsed(collapsed);
    }, [setSidebarCollapsed]),

    // モーダル制御
    showImageModal: useCallback((image: ImageFile) => {
      setSelectedImage(image);
      setShowImageModal(true);
    }, [setSelectedImage, setShowImageModal]),

    hideImageModal: useCallback(() => {
      setShowImageModal(false);
    }, [setShowImageModal]),

    // カスタマイズパネル
    showCustomization: useCallback((_node: MindMapNode, position: Position) => {
      showCustomization(position);
    }, [showCustomization]),

    // ノードマップリンクパネル
    showNodeMapLinks: useCallback((node: MindMapNode, position: Position) => {
      showNodeMapLinks(node, position);
    }, [showNodeMapLinks]),

    closeNodeMapLinksPanel: useCallback(() => {
      closeNodeMapLinksPanel();
    }, [closeNodeMapLinksPanel]),

    // ファイルアクションメニュー
    showFileActionMenu: useCallback((fileAttachment: FileAttachment, position: Position) => {
      setSelectedFile(fileAttachment);
      setFileMenuPosition(position);
      setShowFileActionMenu(true);
    }, [setSelectedFile, setFileMenuPosition, setShowFileActionMenu]),

    hideFileActionMenu: useCallback(() => {
      setShowFileActionMenu(false);
    }, [setShowFileActionMenu])
  };

  return {
    // UI状態
    ui,
    
    // 操作
    ...uiOperations
  };
};