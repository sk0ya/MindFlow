import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
import './ImportModal.css';
import { MarkdownFileImporter, ImportOptions, ImportResult } from '../../../../shared/utils/importUtils';
import type { MindMapData } from '../../../../shared/types/dataTypes';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (data: MindMapData, warnings?: string[]) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    replaceMap: true,
    category: '',
    title: ''
  });
  const [isImporting, setIsImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      
      // ファイル名からタイトルを自動設定
      if (!importOptions.title) {
        const fileName = file.name;
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
        setImportOptions(prev => ({ ...prev, title: nameWithoutExt }));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      alert('ファイルを選択してください');
      return;
    }

    setIsImporting(true);
    try {
      // マークダウンファイルから新規マップを作成
      const result: ImportResult = await MarkdownFileImporter.importMarkdownFile(
        selectedFile,
        importOptions
      );

      if (result.success && result.data) {
        onImportSuccess(result.data, result.warnings);
        onClose();
        // Reset state
        setSelectedFile(null);
        setImportOptions({
          replaceMap: true,
          category: '',
          title: ''
        });
      } else {
        alert(result.error || 'インポートに失敗しました');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert(`インポート中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const getSupportedFormats = () => [
    {
      name: 'Markdown',
      extensions: '.md, .markdown',
      description: '見出し(#)がノードになり、見出し以外はノートになります。階層が飛んでいる場合は自動で空ノードを補完します。'
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="import-modal-overlay" onClick={onClose}>
      <div className="import-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="import-modal-header">
          <h2>ファイルをインポート</h2>
          <button className="import-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="import-modal-body">
          {/* ファイル選択エリア */}
          <div className="import-file-section">
            <h3>ファイル選択</h3>
            <div 
              className={`file-drop-zone ${dragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown"
                onChange={(e) => handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
              />
              
              {selectedFile ? (
                <div className="selected-file-info">
                  <div className="file-icon">📄</div>
                  <div className="file-details">
                    <div className="file-name">{selectedFile.name}</div>
                    <div className="file-size">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button 
                    className="remove-file"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
<X size={16} />
                  </button>
                </div>
              ) : (
                <div className="drop-zone-content">
                  <div className="drop-icon">📁</div>
                  <div className="drop-text">
                    <div>ファイルをドラッグ＆ドロップ</div>
                    <div>または、クリックして選択</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* サポート形式 */}
          <div className="supported-formats-section">
            <h3>サポート形式</h3>
            <div className="format-list">
              {getSupportedFormats().map((format, index) => (
                <div key={index} className="format-item">
                  <div className="format-header">
                    <span className="format-name">{format.name}</span>
                    <span className="format-extensions">{format.extensions}</span>
                  </div>
                  <div className="format-description">{format.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* インポートオプション */}
          <div className="import-options-section">
            <h3>インポートオプション</h3>
            <div className="import-options">
              <div className="import-info">
                <div className="info-icon">ℹ️</div>
                <div>インポートしたファイルから新しいマップを作成します</div>
              </div>

              <div className="import-option">
                <label>
                  タイトル:
                  <input
                    type="text"
                    value={importOptions.title || ''}
                    onChange={(e) => setImportOptions(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="マップのタイトル"
                    className="title-input"
                  />
                </label>
              </div>

              <div className="import-option">
                <label>
                  カテゴリ:
                  <input
                    type="text"
                    value={importOptions.category}
                    onChange={(e) => setImportOptions(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="カテゴリ"
                    className="category-input"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="import-modal-footer">
          <button 
            className="import-button-cancel" 
            onClick={onClose}
            disabled={isImporting}
          >
            キャンセル
          </button>
          <button 
            className="import-button-confirm" 
            onClick={handleImport}
            disabled={isImporting || !selectedFile}
          >
            {isImporting ? 'インポート中...' : 'インポート'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;