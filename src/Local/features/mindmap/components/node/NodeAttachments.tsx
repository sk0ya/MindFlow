import React, { useCallback, memo } from 'react';
import type { MindMapNode, FileAttachment } from '@shared/types';

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
            y={node.y - nodeWidth / 2 + 5} 
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