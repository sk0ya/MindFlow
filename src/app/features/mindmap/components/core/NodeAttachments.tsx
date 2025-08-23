import React, { useCallback, memo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    const loadImage = async () => {
      if (!file.downloadUrl) {
        setError('No download URL available');
        setLoading(false);
        return;
      }

      try {
        // 認証が必要な場合はfetchでBlobを取得してオブジェクトURLを作成
        if (file.downloadUrl.includes('/api/files/')) {
          // 認証ヘッダーを取得
          const headers: Record<string, string> = {
            'Accept': 'image/*,*/*'
          };
          
          if (auth?.authAdapter?.getAuthHeaders) {
            const authHeaders = auth.authAdapter.getAuthHeaders();
            Object.assign(headers, authHeaders);
          }
          
          // API経由でダウンロードしてBlob URLを作成
          const response = await fetch(file.downloadUrl, {
            method: 'GET',
            headers
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('CloudImage: Response error body:', errorText);
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
        } else {
          // 直接URLを使用
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
      onLoad={() => {}}
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
  nodeWidth,
  imageHeight,
  svgRef,
  zoom,
  pan,
  onShowImageModal,
  onShowFileActionMenu
}) => {
  // 隠れたファイルメニューの状態管理
  const [hiddenFilesMenu, setHiddenFilesMenu] = useState<{
    files: FileAttachment[];
    position: { x: number; y: number };
  } | null>(null);

  const showHiddenFilesMenu = useCallback((files: FileAttachment[], position: { x: number; y: number }) => {
    setHiddenFilesMenu({ files, position });
  }, []);

  const closeHiddenFilesMenu = useCallback(() => {
    setHiddenFilesMenu(null);
  }, []);

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
  
  // レイアウト計算
  const hasDisplayImage = firstImageFile !== null;
  
  // ノードの高さを考慮してファイルカードを配置
  // 画像がある場合: 画像の下から10px下
  // 画像がない場合: ノードテキストから10px下
  const nonImageFileYOffset = hasDisplayImage 
    ? node.y + imageHeight - 35 + 10  // 画像の下に10pxの間隔
    : node.y + 10;                    // ノードテキストから10px下

  return (
    <>
      {/* 最初の画像ファイルのみ表示（元の位置） */}
      {firstImageFile && (
        <g key={firstImageFile.id}>
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
              borderRadius: '6px',
              overflow: 'hidden',
              border: '2px solid #fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              backgroundColor: '#fff'
            }}>
              {firstImageFile.downloadUrl && firstImageFile.downloadUrl.includes('/api/files/') ? (
                <CloudImage
                  file={firstImageFile}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease'
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
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease'
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