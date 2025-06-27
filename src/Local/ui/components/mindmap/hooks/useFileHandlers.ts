import { useState } from 'react';

/**
 * ファイル関連のステートとハンドラーを管理するカスタムフック
 */
export const useFileHandlers = (
  attachFileToNode,
  removeFileFromNode,
  renameFileInNode,
  downloadFile
) => {
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [showFileActionMenu, setShowFileActionMenu] = useState(false);
  const [fileActionMenuPosition, setFileActionMenuPosition] = useState({ x: 0, y: 0 });
  const [actionMenuFile, setActionMenuFile] = useState(null);
  const [actionMenuNodeId, setActionMenuNodeId] = useState(null);

  const handleCloseAllPanels = () => {
    setShowImageModal(false);
    setShowFileActionMenu(false);
  };

  const handleShowImageModal = (image) => {
    setModalImage(image);
    setShowImageModal(true);
    handleCloseAllPanels();
    setShowImageModal(true); // 再度trueにして画像モーダルだけ表示
  };

  const handleCloseImageModal = () => {
    setShowImageModal(false);
    setModalImage(null);
  };

  const handleShowFileActionMenu = (file, nodeId, position) => {
    setActionMenuFile(file);
    setActionMenuNodeId(nodeId);
    setFileActionMenuPosition(position);
    setShowFileActionMenu(true);
    handleCloseAllPanels();
    setShowFileActionMenu(true); // 再度trueにしてファイルアクションメニューだけ表示
  };

  const handleCloseFileActionMenu = () => {
    setShowFileActionMenu(false);
    setActionMenuFile(null);
    setActionMenuNodeId(null);
  };

  const handleFileDownload = async (file) => {
    try {
      await downloadFile(file);
    } catch (error) {
      console.error('ファイルダウンロードエラー:', error);
      alert('ファイルのダウンロードに失敗しました: ' + error.message);
    }
  };

  const handleFileRename = (fileId, newName) => {
    try {
      renameFileInNode(actionMenuNodeId, fileId, newName);
    } catch (error) {
      console.error('ファイル名変更エラー:', error);
      alert('ファイル名の変更に失敗しました: ' + error.message);
    }
  };

  const handleFileDelete = (fileId) => {
    try {
      removeFileFromNode(actionMenuNodeId, fileId);
    } catch (error) {
      console.error('ファイル削除エラー:', error);
      alert('ファイルの削除に失敗しました: ' + error.message);
    }
  };

  const handleFileUpload = async (nodeId, files) => {
    if (!files || files.length === 0) return;
    
    try {
      const file = files[0]; // 最初のファイルのみ処理
      await attachFileToNode(nodeId, file);
    } catch (error) {
      console.error('ファイルアップロードエラー:', error);
      alert('ファイルのアップロードに失敗しました: ' + error.message);
    }
  };
  
  const handleRemoveFile = (nodeId, fileId) => {
    try {
      removeFileFromNode(nodeId, fileId);
    } catch (error) {
      console.error('ファイル削除エラー:', error);
      alert('ファイルの削除に失敗しました: ' + error.message);
    }
  };

  return {
    // State
    showImageModal,
    modalImage,
    showFileActionMenu,
    fileActionMenuPosition,
    actionMenuFile,
    actionMenuNodeId,
    
    // Handlers
    handleShowImageModal,
    handleCloseImageModal,
    handleShowFileActionMenu,
    handleCloseFileActionMenu,
    handleFileDownload,
    handleFileRename,
    handleFileDelete,
    handleFileUpload,
    handleRemoveFile,
    
    // Utility
    handleCloseAllPanels
  };
};