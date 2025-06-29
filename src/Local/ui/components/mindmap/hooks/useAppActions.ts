import type { MindMapData } from '../../../../../shared/types/app.js';

/**
 * アプリケーション操作関連のハンドラーを管理するカスタムフック
 */
export const useAppActions = (
  data: MindMapData | null,
  saveMindMap: () => Promise<void>,
  exportMindMapAsJSON: (data: MindMapData | null) => void,
  importMindMapFromJSON: (file: File) => Promise<void>
) => {
  const handleExport = () => {
    exportMindMapAsJSON(data);
  };

  const handleImport = async (file: File) => {
    try {
      await importMindMapFromJSON(file);
      window.location.reload();
    } catch (error) {
      alert('ファイルの読み込みに失敗しました: ' + error.message);
    }
  };

  const showSaveMessage = () => {
    const saveMessage = document.createElement('div');
    saveMessage.textContent = '保存完了！';
    saveMessage.className = 'save-message';
    document.body.appendChild(saveMessage);
    setTimeout(() => saveMessage.remove(), 3000);
  };

  const handleSave = async () => {
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