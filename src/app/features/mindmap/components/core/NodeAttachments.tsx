import React, { useCallback, memo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { MindMapNode, FileAttachment } from '@shared/types';
import { useAuth } from '../../../../components/auth';

interface NodeAttachmentsProps {
  node: MindMapNode;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  isSelected?: boolean;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
}

// 隠れたファイル一覧表示コンポーネント
interface HiddenFilesMenuProps {
  files: FileAttachment[];
  position: { x: number; y: number };
  onFileClick: (file: FileAttachment) => void;
  onClose: () => void;
}

const HiddenFilesMenu: React.FC<HiddenFilesMenuProps> = ({ files, position, onFileClick, onClose }) => {
  const menuRef = React.useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '8px',
        minWidth: '200px',
        maxHeight: '300px',
        overflowY: 'auto',
        zIndex: 1000
      }}
    >
      <div style={{ 
        fontSize: '12px', 
        fontWeight: '600', 
        color: '#666', 
        marginBottom: '8px',
        borderBottom: '1px solid #f0f0f0',
        paddingBottom: '4px'
      }}>
        その他のファイル ({files.length})
      </div>
      {files.map((file, index) => {
        const icon = getFileIcon(file.name, file.type);
        const fileName = file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name;
        const fileSize = file.size ? formatFileSize(file.size) : '';
        
        return (
          <div
            key={file.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              marginBottom: index < files.length - 1 ? '2px' : '0'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => {
              onFileClick(file);
              onClose();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onFileClick(file);
              onClose();
            }}
          >
            <span style={{ fontSize: '16px', marginRight: '8px' }}>{icon}</span>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: '500', 
                color: '#333',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {fileName}
              </div>
              {fileSize && (
                <div style={{ 
                  fontSize: '11px', 
                  color: '#888',
                  marginTop: '2px'
                }}>
                  {fileSize}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// クラウド画像用のコンポーネント
const CloudImage: React.FC<{ 
  file: FileAttachment; 
  style: React.CSSProperties;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ file, style, onClick, onDoubleClick, onContextMenu }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // 認証情報を取得
  let auth;
  try {
    auth = useAuth();
  } catch {
    // AuthProviderの外で呼ばれた場合
    auth = null;
  }


  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    const loadImage = async () => {
      if (!file.downloadUrl) {
        if (!cancelled) {
          setError('No download URL available');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError('');

      try {
        // R2ストレージからの画像取得処理
        if (file.downloadUrl.includes('/api/files/')) {
          // 認証ヘッダーを取得
          const headers: Record<string, string> = {};
          
          if (auth?.authAdapter?.getAuthHeaders) {
            const authHeaders = auth.authAdapter.getAuthHeaders();
            Object.assign(headers, authHeaders);
          }
          
          // ダウンロード用URLを構築（R2ストレージから直接取得）
          const downloadUrl = file.downloadUrl.includes('?type=download') 
            ? file.downloadUrl 
            : `${file.downloadUrl}?type=download`;
          
          // R2経由でダウンロードしてBlob URLを作成
          const response = await fetch(downloadUrl, {
            method: 'GET',
            headers,
            mode: 'cors'
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch image from R2: ${response.status} ${response.statusText}`);
          }
          
          const blob = await response.blob();
          
          // 画像ファイルかチェック
          if (blob.size === 0) {
            throw new Error('Empty file received from R2 storage');
          }
          
          blobUrl = URL.createObjectURL(blob);
          
          if (!cancelled) {
            setImageUrl(blobUrl);
          }
        } else {
          // 直接URLを使用（非R2ルート）
          if (!cancelled) {
            setImageUrl(file.downloadUrl);
          }
        }
        
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    loadImage();

    // クリーンアップ
    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [file.downloadUrl, file.id, auth?.authAdapter?.isAuthenticated]);

  if (loading) {
    return (
      <div style={style}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#f5f5f5' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={style}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#fee', color: '#c00', fontSize: '12px', textAlign: 'center' }}>
          画像読み込み<br />エラー
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={file.name}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onError={() => {
        setError('Image load failed');
        setLoading(false);
      }}
      onLoad={() => {
        setError('');
      }}
    />
  );
};

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

const NodeAttachments: React.FC<NodeAttachmentsProps> = ({
  node,
  svgRef,
  zoom,
  pan,
  isSelected = false,
  onShowImageModal,
  onShowFileActionMenu,
  onUpdateNode,
  onAutoLayout
}) => {
  // 隠れたファイルメニューの状態管理
  const [hiddenFilesMenu, setHiddenFilesMenu] = useState<{
    files: FileAttachment[];
    position: { x: number; y: number };
  } | null>(null);
  
  // 画像リサイズ状態管理
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const [originalAspectRatio, setOriginalAspectRatio] = useState(1);

  const showHiddenFilesMenu = useCallback((files: FileAttachment[], position: { x: number; y: number }) => {
    setHiddenFilesMenu({ files, position });
  }, []);

  const closeHiddenFilesMenu = useCallback(() => {
    setHiddenFilesMenu(null);
  }, []);

  // 画像リサイズハンドラー
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    console.log('🎯 リサイズ開始:', { nodeId: node.id, isResizing });
    e.stopPropagation();
    e.preventDefault();
    
    if (!onUpdateNode) {
      console.log('❌ onUpdateNode が未定義');
      return;
    }
    
    if (!svgRef.current) {
      console.log('❌ svgRef が未定義');
      return;
    }
    
    const svgRect = svgRef.current.getBoundingClientRect();
    const currentDimensions = getImageDimensions(node);
    
    console.log('📏 現在の画像サイズ:', currentDimensions);
    
    setIsResizing(true);
    setResizeStartPos({
      x: (e.clientX - svgRect.left) / zoom - pan.x,
      y: (e.clientY - svgRect.top) / zoom - pan.y
    });
    setResizeStartSize({
      width: currentDimensions.width,
      height: currentDimensions.height
    });
    setOriginalAspectRatio(currentDimensions.width / currentDimensions.height);
    
    console.log('✅ リサイズ開始完了');
  }, [node, onUpdateNode, svgRef, zoom, pan, isResizing]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !onUpdateNode || !svgRef.current) return;
    
    const svgRect = svgRef.current.getBoundingClientRect();
    const currentPos = {
      x: (e.clientX - svgRect.left) / zoom - pan.x,
      y: (e.clientY - svgRect.top) / zoom - pan.y
    };
    
    const deltaX = currentPos.x - resizeStartPos.x;
    const deltaY = currentPos.y - resizeStartPos.y;
    
    // 対角線方向の距離を計算
    const diagonal = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const direction = deltaX + deltaY > 0 ? 1 : -1;
    
    // 最小・最大サイズの制限
    const minWidth = 50;
    const maxWidth = 400;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartSize.width + diagonal * direction));
    const newHeight = newWidth / originalAspectRatio;
    
    onUpdateNode(node.id, {
      customImageWidth: Math.round(newWidth),
      customImageHeight: Math.round(newHeight),
      imageSize: undefined // カスタムサイズ使用時はプリセットをクリア
    });
  }, [isResizing, onUpdateNode, svgRef, zoom, pan, resizeStartPos, resizeStartSize, originalAspectRatio, node.id]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      
      // リサイズ後に自動整列
      if (onAutoLayout) {
        requestAnimationFrame(() => {
          onAutoLayout();
        });
      }
    }
  }, [isResizing, onAutoLayout]);

  // マウスイベントリスナーの管理
  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => handleResizeMove(e);
      const handleMouseUp = () => handleResizeEnd();
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const handleHiddenFileClick = useCallback((file: FileAttachment) => {
    if (hiddenFilesMenu) {
      onShowFileActionMenu(file, node.id, hiddenFilesMenu.position);
    }
  }, [hiddenFilesMenu, onShowFileActionMenu, node.id]);
  const handleImageDoubleClick = useCallback((e: React.MouseEvent, file: FileAttachment & { isImage?: boolean }) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowImageModal && file.isImage) {
      onShowImageModal(file);
    }
  }, [onShowImageModal]);

  const handleFileActionMenu = useCallback((e: React.MouseEvent | { stopPropagation: () => void; preventDefault: () => void; clientX: number; clientY: number }, file: FileAttachment) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowFileActionMenu) {
      // SVGイベントの場合は座標を適切に取得
      const clientX = e.clientX || 0;
      const clientY = e.clientY || 0;
      
      onShowFileActionMenu(file, node.id, {
        x: clientX,
        y: clientY
      });
    }
  }, [onShowFileActionMenu, node.id]);

  if (!node.attachments || node.attachments.length === 0) {
    return null;
  }

  // 画像ファイルと非画像ファイルを分離 - 1枚目の画像のみ画像として表示
  const firstImageFile = node.attachments?.find((f: FileAttachment) => f.isImage) || null;
  const remainingImageFiles = node.attachments?.filter((f: FileAttachment) => {
    const imageIndex = node.attachments?.findIndex(file => file.isImage && file.id === f.id);
    return f.isImage && imageIndex !== undefined && imageIndex > 0;
  }) || [];
  const nonImageFiles = [
    ...node.attachments?.filter((file: FileAttachment) => !file.isImage) || [],
    ...remainingImageFiles // 2枚目以降の画像を非画像ファイルとして扱う
  ];
  
  // 画像サイズ設定
  const getImageDimensions = (node: MindMapNode) => {
    // カスタムサイズが設定されている場合
    if (node.customImageWidth && node.customImageHeight) {
      return { width: node.customImageWidth, height: node.customImageHeight };
    }
    
    // プリセットサイズの場合
    const imageSize = node.imageSize || 'medium';
    const sizeMap = {
      'small': { width: 100, height: 70 },
      'medium': { width: 150, height: 105 },
      'large': { width: 200, height: 140 },
      'extra-large': { width: 250, height: 175 }
    };
    
    return sizeMap[imageSize];
  };

  const imageDimensions = getImageDimensions(node);
  
  // レイアウト計算
  const hasDisplayImage = firstImageFile !== null;
  
  // ノードの高さを考慮してファイルカードを配置
  // 画像がある場合: 画像の下から10px下（テキストの更に下）
  // 画像がない場合: ノードテキストから10px下
  const nonImageFileYOffset = hasDisplayImage 
    ? node.y + imageDimensions.height / 2 + 15  // 画像の下、テキストの更に下
    : node.y + 10;                             // ノードテキストから10px下

  return (
    <>
      {/* 最初の画像ファイルのみ表示（元の位置） */}
      {firstImageFile && (
        <g key={firstImageFile.id}>
          <foreignObject 
            x={node.x - imageDimensions.width / 2} 
            y={node.y - imageDimensions.height / 2 - 20} 
            width={imageDimensions.width} 
            height={imageDimensions.height - 5}
          >
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '2px solid #fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              backgroundColor: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' // スムーズなサイズ変更アニメーション
            }}>
              {firstImageFile.downloadUrl && firstImageFile.downloadUrl.includes('/api/files/') ? (
                <CloudImage
                  file={firstImageFile}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                    display: 'block',
                    margin: '0 auto'
                  }}
                  onClick={(e) => handleFileActionMenu(e, firstImageFile)}
                  onDoubleClick={(e) => handleImageDoubleClick(e, firstImageFile)}
                  onContextMenu={(e) => handleFileActionMenu(e, firstImageFile)}
                />
              ) : (
                <img 
                  src={firstImageFile.downloadUrl || firstImageFile.dataURL || firstImageFile.data} 
                  alt={firstImageFile.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                    display: 'block',
                    margin: '0 auto'
                  }}
                  onClick={(e) => handleFileActionMenu(e, firstImageFile)}
                  onDoubleClick={(e) => handleImageDoubleClick(e, firstImageFile)}
                  onContextMenu={(e) => handleFileActionMenu(e, firstImageFile)}
                  onError={() => {}}
                  onLoad={() => {}}
                />
              )}
            </div>
          </foreignObject>
          
          {/* 画像選択時の枠線とリサイズハンドル */}
          {isSelected && (
            <g>
              {/* 枠線 */}
              <rect
                x={node.x - imageDimensions.width / 2 - 2}
                y={node.y - imageDimensions.height / 2 - 20 - 2}
                width={imageDimensions.width + 4}
                height={imageDimensions.height + 4}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="5,3"
                rx="6"
                ry="6"
                style={{
                  pointerEvents: 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                }}
              />
              
              {/* リサイズハンドル（右下） */}
              <g>
                {/* ハンドル背景 */}
                <rect
                  x={node.x + imageDimensions.width / 2 - 4}
                  y={node.y + imageDimensions.height / 2 - 20 - 4}
                  width="8"
                  height="8"
                  fill="white"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  rx="1"
                  ry="1"
                  style={{
                    cursor: isResizing ? 'nw-resize' : 'se-resize',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseDown={handleResizeStart}
                />
                {/* ハンドルの十字マーク */}
                <g stroke="#3b82f6" strokeWidth="1" style={{ pointerEvents: 'none' }}>
                  <line
                    x1={node.x + imageDimensions.width / 2 - 2}
                    y1={node.y + imageDimensions.height / 2 - 20 - 2}
                    x2={node.x + imageDimensions.width / 2 + 2}
                    y2={node.y + imageDimensions.height / 2 - 20 + 2}
                  />
                  <line
                    x1={node.x + imageDimensions.width / 2 + 2}
                    y1={node.y + imageDimensions.height / 2 - 20 - 2}
                    x2={node.x + imageDimensions.width / 2 - 2}
                    y2={node.y + imageDimensions.height / 2 - 20 + 2}
                  />
                </g>
              </g>
            </g>
          )}
        </g>
      )}
      
      {/* 非画像ファイルの表示 */}
      {(() => {
        if (nonImageFiles.length === 0) return null;
        
        // 単一ファイルの場合 - アイコンのみ表示
        if (nonImageFiles.length === 1) {
          const file = nonImageFiles[0];
          const icon = getFileIcon(file.name, file.type);
          const yOffset = nonImageFileYOffset;
          const iconSize = 24; // アイコンのサイズ
          const cardX = node.x - iconSize / 2; // 中央揃え
          
          return (
            <g key={file.id}>
              {/* ファイルカード背景 */}
              <rect
                x={cardX}
                y={yOffset}
                width={iconSize}
                height={iconSize}
                fill="#ffffff"
                stroke="#e0e0e0"
                strokeWidth="1"
                rx="4"
                ry="4"
                style={{ cursor: 'pointer', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                onClick={(e) => {
                  const svgRect = svgRef.current?.getBoundingClientRect();
                  if (svgRect) {
                    const clientX = svgRect.left + (node.x) * zoom + pan.x * zoom;
                    const clientY = svgRect.top + (yOffset + iconSize / 2) * zoom + pan.y * zoom;
                    const fakeEvent = {
                      stopPropagation: () => e.stopPropagation(),
                      preventDefault: () => e.preventDefault(),
                      clientX,
                      clientY
                    };
                    handleFileActionMenu(fakeEvent, file);
                  }
                }}
                onContextMenu={(e) => {
                  const svgRect = svgRef.current?.getBoundingClientRect();
                  if (svgRect) {
                    const clientX = svgRect.left + (node.x) * zoom + pan.x * zoom;
                    const clientY = svgRect.top + (yOffset + iconSize / 2) * zoom + pan.y * zoom;
                    const fakeEvent = {
                      stopPropagation: () => e.stopPropagation(),
                      preventDefault: () => e.preventDefault(),
                      clientX,
                      clientY
                    };
                    handleFileActionMenu(fakeEvent, file);
                  }
                }}
              />
              
              {/* ファイルアイコン */}
              <text
                x={cardX + iconSize / 2}
                y={yOffset + iconSize / 2 + 4}
                textAnchor="middle"
                fill="#333"
                fontSize="14px"
                style={{ pointerEvents: 'none' }}
              >
                {icon}
              </text>
            </g>
          );
        }
        
        // 複数ファイルの場合 - アイコンのみ横並び表示
        const yOffset = nonImageFileYOffset;
        const maxDisplayFiles = 3; // 表示するアイコン数を増やす
        const filesToShow = nonImageFiles.slice(0, maxDisplayFiles);
        const remainingCount = nonImageFiles.length - maxDisplayFiles;
        const iconSize = 20; // アイコンサイズ
        const iconSpacing = 4; // アイコン間のスペース
        const totalWidth = filesToShow.length * iconSize + (filesToShow.length - 1) * iconSpacing + 
                          (remainingCount > 0 ? iconSize + iconSpacing : 0); // +N表示も含む
        const startX = node.x - totalWidth / 2; // 中央揃え
        
        return (
          <g>
            {/* ファイルアイコンを横並びで表示 */}
            {filesToShow.map((file, index) => {
              const icon = getFileIcon(file.name, file.type);
              const iconX = startX + index * (iconSize + iconSpacing);
              
              return (
                <g key={file.id}>
                  {/* アイコン背景 */}
                  <rect
                    x={iconX}
                    y={yOffset}
                    width={iconSize}
                    height={iconSize}
                    fill="#ffffff"
                    stroke="#e0e0e0"
                    strokeWidth="1"
                    rx="3"
                    ry="3"
                    style={{ cursor: 'pointer', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                    onClick={(e) => {
                      const svgRect = svgRef.current?.getBoundingClientRect();
                      if (svgRect) {
                        const clientX = svgRect.left + (iconX + iconSize / 2) * zoom + pan.x * zoom;
                        const clientY = svgRect.top + (yOffset + iconSize / 2) * zoom + pan.y * zoom;
                        const fakeEvent = {
                          stopPropagation: () => e.stopPropagation(),
                          preventDefault: () => e.preventDefault(),
                          clientX,
                          clientY
                        };
                        handleFileActionMenu(fakeEvent, file);
                      }
                    }}
                    onContextMenu={(e) => {
                      const svgRect = svgRef.current?.getBoundingClientRect();
                      if (svgRect) {
                        const clientX = svgRect.left + (iconX + iconSize / 2) * zoom + pan.x * zoom;
                        const clientY = svgRect.top + (yOffset + iconSize / 2) * zoom + pan.y * zoom;
                        const fakeEvent = {
                          stopPropagation: () => e.stopPropagation(),
                          preventDefault: () => e.preventDefault(),
                          clientX,
                          clientY
                        };
                        handleFileActionMenu(fakeEvent, file);
                      }
                    }}
                  />
                  
                  {/* ファイルアイコン */}
                  <text
                    x={iconX + iconSize / 2}
                    y={yOffset + iconSize / 2 + 4}
                    textAnchor="middle"
                    fill="#333"
                    fontSize="12px"
                    style={{ pointerEvents: 'none' }}
                  >
                    {icon}
                  </text>
                </g>
              );
            })}
            
            {/* 残りのファイル数表示 */}
            {remainingCount > 0 && (
              <g>
                <rect
                  x={startX + filesToShow.length * (iconSize + iconSpacing)}
                  y={yOffset}
                  width={iconSize}
                  height={iconSize}
                  fill="#f8f9fa"
                  stroke="#e0e0e0"
                  strokeWidth="1"
                  rx="3"
                  ry="3"
                  style={{ cursor: 'pointer', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // シンプルな座標計算（画面中央付近に表示）
                    const clientX = window.innerWidth / 2;
                    const clientY = window.innerHeight / 2;
                    
                    // 隠れているファイル一覧メニューを表示
                    const hiddenFiles = nonImageFiles.slice(maxDisplayFiles);
                    
                    if (hiddenFiles.length > 0) {
                      showHiddenFilesMenu(hiddenFiles, { x: clientX, y: clientY });
                    }
                  }}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    const svgRect = svgRef.current?.getBoundingClientRect();
                    if (svgRect) {
                      const clientX = svgRect.left + (startX + filesToShow.length * (iconSize + iconSpacing) + iconSize / 2) * zoom + pan.x * zoom;
                      const clientY = svgRect.top + (yOffset + iconSize / 2) * zoom + pan.y * zoom;
                      
                      // 隠れているファイル一覧メニューを表示
                      const hiddenFiles = nonImageFiles.slice(maxDisplayFiles);
                      if (hiddenFiles.length > 0) {
                        showHiddenFilesMenu(hiddenFiles, { x: clientX, y: clientY });
                      }
                    }
                  }}
                />
                <text
                  x={startX + filesToShow.length * (iconSize + iconSpacing) + iconSize / 2}
                  y={yOffset + iconSize / 2 + 3}
                  textAnchor="middle"
                  fill="#666"
                  fontSize="8px"
                  fontWeight="500"
                  style={{ pointerEvents: 'none' }}
                >
                  +{remainingCount}
                </text>
              </g>
            )}
          </g>
        );
      })()}
      
      {/* 隠れたファイル一覧メニュー (Portal経由でbodyに表示) */}
      {hiddenFilesMenu && createPortal(
        <HiddenFilesMenu
          files={hiddenFilesMenu.files}
          position={hiddenFilesMenu.position}
          onFileClick={handleHiddenFileClick}
          onClose={closeHiddenFilesMenu}
        />,
        document.body
      )}
    </>
  );
};

export default memo(NodeAttachments);