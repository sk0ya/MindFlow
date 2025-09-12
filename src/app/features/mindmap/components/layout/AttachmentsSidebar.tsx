import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useMindMapStore } from '../../../../core';
import { useMindMapPersistence } from '../../../../core/hooks/useMindMapPersistence';
import type { FileAttachment, MindMapNode } from '../../../../shared/types';
import './AttachmentsSidebar.css';

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  nodeId: string;
  nodeTitle: string;
  mapId: string;
  mapTitle: string;
  isReferenced: boolean;
}

interface AttachmentsSidebarProps {
  isVisible: boolean;
}

const AttachmentsSidebar: React.FC<AttachmentsSidebarProps> = ({ isVisible }) => {
  const { data: mindMapData } = useMindMapStore();
  const { allMindMaps, storageAdapter } = useMindMapPersistence();
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showUnreferencedOnly, setShowUnreferencedOnly] = useState(false);

  // ヘルパー関数：マップ内のノードを検索
  const findNodeInMap = useCallback((node: MindMapNode, targetNodeId: string): MindMapNode | null => {
    if (node.id === targetNodeId) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const result = findNodeInMap(child, targetNodeId);
        if (result) return result;
      }
    }
    
    return null;
  }, []);

  // ヘルパー関数：ファイルが参照されているかチェック
  const checkIfFileIsReferenced = useCallback((fileInfo: any, currentMapData?: any, allMapsData?: any[]): boolean => {
    const fileId = fileInfo.id;
    const mapId = fileInfo.mindmapId;
    const nodeId = fileInfo.nodeId;

    // 現在のマップで検索
    if (currentMapData && currentMapData.id === mapId) {
      const node = findNodeInMap(currentMapData.rootNode, nodeId);
      if (node && node.attachments) {
        return node.attachments.some((att: FileAttachment) => att.id === fileId);
      }
    }

    // 他のマップで検索
    if (allMapsData) {
      const targetMap = allMapsData.find((map: any) => map.id === mapId);
      if (targetMap) {
        const node = findNodeInMap(targetMap.rootNode, nodeId);
        if (node && node.attachments) {
          return node.attachments.some((att: FileAttachment) => att.id === fileId);
        }
      }
    }

    return false; // 参照が見つからない場合は未参照
  }, [findNodeInMap]);

  // ノードからファイル添付情報を収集する関数
  const collectAttachmentsFromNode = useCallback((node: MindMapNode, mapId: string, mapTitle: string): AttachedFile[] => {
    const files: AttachedFile[] = [];
    
    // デバッグログ
    console.log(`Checking node ${node.id}:`, {
      hasAttachments: !!node.attachments,
      attachmentsCount: node.attachments?.length || 0,
      attachments: node.attachments
    });
    
    if (node.attachments && node.attachments.length > 0) {
      node.attachments.forEach((attachment: FileAttachment) => {
        console.log(`Found attachment:`, attachment);
        files.push({
          id: attachment.id,
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
          uploadedAt: (attachment as any).uploadedAt || (attachment as any).createdAt || new Date().toISOString(),
          nodeId: node.id,
          nodeTitle: node.text || 'Node ' + node.id.slice(-6),
          mapId,
          mapTitle,
          isReferenced: true // ノードに添付されているので参照されている
        });
      });
    }

    // 子ノードも再帰的にチェック
    if (node.children && node.children.length > 0) {
      console.log(`Checking ${node.children.length} children of node ${node.id}`);
      node.children.forEach(child => {
        files.push(...collectAttachmentsFromNode(child, mapId, mapTitle));
      });
    }

    return files;
  }, []);

  // 全マップから添付ファイル一覧を収集
  const loadAllAttachments = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const allFiles: AttachedFile[] = [];

      // クラウドモードでstorageAdapterが利用可能な場合は、直接APIから全ファイル情報を取得
      if (storageAdapter && typeof (storageAdapter as any).getAllFiles === 'function') {
        console.log('Loading files from cloud storage adapter');
        try {
          const cloudFiles = await (storageAdapter as any).getAllFiles();
          console.log(`Found ${cloudFiles.length} files from cloud API:`, cloudFiles);
          
          // CloudのFileInfo[]をAttachedFile[]に変換
          const convertedFiles: AttachedFile[] = cloudFiles.map((fileInfo: any) => {
            // マップデータから該当するマップ情報を検索
            let mapTitle = 'Cloud Map';
            let nodeTitle = `Node ${(fileInfo.nodeId || 'unknown').slice(-6)}`;
            
            // 現在のマップから検索
            if (mindMapData && fileInfo.mindmapId === mindMapData.id) {
              mapTitle = mindMapData.title;
              const node = findNodeInMap(mindMapData.rootNode, fileInfo.nodeId);
              if (node) {
                nodeTitle = node.text || nodeTitle;
              }
            } else if (allMindMaps) {
              // 他のマップから検索
              const targetMap = allMindMaps.find(map => map.id === fileInfo.mindmapId);
              if (targetMap) {
                mapTitle = targetMap.title;
                const node = findNodeInMap(targetMap.rootNode, fileInfo.nodeId);
                if (node) {
                  nodeTitle = node.text || nodeTitle;
                }
              }
            }
            
            return {
              id: fileInfo.id,
              name: fileInfo.name,
              size: fileInfo.size,
              type: fileInfo.type || 'application/octet-stream',
              uploadedAt: fileInfo.uploadedAt || new Date().toISOString(),
              nodeId: fileInfo.nodeId || 'unknown',
              nodeTitle,
              mapId: fileInfo.mindmapId || 'unknown',
              mapTitle,
              isReferenced: checkIfFileIsReferenced(fileInfo, mindMapData, allMindMaps)
            };
          });
          
          allFiles.push(...convertedFiles);
        } catch (cloudError) {
          console.warn('Failed to load files from cloud API:', cloudError);
          // フォールバックとしてローカルファイル収集を実行
        }
      }
      
      // ローカルモードまたはクラウドAPI失敗時のフォールバック - マップデータから収集
      if (allFiles.length === 0) {
        // 現在のマップから収集
        if (mindMapData) {
          console.log('Loading attachments from current mindMapData:', mindMapData);
          console.log('Root node:', mindMapData.rootNode);
          
          const currentMapFiles = collectAttachmentsFromNode(
            mindMapData.rootNode, 
            mindMapData.id, 
            mindMapData.title
          );
          console.log(`Found ${currentMapFiles.length} files in current map`);
          allFiles.push(...currentMapFiles);
        } else {
          console.log('No current mindMapData available');
        }

        // すべてのマップから収集
        console.log('Available allMindMaps:', allMindMaps);
        if (allMindMaps && allMindMaps.length > 0) {
          allMindMaps.forEach((map, index) => {
            console.log(`Processing map ${index + 1}/${allMindMaps.length}: ${map.title} (${map.id})`);
            // 現在のマップは既に処理済みなのでスキップ
            if (mindMapData && map.id === mindMapData.id) {
              console.log('Skipping current map (already processed)');
              return;
            }
            
            const mapFiles = collectAttachmentsFromNode(
              map.rootNode,
              map.id,
              map.title
            );
            console.log(`Found ${mapFiles.length} files in map "${map.title}"`);
            allFiles.push(...mapFiles);
          });
        } else {
          console.log('No allMindMaps available or empty array');
        }
      }

      console.log(`Total files found: ${allFiles.length}`, allFiles);
      
      setAttachedFiles(allFiles);
    } catch (err) {
      console.error('Error loading attachments:', err);
      setError(err instanceof Error ? err.message : '添付ファイル一覧の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [mindMapData, allMindMaps, storageAdapter, collectAttachmentsFromNode, findNodeInMap, checkIfFileIsReferenced]);

  // 初期化時と依存関係変更時に読み込み
  useEffect(() => {
    if (isVisible) {
      loadAllAttachments();
    }
  }, [isVisible, loadAllAttachments, storageAdapter, mindMapData, allMindMaps]);
  
  // ストレージモード変更時のクリア処理
  useEffect(() => {
    // ストレージアダプタが変更された場合は一覧をクリア
    setAttachedFiles([]);
    setSelectedFiles(new Set());
    setError(null);
  }, [storageAdapter]);

  // フィルタリングされたファイル一覧
  const filteredFiles = useMemo(() => {
    if (showUnreferencedOnly) {
      return attachedFiles.filter(file => !file.isReferenced);
    }
    return attachedFiles;
  }, [attachedFiles, showUnreferencedOnly]);

  // 未参照ファイル数
  const unreferencedCount = useMemo(() => {
    return attachedFiles.filter(file => !file.isReferenced).length;
  }, [attachedFiles]);

  // ファイルサイズをフォーマット
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // ファイルダウンロード
  const handleDownloadFile = useCallback(async (file: AttachedFile) => {
    try {
      setLoading(true);

      // ストレージアダプターから取得
      if (storageAdapter && storageAdapter.downloadFile) {
        // クラウドモード - API経由でダウンロード
        const blob = await storageAdapter.downloadFile(file.mapId, file.nodeId, file.id);
        
        // Blobからダウンロードリンクを作成
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // ローカルモード - データURLから直接ダウンロード
        const attachmentData = findAttachmentById(file.id);
        if (attachmentData && attachmentData.dataURL) {
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = attachmentData.dataURL;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          throw new Error('ファイルデータが見つかりません');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ダウンロードに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [storageAdapter]);

  // ファイルIDから添付ファイル情報を検索
  const findAttachmentById = (fileId: string): FileAttachment | null => {
    const searchNode = (node: MindMapNode): FileAttachment | null => {
      if (node.attachments) {
        for (const attachment of node.attachments) {
          if (attachment.id === fileId) {
            return attachment;
          }
        }
      }
      if (node.children) {
        for (const child of node.children) {
          const result = searchNode(child);
          if (result) return result;
        }
      }
      return null;
    };

    // 現在のマップから検索
    if (mindMapData) {
      const result = searchNode(mindMapData.rootNode);
      if (result) return result;
    }

    // すべてのマップからも検索
    if (allMindMaps) {
      for (const map of allMindMaps) {
        const result = searchNode(map.rootNode);
        if (result) return result;
      }
    }

    return null;
  };

  // ファイル削除
  const handleDeleteFile = useCallback(async (file: AttachedFile) => {
    if (!confirm(`「${file.name}」を削除しますか？この操作は元に戻せません。`)) {
      return;
    }

    try {
      setLoading(true);

      // ファイル削除
      if (storageAdapter && storageAdapter.deleteFile) {
        // クラウドモード - API経由で削除
        await storageAdapter.deleteFile(file.mapId, file.nodeId, file.id);
      }

      // ローカルの状態からも削除（実際のマップデータ更新は別途必要）
      // TODO: マップデータからも添付ファイルを削除する処理を実装
      
      // 一覧を再読み込み
      await loadAllAttachments();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [loadAllAttachments, storageAdapter]);

  // 選択されたファイルを削除
  const handleDeleteSelectedFiles = useCallback(async () => {
    if (selectedFiles.size === 0) return;

    if (!confirm(`選択された${selectedFiles.size}個のファイルを削除しますか？この操作は元に戻せません。`)) {
      return;
    }

    try {
      setLoading(true);
      
      const filesToDelete = filteredFiles.filter(file => selectedFiles.has(file.id));
      
      // ファイル削除処理
      for (const file of filesToDelete) {
        if (storageAdapter && storageAdapter.deleteFile) {
          await storageAdapter.deleteFile(file.mapId, file.nodeId, file.id);
        }
      }
      
      // 一覧を再読み込み
      await loadAllAttachments();
      
      setSelectedFiles(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : '一括削除に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [selectedFiles, filteredFiles, storageAdapter, loadAllAttachments]);

  // 未参照ファイル一括削除
  const handleDeleteUnreferencedFiles = useCallback(async () => {
    const unreferencedFiles = attachedFiles.filter(file => !file.isReferenced);
    
    if (unreferencedFiles.length === 0) {
      alert('削除対象の未参照ファイルがありません。');
      return;
    }

    if (!confirm(`${unreferencedFiles.length}個の未参照ファイルを削除しますか？この操作は元に戻せません。`)) {
      return;
    }

    try {
      setLoading(true);
      
      for (const file of unreferencedFiles) {
        if (storageAdapter && storageAdapter.deleteFile) {
          await storageAdapter.deleteFile(file.mapId, file.nodeId, file.id);
        }
      }
      
      // 一覧を再読み込み
      await loadAllAttachments();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '未参照ファイル一括削除に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [attachedFiles, storageAdapter, loadAllAttachments]);

  // チェックボックス変更ハンドラ
  const handleFileSelect = useCallback((fileId: string, selected: boolean) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(fileId);
      } else {
        newSet.delete(fileId);
      }
      return newSet;
    });
  }, []);


  if (!isVisible) {
    return null;
  }

  return (
    <div className="attachments-sidebar">
      <div className="attachments-header">
        <h3 className="attachments-title">添付ファイル</h3>
        <div className="attachments-controls">
          <button
            className="refresh-button"
            onClick={loadAllAttachments}
            disabled={loading}
          >
            🔄
          </button>
        </div>
      </div>

      {error && (
        <div className="attachments-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="attachments-stats">
        <div className="stats-item">
          <span className="stats-label">総ファイル数:</span>
          <span className="stats-value">{attachedFiles.length}</span>
        </div>
        {unreferencedCount > 0 && (
          <div className="stats-item unreferenced">
            <span className="stats-label">未参照:</span>
            <span className="stats-value">{unreferencedCount}</span>
          </div>
        )}
      </div>

      <div className="attachments-filters">
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={showUnreferencedOnly}
            onChange={(e) => setShowUnreferencedOnly(e.target.checked)}
          />
          未参照ファイルのみ表示
        </label>
      </div>

      {filteredFiles.length > 0 && (
        <div className="attachments-actions">
          {selectedFiles.size > 0 && (
            <button
              className="delete-selected-button"
              onClick={handleDeleteSelectedFiles}
              disabled={loading}
            >
              選択項目を削除 ({selectedFiles.size})
            </button>
          )}
          
          {unreferencedCount > 0 && (
            <button
              className="delete-unreferenced-button"
              onClick={handleDeleteUnreferencedFiles}
              disabled={loading}
            >
              未参照ファイルを一括削除
            </button>
          )}
        </div>
      )}

      <div className="attachments-list">
        {loading && (
          <div className="attachments-loading">
            読み込み中...
          </div>
        )}

        {!loading && filteredFiles.length === 0 && (
          <div className="attachments-empty">
            {showUnreferencedOnly 
              ? '未参照ファイルはありません'
              : '添付ファイルはありません'
            }
          </div>
        )}

        {filteredFiles.map(file => (
          <div key={file.id} className={`attachment-item ${!file.isReferenced ? 'unreferenced' : ''}`}>
            <div className="attachment-checkbox">
              <input
                type="checkbox"
                checked={selectedFiles.has(file.id)}
                onChange={(e) => handleFileSelect(file.id, e.target.checked)}
              />
            </div>
            
            <div className="attachment-info">
              <div className="attachment-name" title={file.name}>
                {file.name}
                {!file.isReferenced && (
                  <span className="unreferenced-badge">未参照</span>
                )}
              </div>
              <div className="attachment-meta">
                <span className="attachment-size">{formatFileSize(file.size)}</span>
                <span className="attachment-location">
                  {file.mapTitle} → {file.nodeTitle}
                </span>
              </div>
              <div className="attachment-date">
                {new Date(file.uploadedAt).toLocaleDateString('ja-JP')}
              </div>
            </div>

            <div className="attachment-actions">
              <button
                className="download-button"
                onClick={() => handleDownloadFile(file)}
                disabled={loading}
                title="ダウンロード"
              >
                ⬇️
              </button>
              <button
                className="delete-button"
                onClick={() => handleDeleteFile(file)}
                disabled={loading}
                title="削除"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttachmentsSidebar;