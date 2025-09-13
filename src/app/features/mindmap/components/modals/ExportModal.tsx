import React, { useState } from 'react';
import { X, FileText, File, Folder, BookOpen, Lightbulb } from 'lucide-react';
import './ExportModal.css';
import { exportToZip } from '../../../../shared/utils/exportUtils';
import type { MindMapData } from '../../../../shared/types/dataTypes';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mindMapData: MindMapData;
}

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  mindMapData
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // デフォルトファイル名を生成
      const defaultFilename = mindMapData.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]/g, '_') || 'mindmap';
      
      await exportToZip(mindMapData, defaultFilename);
      // 少し遅延を入れてUI的な feedback を提供
      await new Promise(resolve => setTimeout(resolve, 500));
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      alert(`エクスポート中にエラーが発生しました: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal-header">
          <h2>マップをエクスポート</h2>
          <button className="export-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="export-modal-body">
          <div className="export-info-section">
            <h3>エクスポート内容</h3>
            <div className="export-info">
              <p>ZIP形式でマップデータ、添付ファイル、ノートを一括保存します。</p>
              <ul>
                <li><File size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />マップ名.json: マップデータ</li>
                <li><FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />マップ名.md: Markdown形式のマップ</li>
                <li><Folder size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />attachments/: 添付ファイルとノート（ノードID別フォルダ構造）</li>
                <li><BookOpen size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />README.txt: ファイル構造の説明</li>
              </ul>
              <p className="save-info"><Lightbulb size={14} style={{ marginRight: '6px', verticalAlign: 'middle', color: '#facc15' }} />エクスポートボタンを押すと、ファイル保存ダイアログが表示されます。</p>
            </div>
          </div>
        </div>

        <div className="export-modal-footer">
          <button 
            className="export-button-cancel" 
            onClick={onClose}
            disabled={isExporting}
          >
            キャンセル
          </button>
          <button 
            className="export-button-confirm" 
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'エクスポート中...' : 'エクスポート'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;