import { useState } from 'react';

// UI状態管理専用のカスタムフック
export const useUIState = () => {
  // 各種パネルとモーダルの表示状態
  const [showNodeCustomization, setShowNodeCustomization] = useState(false);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showFileActionMenu, setShowFileActionMenu] = useState(false);
  const [showMapList, setShowMapList] = useState(false);
  const [showNodeMapLinks, setShowNodeMapLinks] = useState(false);
  const [showLocalStorage, setShowLocalStorage] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showKeyboardHelper, setShowKeyboardHelper] = useState(false);
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);

  // コンテキストメニュー関連
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, nodeId: null });

  // 選択された画像とファイル情報
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileMenuPosition, setFileMenuPosition] = useState({ x: 0, y: 0 });

  // パネルを閉じる汎用関数
  const closeAllPanels = () => {
    setShowNodeCustomization(false);
    setShowLayoutPanel(false);
    setShowImageModal(false);
    setShowFileActionMenu(false);
    setShowMapList(false);
    setShowNodeMapLinks(false);
    setShowLocalStorage(false);
    setShowAuthModal(false);
    setShowTutorial(false);
    setShowKeyboardHelper(false);
    setShowPerformanceDashboard(false);
    setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
  };

  // パネル表示の切り替え関数
  const togglePanel = (panelName: string) => {
    const setters: Record<string, React.Dispatch<React.SetStateAction<boolean>>> = {
      nodeCustomization: setShowNodeCustomization,
      layoutPanel: setShowLayoutPanel,
      imageModal: setShowImageModal,
      fileActionMenu: setShowFileActionMenu,
      mapList: setShowMapList,
      nodeMapLinks: setShowNodeMapLinks,
      localStorage: setShowLocalStorage,
      authModal: setShowAuthModal,
      tutorial: setShowTutorial,
      keyboardHelper: setShowKeyboardHelper,
      performanceDashboard: setShowPerformanceDashboard
    };

    const setter = setters[panelName];
    if (setter) {
      setter((prev) => !prev);
    }
  };

  return {
    // 状態
    showNodeCustomization,
    showLayoutPanel,
    showImageModal,
    showFileActionMenu,
    showMapList,
    showNodeMapLinks,
    showLocalStorage,
    showAuthModal,
    showTutorial,
    showKeyboardHelper,
    showPerformanceDashboard,
    contextMenu,
    selectedImage,
    selectedFile,
    fileMenuPosition,

    // setter関数
    setShowNodeCustomization,
    setShowLayoutPanel,
    setShowImageModal,
    setShowFileActionMenu,
    setShowMapList,
    setShowNodeMapLinks,
    setShowLocalStorage,
    setShowAuthModal,
    setShowTutorial,
    setShowKeyboardHelper,
    setShowPerformanceDashboard,
    setContextMenu,
    setSelectedImage,
    setSelectedFile,
    setFileMenuPosition,

    // ユーティリティ関数
    closeAllPanels,
    togglePanel
  };
};