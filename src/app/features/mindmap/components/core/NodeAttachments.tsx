import React, { useCallback, memo, useState, useEffect } from 'react';
import type { MindMapNode, FileAttachment } from '@shared/types';
import { useOptionalAuth } from '../../../../components/auth';

interface NodeAttachmentsProps {
  node: MindMapNode;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  isSelected?: boolean;
  onSelectNode?: (nodeId: string | null) => void;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
  nodeHeight: number;
}


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
  
  // 認証情報を取得 (オプショナル)
  const auth = useOptionalAuth();


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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: 'transparent' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={style}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: 'rgba(255, 238, 238, 0.8)', color: '#c00', fontSize: '12px', textAlign: 'center' }}>
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


const NodeAttachments: React.FC<NodeAttachmentsProps> = ({
  node,
  svgRef,
  zoom,
  pan,
  isSelected = false,
  onSelectNode,
  onShowImageModal,
  onShowFileActionMenu,
  onUpdateNode,
  onAutoLayout,
  nodeHeight
}) => {  
  // 画像リサイズ状態管理
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const [originalAspectRatio, setOriginalAspectRatio] = useState(1);

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
    const currentDimensions = imageDimensions;
    
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
      customImageHeight: Math.round(newHeight)
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
  const handleImageDoubleClick = useCallback((e: React.MouseEvent, file: FileAttachment & { isImage?: boolean }) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowImageModal && file.isImage) {
      onShowImageModal(file);
    }
  }, [onShowImageModal]);

  // 画像クリック時の処理（ノード選択 or メニュー表示）
  const handleImageClick = useCallback((e: React.MouseEvent, file: FileAttachment) => {
    e.stopPropagation();
    e.preventDefault();
    
    // ノードが選択されていない場合は選択する
    if (!isSelected && onSelectNode) {
      onSelectNode(node.id);
      return;
    }
    
    // 既に選択されている場合はファイルアクションメニューを表示
    if (onShowFileActionMenu) {
      const clientX = e.clientX || 0;
      const clientY = e.clientY || 0;
      
      onShowFileActionMenu(file, node.id, {
        x: clientX,
        y: clientY
      });
    }
  }, [isSelected, onSelectNode, onShowFileActionMenu, node.id]);

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

  // 画像ファイルのみを表示（1枚目のみ）
  const firstImageFile = node.attachments?.find((f: FileAttachment) => f.isImage) || null;
  
  // calculateNodeSizeで既に計算済みの画像サイズを使用
  // カスタムサイズを優先
  const imageDimensions = node.customImageWidth && node.customImageHeight
    ? { width: node.customImageWidth, height: node.customImageHeight }
    : { width: 150, height: 105 };

  // 画像位置計算を統一（ノード上部に配置、4pxマージン）
  const imageY = node.y - nodeHeight / 2 + 4;
  const imageX = node.x - imageDimensions.width / 2;

  return (
    <>
      {/* 最初の画像ファイルのみ表示 */}
      {firstImageFile && (
        <g key={firstImageFile.id}>
          <foreignObject 
            x={imageX} 
            y={imageY} 
            width={imageDimensions.width} 
            height={imageDimensions.height}
          >
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '6px',
              overflow: 'hidden',
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', // スムーズなサイズ変更アニメーション
              cursor: 'pointer'
            }}
            onClick={(e) => handleImageClick(e as any, firstImageFile)}
            onDoubleClick={(e) => handleImageDoubleClick(e as any, firstImageFile)}
            onContextMenu={(e) => handleFileActionMenu(e as any, firstImageFile)}
            >
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
                  onClick={(e) => handleImageClick(e, firstImageFile)}
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
                  onClick={(e) => handleImageClick(e, firstImageFile)}
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
                x={imageX - 2}
                y={imageY - 2}
                width={imageDimensions.width + 4}
                height={imageDimensions.height + 4}
                fill="none"
                stroke="#bfdbfe"
                strokeWidth="1"
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
                  x={imageX + imageDimensions.width - 4}
                  y={imageY + imageDimensions.height - 4}
                  width="8"
                  height="8"
                  fill="white"
                  stroke="#bfdbfe"
                  strokeWidth="1"
                  rx="1"
                  ry="1"
                  style={{
                    cursor: isResizing ? 'nw-resize' : 'se-resize',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseDown={handleResizeStart}
                />
                {/* リサイズハンドルのアイコン（斜め線） */}
                <g stroke="#6b7280" strokeWidth="1" style={{ pointerEvents: 'none' }}>
                  <line
                    x1={imageX + imageDimensions.width - 2}
                    y1={imageY + imageDimensions.height - 2}
                    x2={imageX + imageDimensions.width + 2}
                    y2={imageY + imageDimensions.height - 6}
                  />
                  <line
                    x1={imageX + imageDimensions.width - 1}
                    y1={imageY + imageDimensions.height - 3}
                    x2={imageX + imageDimensions.width + 1}
                    y2={imageY + imageDimensions.height - 5}
                  />
                  <line
                    x1={imageX + imageDimensions.width}
                    y1={imageY + imageDimensions.height - 4}
                    x2={imageX + imageDimensions.width}
                    y2={imageY + imageDimensions.height - 4}
                  />
                </g>
              </g>
            </g>
          )}
        </g>
      )}
    </>
  );
};

export default memo(NodeAttachments);