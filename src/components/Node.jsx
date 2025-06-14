import React, { useRef, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';

const Node = ({
  node,
  isSelected,
  isEditing,
  isDragTarget,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onDragStart,
  onDragMove,
  onDragEnd,
  onAddChild,
  onDelete,
  onRightClick,
  onFileUpload,
  onRemoveFile,
  onShowImageModal,
  editText,
  setEditText,
  zoom,
  svgRef
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgX = (e.clientX - svgRect.left) / zoom;
      const svgY = (e.clientY - svgRect.top) / zoom;
      
      setIsDragging(true);
      setDragStart({
        x: svgX - node.x,
        y: svgY - node.y
      });
      
      // ドラッグ開始を通知
      if (onDragStart) {
        onDragStart(node.id);
      }
    }
    
    onSelect(node.id);
  }, [node.x, node.y, node.id, onSelect, onDragStart, zoom, svgRef]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      // ドラッグ中の位置を通知（ドロップターゲット検出用）
      if (onDragMove) {
        onDragMove(e.clientX, e.clientY);
      }
    }
  }, [isDragging, onDragMove]);

  const handleMouseUp = useCallback((e) => {
    if (isDragging && svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgX = (e.clientX - svgRect.left) / zoom;
      const svgY = (e.clientY - svgRect.top) / zoom;
      
      const newX = svgX - dragStart.x;
      const newY = svgY - dragStart.y;
      
      // ドラッグ終了を通知（親要素変更またはノード移動）
      if (onDragEnd) {
        onDragEnd(node.id, newX, newY);
      }
    }
    setIsDragging(false);
  }, [isDragging, dragStart, node.id, onDragEnd, zoom, svgRef]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 編集モードが終了した時にIME状態をリセット
  useEffect(() => {
    if (!isEditing) {
      setIsComposing(false);
      // タイマーもクリア
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    }
  }, [isEditing]);

  // コンポーネントのアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // 常に選択処理を実行
    // 編集中のノード自体をクリックした場合でも選択状態は更新
    onSelect(node.id);
  }, [node.id, onSelect]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    onStartEdit(node.id);
  }, [node.id, onStartEdit]);

  const handleRightClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onRightClick) {
      onRightClick(e, node.id);
    }
  }, [node.id, onRightClick]);

  // 編集終了を即座に実行する関数
  const finishEditImmediately = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    onFinishEdit(node.id, editText);
  }, [node.id, editText, onFinishEdit]);

  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    
    // IME変換中は何もしない
    if (isComposing) {
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEditImmediately();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Escapeの場合は元のテキストに戻す
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      onFinishEdit(node.id, node.text);
    }
  }, [node.id, node.text, finishEditImmediately, isComposing]);

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  const handleInputBlur = useCallback((e) => {
    // IME変換中でない場合のみ編集を終了
    if (!isComposing) {
      // 既存のタイマーをクリア
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      
      // 短い遅延で編集を終了（マウスクリック等との競合を避ける）
      blurTimeoutRef.current = setTimeout(() => {
        onFinishEdit(node.id, editText);
        blurTimeoutRef.current = null;
      }, 50);
    }
  }, [node.id, editText, onFinishEdit, isComposing]);

  // ファイルアップロードのハンドラ
  const handleFileUpload = useCallback((e) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFileUpload) {
      onFileUpload(node.id, files);
    }
    // ファイル入力をリセット
    e.target.value = '';
  }, [node.id, onFileUpload]);
  
  const handleRemoveFile = useCallback((fileId) => {
    if (onRemoveFile) {
      onRemoveFile(node.id, fileId);
    }
  }, [node.id, onRemoveFile]);

  const handleImageDoubleClick = useCallback((e, file) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowImageModal && file.isImage) {
      onShowImageModal(file);
    }
  }, [onShowImageModal]);
  
  // ノードのサイズ計算（画像を考慮）
  const hasImages = node.attachments && node.attachments.some(file => file.isImage);
  const imageHeight = hasImages ? 60 : 0; // 画像表示エリアの高さ
  const nodeWidth = Math.max(120, node.text.length * 8, hasImages ? 150 : 0);
  const nodeHeight = 40 + imageHeight;

  return (
    <g>
      <rect
        x={node.x - nodeWidth / 2}
        y={node.y - nodeHeight / 2}
        width={nodeWidth}
        height={nodeHeight}
        fill="white"
        stroke={isDragTarget ? "#ff9800" : (isSelected ? "#4285f4" : "#ddd")}
        strokeWidth={isDragTarget ? "3" : (isSelected ? "2" : "1")}
        strokeDasharray={isDragTarget ? "5,5" : "none"}
        rx="8"
        ry="8"
        role="button"
        tabIndex={0}
        aria-label={`Mind map node: ${node.text}`}
        aria-selected={isSelected}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          filter: isDragTarget 
            ? 'drop-shadow(0 4px 12px rgba(255,152,0,0.3))' 
            : (isSelected ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.1))')
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleRightClick}
      />
      
      {/* 画像添付ファイルの表示 */}
      {node.attachments && node.attachments.filter(file => file.isImage).map((file, index) => (
        <g key={file.id}>
          <foreignObject 
            x={node.x - nodeWidth / 2 + 5} 
            y={node.y - nodeHeight / 2 + 5} 
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
              <img 
                src={file.dataURL} 
                alt={file.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  cursor: 'pointer'
                }}
                onDoubleClick={(e) => handleImageDoubleClick(e, file)}
              />
              {isSelected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(file.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(234, 67, 53, 0.9)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </foreignObject>
        </g>
      ))}
      
      {/* 非画像ファイルの表示 */}
      {node.attachments && node.attachments.filter(file => !file.isImage).map((file, index) => {
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
            {isSelected && (
              <circle
                cx={node.x + nodeWidth / 2 - 10}
                cy={yOffset}
                r="6"
                fill="#ea4335"
                stroke="white"
                strokeWidth="1"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(file.id);
                }}
              />
            )}
          </g>
        );
      })}

      {isEditing ? (
        <foreignObject 
          x={node.x - nodeWidth / 2 + 10} 
          y={node.y - 10 + imageHeight / 2} 
          width={nodeWidth - 20} 
          height="20"
        >
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onBlur={handleInputBlur}
            autoFocus
            style={{
              width: '100%',
              border: '1px solid #ccc',
              background: 'white',
              textAlign: 'center',
              fontSize: node.fontSize || '14px',
              fontWeight: node.fontWeight || 'normal',
              fontStyle: node.fontStyle || 'normal',
              color: 'black',
              outline: 'none',
              borderRadius: '4px',
              padding: '2px 4px'
            }}
          />
        </foreignObject>
      ) : (
        <text
          x={node.x}
          y={node.y + 5 + imageHeight / 2}
          textAnchor="middle"
          fill="black"
          fontSize={node.fontSize || '14px'}
          fontWeight={node.fontWeight || 'normal'}
          fontStyle={node.fontStyle || 'normal'}
          style={{ 
            pointerEvents: 'none', 
            userSelect: 'none'
          }}
        >
          {node.text}
        </text>
      )}

      {isSelected && !isEditing && (
        <g>
          <circle
            cx={node.x - 35}
            cy={node.y + nodeHeight / 2 + 12}
            r="8"
            fill="#4285f4"
            stroke="white"
            strokeWidth="2"
            role="button"
            tabIndex={0}
            aria-label="Add child node"
            style={{ 
              cursor: 'pointer',
              filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
          />
          <text
            x={node.x - 35}
            y={node.y + nodeHeight / 2 + 12 + 3}
            textAnchor="middle"
            fill="white"
            fontSize="12"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            +
          </text>
          
          {/* ファイルアップロードボタン */}
          <circle
            cx={node.x - 15}
            cy={node.y + nodeHeight / 2 + 12}
            r="8"
            fill="#34a853"
            stroke="white"
            strokeWidth="2"
            role="button"
            tabIndex={0}
            aria-label="Upload file"
            style={{ 
              cursor: 'pointer',
              filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))'
            }}
            onClick={(e) => {
              e.stopPropagation();
              const fileInput = document.createElement('input');
              fileInput.type = 'file';
              fileInput.accept = 'image/*,text/plain,application/pdf,application/json';
              fileInput.onchange = handleFileUpload;
              fileInput.click();
            }}
          />
          <text
            x={node.x - 15}
            y={node.y + nodeHeight / 2 + 12 + 3}
            textAnchor="middle"
            fill="white"
            fontSize="10"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            📎
          </text>

          {node.id !== 'root' && (
            <>
              <circle
                cx={node.x + 15}
                cy={node.y + nodeHeight / 2 + 12}
                r="8"
                fill="#ea4335"
                stroke="white"
                strokeWidth="2"
                role="button"
                tabIndex={0}
                aria-label="Delete node"
                style={{ 
                  cursor: 'pointer',
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node.id);
                }}
              />
              <text
                x={node.x + 15}
                y={node.y + nodeHeight / 2 + 12 + 3}
                textAnchor="middle"
                fill="white"
                fontSize="12"
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                ×
              </text>
            </>
          )}
        </g>
      )}
    </g>
  );
};

Node.propTypes = {
  node: PropTypes.shape({
    id: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    fontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    fontWeight: PropTypes.string,
    fontStyle: PropTypes.string,
    attachments: PropTypes.arrayOf(PropTypes.object)
  }).isRequired,
  isSelected: PropTypes.bool.isRequired,
  isEditing: PropTypes.bool.isRequired,
  isDragTarget: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onStartEdit: PropTypes.func.isRequired,
  onFinishEdit: PropTypes.func.isRequired,
  onDragStart: PropTypes.func,
  onDragMove: PropTypes.func,
  onDragEnd: PropTypes.func,
  onAddChild: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRightClick: PropTypes.func,
  onFileUpload: PropTypes.func.isRequired,
  onRemoveFile: PropTypes.func.isRequired,
  onShowImageModal: PropTypes.func.isRequired,
  editText: PropTypes.string.isRequired,
  setEditText: PropTypes.func.isRequired,
  zoom: PropTypes.number.isRequired,
  svgRef: PropTypes.shape({
    current: PropTypes.instanceOf(Element)
  }).isRequired
};

export default Node;
