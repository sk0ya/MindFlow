import { MindMapData } from '../../../../shared/types/dataTypes';

/**
 * アプリケーション操作関連のハンドラーを管理するカスタムフック
 */

interface AppActionsParams {
  data: MindMapData | null;
  saveMindMap: () => Promise<void>;
  exportMindMapAsJSON: (data: MindMapData | null) => void;
  importMindMapFromJSON: (file: File) => Promise<void>;
}

interface AppActionsReturn {
  handleExport: () => void;
  handleImport: (file: File) => Promise<void>;
  handleSave: () => Promise<void>;
  showSaveMessage: () => void;
}

export const useAppActions = (
  data: MindMapData | null,
  saveMindMap: () => Promise<void>,
  exportMindMapAsJSON: (data: MindMapData | null) => void,
  importMindMapFromJSON: (file: File) => Promise<void>
): AppActionsReturn => {
  const handleExport = () => {
    exportMindMapAsJSON(data);
  };

  const handleImport = async (file: File): Promise<void> => {
    try {
      await importMindMapFromJSON(file);
      window.location.reload();
    } catch (error) {
      alert('ファイルの読み込みに失敗しました: ' + error.message);
    }
  };

  const showSaveMessage = (): void => {
    const saveMessage = document.createElement('div');
    saveMessage.textContent = '保存完了！';
    saveMessage.className = 'save-message';
    document.body.appendChild(saveMessage);
    setTimeout(() => saveMessage.remove(), 3000);
  };

  const handleSave = async (): Promise<void> => {
    await saveMindMap();
    showSaveMessage();
  };

  return {
    handleExport,
    handleImport,
    handleSave,
    showSaveMessage
  };
};