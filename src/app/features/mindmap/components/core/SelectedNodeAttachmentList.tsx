import React, { memo, useCallback } from 'react';
import type { MindMapNode, FileAttachment } from '@shared/types';

interface SelectedNodeAttachmentListProps {
  node: MindMapNode;
  isVisible: boolean;
  nodeWidth: number;
  nodeHeight: number;
  onFileClick: (file: FileAttachment) => void;
  onFileDoubleClick?: (file: FileAttachment) => void;
  onFileContextMenu: (file: FileAttachment, position: { x: number; y: number }) => void;
}

// ファイルタイプに応じたアイコンを取得
const getFileIcon = (fileName: string, fileType?: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const type = fileType?.toLowerCase();
  
  // 画像ファイル
  if (type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext || '')) {
    return '🖼️';
  }
  
  // PDFファイル
  if (type === 'application/pdf' || ext === 'pdf') {
    return '📄';
  }
  
  // Officeドキュメント
  if (type?.includes('word') || ['doc', 'docx'].includes(ext || '')) {
    return '📝';
  }
  if (type?.includes('excel') || type?.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext || '')) {
    return '📊';
  }
  if (type?.includes('presentation') || ['ppt', 'pptx'].includes(ext || '')) {
    return '📈';
  }
  
  // テキストファイル
  if (type?.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp'].includes(ext || '')) {
    return '📄';
  }
  
  // 動画ファイル
  if (type?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext || '')) {
    return '🎬';
  }
  
  // 音声ファイル
  if (type?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext || '')) {
    return '🎵';
  }
  
  // アーカイブファイル
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
    return '🗜️';
  }
  
  // デフォルト
  return '📎';
};

// ファイルサイズを人間が読みやすい形式に変換
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const SelectedNodeAttachmentList: React.FC<SelectedNodeAttachmentListProps> = ({
  node,
  isVisible,
  nodeWidth,
  nodeHeight,
  onFileClick,
  onFileDoubleClick,
  onFileContextMenu
}) => {
  const handleFileClick = useCallback((file: FileAttachment) => {
    onFileClick(file);
  }, [onFileClick]);

  const handleFileDoubleClick = useCallback((file: FileAttachment) => {
    if (onFileDoubleClick) {
      onFileDoubleClick(file);
    }
  }, [onFileDoubleClick]);

  const handleFileContextMenu = useCallback((e: React.MouseEvent, file: FileAttachment) => {
    e.preventDefault();
    e.stopPropagation();
    onFileContextMenu(file, { x: e.clientX, y: e.clientY });
  }, [onFileContextMenu]);

  if (!isVisible || !node.attachments || node.attachments.length === 0) {
    return null;
  }

  // リストの位置計算（ノードとアイコンの直下に表示）
  // ノードに添付ファイルやリンクがある場合、それらの下に配置
  const hasAttachments = node.attachments && node.attachments.length > 0;
  const hasLinks = node.links && node.links.length > 0;
  const iconOffset = (hasAttachments || hasLinks) ? 12 : 0; // アイコンの分だけオフセット（さらに縮小）
  const listY = node.y + nodeHeight / 2 + 12 + iconOffset; // ノードの下に適切なスペース
  const listX = node.x - nodeWidth / 2; // ノードの左端に合わせる
  const listWidth = Math.max(nodeWidth, 300); // 最小幅300px
  
  // 動的高さ計算（各ファイルアイテム28px + パディング16px + 最大高さ制限240px）
  const itemHeight = 28; // 各ファイルアイテムの高さ
  const padding = 16; // 上下のパディング
  const calculatedHeight = Math.min(node.attachments.length * itemHeight + padding, 240);
  const listHeight = calculatedHeight;

  return (
    <foreignObject
      x={listX}
      y={listY}
      width={listWidth}
      height={listHeight}
      style={{ 
        overflow: 'visible',
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #d0d7de',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
          padding: '8px',
          maxHeight: '240px',
          overflowY: 'auto',
          fontSize: '12px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: 1000
        }}
      >

        {/* ファイル一覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {node.attachments.map((file) => {
            const icon = getFileIcon(file.name, file.type);
            
            // ファイル名の省略処理（拡張子を保持）
            let fileName = file.name;
            if (file.name.length > 35) {
              const lastDotIndex = file.name.lastIndexOf('.');
              if (lastDotIndex > 0) {
                const baseName = file.name.substring(0, lastDotIndex);
                const extension = file.name.substring(lastDotIndex);
                const maxBaseLength = 35 - extension.length - 3; // "..." の分を引く
                if (maxBaseLength > 0) {
                  fileName = baseName.substring(0, maxBaseLength) + '...' + extension;
                } else {
                  fileName = file.name.substring(0, 35) + '...';
                }
              } else {
                fileName = file.name.substring(0, 35) + '...';
              }
            }
            
            const fileSize = file.size ? formatFileSize(file.size) : '';
            
            return (
              <div
                key={file.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  backgroundColor: 'transparent'
                }}
                className="file-item"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => handleFileClick(file)}
                onDoubleClick={() => handleFileDoubleClick(file)}
                onContextMenu={(e) => handleFileContextMenu(e, file)}
              >
                {/* ファイルアイコン */}
                <span
                  style={{
                    fontSize: '16px',
                    marginRight: '8px',
                    flexShrink: 0
                  }}
                >
                  {icon}
                </span>

                {/* ファイル情報 */}
                <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#24292f',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '1.3'
                    }}
                  >
                    {fileName}
                  </div>
                  
                  {fileSize && (
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#656d76',
                        marginTop: '1px',
                        lineHeight: '1.2'
                      }}
                    >
                      {fileSize}
                    </div>
                  )}
                </div>

                {/* アクションヒント */}
                <div
                  style={{
                    fontSize: '9px',
                    color: '#8c959f',
                    marginLeft: '6px',
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                  }}
                  className="action-hint"
                >
                  右クリック
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ホバー時のアクションヒント表示用CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .file-item:hover .action-hint {
            opacity: 1 !important;
          }
        `
      }} />
    </foreignObject>
  );
};

export default memo(SelectedNodeAttachmentList);