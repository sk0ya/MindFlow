import type { MindMapNode, FileAttachment } from '@shared/types';

interface NodeSize {
  width: number;
  height: number;
  imageHeight: number;
}

export function calculateNodeSize(node: MindMapNode, editText?: string, isEditing: boolean = false): NodeSize {
  // 画像の有無を確認
  const hasImages = node.attachments && node.attachments.some((file: FileAttachment) => file.isImage);
  const imageHeight = hasImages ? 60 : 0; // 画像表示エリアの高さ
  
  // 編集中は editText の長さ、非編集時は表示用の長さを使用
  const effectiveText = isEditing && editText !== undefined ? editText : node.text;
  const displayTextLength = isEditing 
    ? Math.max(effectiveText.length, 10) // 編集中は最小10文字幅を確保
    : (node.text.length > 25 ? 28 : Math.max(node.text.length, 5)); // 非編集時は最小5文字幅
  
  const nodeWidth = Math.max(displayTextLength * 8, hasImages ? 150 : 20); // 最小20pxを確保
  const nodeHeight = 40 + imageHeight;

  return {
    width: nodeWidth,
    height: nodeHeight,
    imageHeight
  };
}

export function getToggleButtonPosition(node: MindMapNode, rootNode: MindMapNode, nodeSize: NodeSize) {
  const isOnRight = node.x > rootNode.x;
  // ノードの半分の幅に少しマージンを加えてトグルボタンを配置
  const toggleOffset = isOnRight ? (nodeSize.width / 2 + 20) : -(nodeSize.width / 2 + 20);
  const toggleX = node.x + toggleOffset;
  const toggleY = node.y;
  
  return { x: toggleX, y: toggleY };
}