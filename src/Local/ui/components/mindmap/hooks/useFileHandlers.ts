import { useState } from 'react';
import { FileHandlerParams, FileHandlers } from './handlerTypes';
import { FileAttachment, Position } from '../../../../shared/types/dataTypes';

/**
 * ファイル関連のステートとハンドラーを管理するカスタムフック
 */
export const useFileHandlers = ({
  attachFileToNode,
  removeFileFromNode,
  renameFileInNode,
  downloadFile
}: FileHandlerParams): FileHandlers => {
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [modalImage, setModalImage] = useState<FileAttachment | null>(null);
  const [showFileActionMenu, setShowFileActionMenu] = useState<boolean>(false);
  const [fileActionMenuPosition, setFileActionMenuPosition] = useState<Position>({ x: 0, y: 0 });
  const [actionMenuFile, setActionMenuFile] = useState<FileAttachment | null>(null);
  const [actionMenuNodeId, setActionMenuNodeId] = useState<string | null>(null);

  const handleCloseAllPanels = (): void => {
    setShowImageModal(false);
    setShowFileActionMenu(false);
  };

  const handleShowImageModal = (image: FileAttachment): void => {
    setModalImage(image);
    setShowImageModal(true);
    handleCloseAllPanels();
    setShowImageModal(true); // 再度trueにして画像モーダルだけ表示
  };

  const handleCloseImageModal = (): void => {
    setShowImageModal(false);
    setModalImage(null);
  };

  const handleShowFileActionMenu = (file: FileAttachment, nodeId: string, position: Position): void => {
    setActionMenuFile(file);
    setActionMenuNodeId(nodeId);
    setFileActionMenuPosition(position);
    setShowFileActionMenu(true);
    handleCloseAllPanels();
    setShowFileActionMenu(true); // 再度trueにしてファイルアクションメニューだけ表示
  };

  const handleCloseFileActionMenu = (): void => {
    setShowFileActionMenu(false);
    setActionMenuFile(null);
    setActionMenuNodeId(null);
  };

  const handleFileDownload = async (file: FileAttachment): Promise<void> => {
    try {
      await downloadFile(file);
    } catch (error) {
      console.error('ファイルダウンロードエラー:', error);
      alert('ファイルのダウンロードに失敗しました: ' + (error as Error).message);
    }
  };

  const handleFileRename = (fileId: string, newName: string): void => {
    try {
      if (actionMenuNodeId) {
        renameFileInNode(actionMenuNodeId, fileId, newName);
      }
    } catch (error) {
      console.error('ファイル名変更エラー:', error);
      alert('ファイル名の変更に失敗しました: ' + (error as Error).message);
    }
  };

  const handleFileDelete = (fileId: string): void => {
    try {
      if (actionMenuNodeId) {
        removeFileFromNode(actionMenuNodeId, fileId);
      }
    } catch (error) {
      console.error('ファイル削除エラー:', error);
      alert('ファイルの削除に失敗しました: ' + (error as Error).message);
    }
  };

  const handleFileUpload = async (nodeId: string, files: FileList): Promise<void> => {
    if (!files || files.length === 0) return;
    
    try {
      const file = files[0]; // 最初のファイルのみ処理
      if (file) {
        await attachFileToNode(nodeId, file);
      }
    } catch (error) {
      console.error('ファイルアップロードエラー:', error);
      alert('ファイルのアップロードに失敗しました: ' + (error as Error).message);
    }
  };
  
  const handleRemoveFile = (nodeId: string, fileId: string): void => {
    try {
      removeFileFromNode(nodeId, fileId);
    } catch (error) {
      console.error('ファイル削除エラー:', error);
      alert('ファイルの削除に失敗しました: ' + (error as Error).message);
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