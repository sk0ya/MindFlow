import type { MindMapData } from '../../../../shared/types';

/**
 * アプリケーション操作関連のハンドラーを管理するカスタムフック
 */
export const useAppActions = (data: MindMapData | null, saveMindMap: (data: MindMapData) => void) => {
  const handleExport = () => {
    if (!data) return;
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.title || 'mindmap'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      // Simple validation
      if (!importedData.rootNode || !importedData.title) {
        throw new Error('無効なマインドマップファイルです');
      }
      localStorage.setItem('mindflow_imported_data', JSON.stringify(importedData));
      window.location.reload();
    } catch (error) {
      alert('ファイルの読み込みに失敗しました: ' + (error instanceof Error ? error.message : String(error)));
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
    if (data) {
      await saveMindMap(data);
      showSaveMessage();
    }
  };

  return {
    handleExport,
    handleImport,
    handleSave,
    showSaveMessage
  };
};