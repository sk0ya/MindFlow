import React, { useCallback, memo, useState, useEffect } from 'react';
import type { MindMapNode, FileAttachment } from '@shared/types';
import { useAuth } from '../../../../components/auth';

interface NodeAttachmentsProps {
  node: MindMapNode;
  nodeWidth: number;
  imageHeight: number;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
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
  
  // 認証情報を取得
  let auth;
  try {
    auth = useAuth();
  } catch {
    // AuthProviderの外で呼ばれた場合
    auth = null;
  }

  useEffect(() => {
    const loadImage = async () => {
      if (!file.downloadUrl) {
        setError('No download URL available');
        setLoading(false);
        return;
      }

      try {
        console.log('CloudImage: Loading image from URL:', file.downloadUrl);
        
        // 認証が必要な場合はfetchでBlobを取得してオブジェクトURLを作成
        if (file.downloadUrl.includes('/api/files/')) {
          console.log('CloudImage: Fetching with credentials:', {
            url: file.downloadUrl,
            method: 'GET',
            credentials: 'include'
          });
          
          // 認証ヘッダーを取得
          const headers: Record<string, string> = {
            'Accept': 'image/*,*/*'
          };
          
          if (auth?.authAdapter?.getAuthHeaders) {
            const authHeaders = auth.authAdapter.getAuthHeaders();
            Object.assign(headers, authHeaders);
            console.log('CloudImage: Added auth headers:', Object.keys(authHeaders));
          }
          
          // API経由でダウンロードしてBlob URLを作成
          const response = await fetch(file.downloadUrl, {
            method: 'GET',
            headers
          });
          
          console.log('CloudImage: Response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('CloudImage: Response error body:', errorText);
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          const blob = await response.blob();
          console.log('CloudImage: Blob created:', {
            size: blob.size,
            type: blob.type
          });
          
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
          console.log('CloudImage: Created blob URL:', url);
        } else {
          // 直接URLを使用
          console.log('CloudImage: Using direct URL:', file.downloadUrl);
          setImageUrl(file.downloadUrl);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('CloudImage: Failed to load image:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    loadImage();

    // クリーンアップ
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [file.downloadUrl]);

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
      onError={(e) => {
        console.error('CloudImage: img onError:', e);
        setError('Image load failed');
      }}
      onLoad={() => {
        console.log('CloudImage: Image loaded successfully:', file.name);
      }}
    />
  );
};

const NodeAttachments: React.FC<NodeAttachmentsProps> = ({
  node,
  nodeWidth,
  imageHeight,
  svgRef,
  zoom,
  pan,
  onShowImageModal,
  onShowFileActionMenu
}) => {
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

  return (
    <>
      {/* 画像添付ファイルの表示 */}
      {node.attachments.filter((file: FileAttachment) => file.isImage).map((file: FileAttachment) => (
        <g key={file.id}>
          <foreignObject 
            x={node.x - nodeWidth / 2 + 5} 
            y={node.y - 40} 
            width={nodeWidth - 10} 
            height={imageHeight - 5}
          >
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '4px',
              overflow: 'hidden',
              border: '1px solid #ddd'
            }}>
              {file.downloadUrl && file.downloadUrl.includes('/api/files/') ? (
                <CloudImage
                  file={file}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => handleFileActionMenu(e, file)}
                  onDoubleClick={(e) => handleImageDoubleClick(e, file)}
                  onContextMenu={(e) => handleFileActionMenu(e, file)}
                />
              ) : (
                <img 
                  src={file.downloadUrl || file.dataURL || file.data} 
                  alt={file.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => handleFileActionMenu(e, file)}
                  onDoubleClick={(e) => handleImageDoubleClick(e, file)}
                  onContextMenu={(e) => handleFileActionMenu(e, file)}
                  onError={(e) => {
                    console.error('NodeAttachments: Image load error for file:', file, 'Event:', e);
                    console.log('Attempted image src:', file.downloadUrl || file.dataURL || file.data);
                  }}
                  onLoad={() => {
                    console.log('NodeAttachments: Image loaded successfully for file:', file.name);
                  }}
                />
              )}
            </div>
          </foreignObject>
        </g>
      ))}
      
      {/* 非画像ファイルの表示 */}
      {node.attachments.filter((file: FileAttachment) => !file.isImage).map((file: FileAttachment, index: number) => {
        const yOffset = node.y - 15 + (index * 20);
        return (
          <g key={file.id}>
            <rect
              x={node.x + nodeWidth / 2 - 40}
              y={yOffset - 8}
              width={35}
              height={16}
              fill="#f5f5f5"
              stroke="#ddd"
              strokeWidth="1"
              rx="3"
              ry="3"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                // SVGイベントの座標を取得
                const svgRect = svgRef.current?.getBoundingClientRect();
                if (svgRect) {
                  const clientX = svgRect.left + (node.x + nodeWidth / 2 - 22) * zoom + pan.x * zoom;
                  const clientY = svgRect.top + (yOffset + 8) * zoom + pan.y * zoom;
                  
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
                  const clientX = svgRect.left + (node.x + nodeWidth / 2 - 22) * zoom + pan.x * zoom;
                  const clientY = svgRect.top + (yOffset + 8) * zoom + pan.y * zoom;
                  
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
            <text
              x={node.x + nodeWidth / 2 - 22}
              y={yOffset + 2}
              textAnchor="middle"
              fill="#666"
              fontSize="10px"
              style={{ pointerEvents: 'none' }}
            >
              📎
            </text>
          </g>
        );
      })}
    </>
  );
};

export default memo(NodeAttachments);