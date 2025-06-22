import React, { useRef, useState, useCallback, useEffect, memo, useMemo } from 'react';
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
  onAddSibling,
  onDelete,
  onRightClick,
  onFileUpload,
  onRemoveFile,
  onShowImageModal,
  onShowFileActionMenu,
  onShowNodeMapLinks,
  editText,
  setEditText,
  zoom,
  pan,
  svgRef
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  
  // 編集モードになった時に確実にフォーカスを設定
  useEffect(() => {
    if (isEditing && inputRef.current) {
      // 少し遅延してからフォーカス（DOM更新完了後）
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
          console.log('🎯 フォーカス設定完了:', { nodeId: node.id, focused: document.activeElement === inputRef.current });
        }
      }, 10);
    }
  }, [isEditing, node.id]);

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgX = (e.clientX - svgRect.left) / zoom;
      const svgY = (e.clientY - svgRect.top) / zoom;
      
      // マウスダウン位置を記録（ドラッグ判定用）
      setMouseDownPos({ x: e.clientX, y: e.clientY });
      setDragStart({
        x: svgX - node.x,
        y: svgY - node.y
      });
    }
  }, [node.x, node.y, zoom, svgRef]);

  const handleMouseMove = useCallback((e) => {
    if (mouseDownPos && !isDragging) {
      // ドラッグ開始判定（5px以上移動でドラッグとみなす）
      const distance = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.x, 2) + 
        Math.pow(e.clientY - mouseDownPos.y, 2)
      );
      
      if (distance > 5) {
        setIsDragging(true);
        // ドラッグ開始を通知
        if (onDragStart) {
          onDragStart(node.id);
        }
      }
    } else if (isDragging) {
      // ドラッグ中の位置を通知（ドロップターゲット検出用）
      if (onDragMove) {
        onDragMove(e.clientX, e.clientY);
      }
    }
  }, [isDragging, mouseDownPos, onDragMove, onDragStart, node.id]);

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
    
    // 状態をリセット
    setIsDragging(false);
    setMouseDownPos(null);
  }, [isDragging, dragStart, node.id, onDragEnd, zoom, svgRef]);

  useEffect(() => {
    if (isDragging || mouseDownPos) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, mouseDownPos, handleMouseMove, handleMouseUp]);

  // 編集モードが終了した時にIME状態をリセット
  useEffect(() => {
    if (!isEditing) {
      setIsComposing(false);
      // タイマーもクリア
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    } else if (isEditing && inputRef.current) {
      // 編集モード開始時に確実にフォーカス
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select(); // テキストを選択状態にする
        }
      }, 10);
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
    
    // ドラッグが発生していない場合のみクリック処理
    if (!isDragging) {
      if (isSelected && !isEditing) {
        // 既に選択されている場合は編集モードに入る
        onStartEdit(node.id);
      } else {
        // 未選択の場合は選択のみ
        onSelect(node.id);
      }
    }
  }, [node.id, isDragging, isSelected, isEditing, onStartEdit, onSelect]);

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

  // 編集終了を即座に実行する関数（blur用）
  const finishEditImmediately = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    onFinishEdit(node.id, editText);
  }, [node.id, editText, onFinishEdit]);

  const handleKeyDown = useCallback((e) => {
    console.log('🎹 Node.jsx handleKeyDown:', { key: e.key, isComposing, editText });
    
    // IME変換中は何もしない
    if (isComposing) {
      console.log('🎹 IME変換中のためスキップ');
      return;
    }
    
    // 編集中の入力フィールドでは、Escapeのみ処理（他はuseKeyboardShortcutsに委任）
    if (e.key === 'Escape') {
      e.preventDefault();
      console.log('🎹 Escape処理: 元のテキストに戻す');
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      onFinishEdit(node.id, node.text);
    }
    // Tab/EnterはuseKeyboardShortcutsで統一処理
  }, [node.id, node.text, isComposing, onFinishEdit]);

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  const handleInputBlur = useCallback((e) => {
    // IME変換中でない場合のみ編集を終了
    if (!isComposing) {
      console.log('🎹 Node.jsx blur処理:', { 
        nodeId: node.id, 
        originalText: node.text, 
        editText, 
        targetValue: e.target.value 
      });
      
      // 既存のタイマーをクリア
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      
      // 最新の入力値を即座に取得（DOM要素から直接取得）
      const currentValue = e.target ? e.target.value : editText;
      console.log('🎹 Node.jsx blur実行:', { 
        nodeId: node.id,
        finalValue: currentValue,
        isEmpty: !currentValue || currentValue.trim() === '',
        isRoot: node.id === 'root'
      });
      
      // 即座に編集完了処理を実行（finishEditが削除判定を行う）
      onFinishEdit(node.id, currentValue);
    }
  }, [node.id, node.text, editText, onFinishEdit, isComposing]);

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

  const handleFileActionMenu = useCallback((e, file) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowFileActionMenu) {
      // SVGイベントの場合は座標を適切に取得
      const clientX = e.clientX || (e.nativeEvent && e.nativeEvent.clientX) || 0;
      const clientY = e.clientY || (e.nativeEvent && e.nativeEvent.clientY) || 0;
      
      onShowFileActionMenu(file, node.id, {
        x: clientX,
        y: clientY
      });
    }
  }, [onShowFileActionMenu, node.id]);

  const handleShowMapLinks = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowNodeMapLinks) {
      onShowNodeMapLinks(node, {
        x: e.clientX,
        y: e.clientY
      });
    }
  }, [onShowNodeMapLinks, node]);
  
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
          cursor: isDragging ? 'grabbing' : 'pointer',
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
                onClick={(e) => handleFileActionMenu(e, file)}
                onDoubleClick={(e) => handleImageDoubleClick(e, file)}
                onContextMenu={(e) => handleFileActionMenu(e, file)}
              />
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
            className="node-input"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onBlur={handleInputBlur}
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
            cy={node.y + nodeHeight / 2 + 15}
            r="12"
            fill="#4285f4"
            stroke="white"
            strokeWidth="2"
            role="button"
            tabIndex={0}
            aria-label="Add child node"
            style={{ 
              cursor: 'pointer',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
          />
          <text
            x={node.x - 35}
            y={node.y + nodeHeight / 2 + 15 + 4}
            textAnchor="middle"
            fill="white"
            fontSize="16"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            +
          </text>
          
          {/* ファイルアップロードボタン */}
          <circle
            cx={node.x - 10}
            cy={node.y + nodeHeight / 2 + 15}
            r="12"
            fill="#34a853"
            stroke="white"
            strokeWidth="2"
            role="button"
            tabIndex={0}
            aria-label="Upload file"
            style={{ 
              cursor: 'pointer',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))'
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
            x={node.x - 10}
            y={node.y + nodeHeight / 2 + 15 + 4}
            textAnchor="middle"
            fill="white"
            fontSize="14"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            📎
          </text>

          {/* マップリンクボタン */}
          <circle
            cx={node.x + 15}
            cy={node.y + nodeHeight / 2 + 15}
            r="12"
            fill="#9c27b0"
            stroke="white"
            strokeWidth="2"
            role="button"
            tabIndex={0}
            aria-label="Map links"
            style={{ 
              cursor: 'pointer',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))'
            }}
            onClick={handleShowMapLinks}
          />
          <text
            x={node.x + 15}
            y={node.y + nodeHeight / 2 + 15 + 4}
            textAnchor="middle"
            fill="white"
            fontSize="14"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            🔗
          </text>

          {node.id !== 'root' && (
            <>
              <circle
                cx={node.x + 40}
                cy={node.y + nodeHeight / 2 + 15}
                r="12"
                fill="#ea4335"
                stroke="white"
                strokeWidth="2"
                role="button"
                tabIndex={0}
                aria-label="Delete node"
                style={{ 
                  cursor: 'pointer',
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node.id);
                }}
              />
              <text
                x={node.x + 40}
                y={node.y + nodeHeight / 2 + 15 + 4}
                textAnchor="middle"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                ×
              </text>
            </>
          )}
        </g>
      )}

      {/* マップリンクインジケーター */}
      {node.mapLinks && node.mapLinks.length > 0 && (
        <g>
          <circle
            cx={node.x + nodeWidth / 2 - 8}
            cy={node.y - nodeHeight / 2 + 8}
            r="6"
            fill="#9c27b0"
            stroke="white"
            strokeWidth="1"
            style={{ cursor: 'pointer' }}
            onClick={handleShowMapLinks}
          />
          <text
            x={node.x + nodeWidth / 2 - 8}
            y={node.y - nodeHeight / 2 + 8 + 2}
            textAnchor="middle"
            fill="white"
            fontSize="8"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            {node.mapLinks.length}
          </text>
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
    attachments: PropTypes.arrayOf(PropTypes.object),
    mapLinks: PropTypes.arrayOf(PropTypes.object)
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
  onAddSibling: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRightClick: PropTypes.func,
  onFileUpload: PropTypes.func.isRequired,
  onRemoveFile: PropTypes.func.isRequired,
  onShowImageModal: PropTypes.func.isRequired,
  onShowFileActionMenu: PropTypes.func.isRequired,
  onShowNodeMapLinks: PropTypes.func.isRequired,
  editText: PropTypes.string.isRequired,
  setEditText: PropTypes.func.isRequired,
  zoom: PropTypes.number.isRequired,
  pan: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  svgRef: PropTypes.shape({
    current: PropTypes.instanceOf(Element)
  }).isRequired
};

// React.memoでパフォーマンス最適化
// propsの浅い比較で再レンダリングを防ぐ
export default memo(Node, (prevProps, nextProps) => {
  // ノードの基本情報が変わった場合は再レンダリング
  if (prevProps.node.id !== nextProps.node.id ||
      prevProps.node.text !== nextProps.node.text ||
      prevProps.node.x !== nextProps.node.x ||
      prevProps.node.y !== nextProps.node.y ||
      prevProps.node.fontSize !== nextProps.node.fontSize ||
      prevProps.node.fontWeight !== nextProps.node.fontWeight ||
      prevProps.node.color !== nextProps.node.color ||
      prevProps.node.collapsed !== nextProps.node.collapsed) {
    return false;
  }

  // 添付ファイルが変わった場合は再レンダリング
  if (JSON.stringify(prevProps.node.attachments) !== JSON.stringify(nextProps.node.attachments)) {
    return false;
  }

  // 選択・編集状態が変わった場合は再レンダリング
  if (prevProps.isSelected !== nextProps.isSelected ||
      prevProps.isEditing !== nextProps.isEditing ||
      prevProps.isDragTarget !== nextProps.isDragTarget) {
    return false;
  }

  // 編集テキストが変わった場合は再レンダリング
  if (prevProps.editText !== nextProps.editText) {
    return false;
  }

  // ズーム・パンが変わった場合は再レンダリング
  if (prevProps.zoom !== nextProps.zoom ||
      prevProps.pan.x !== nextProps.pan.x ||
      prevProps.pan.y !== nextProps.pan.y) {
    return false;
  }

  // その他の場合は再レンダリングしない
  return true;
});
