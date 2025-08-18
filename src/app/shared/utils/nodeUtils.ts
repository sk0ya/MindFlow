import type { MindMapNode, FileAttachment } from '@shared/types';

interface NodeSize {
  width: number;
  height: number;
  imageHeight: number;
}

/**
 * テキストの表示幅を計算（全角文字を考慮）
 * @param text 計算対象のテキスト
 * @returns 表示幅（半角文字1文字を1とした単位）
 */
function calculateTextWidth(text: string): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    
    // 全角文字の判定
    if (
      // 日本語文字（ひらがな、カタカナ、漢字）
      (code >= 0x3040 && code <= 0x309F) || // ひらがな
      (code >= 0x30A0 && code <= 0x30FF) || // カタカナ
      (code >= 0x4E00 && code <= 0x9FAF) || // 漢字
      // 全角記号・全角英数字
      (code >= 0xFF00 && code <= 0xFFEF) ||
      // その他の全角文字
      char.match(/[^\x00-\x7F]/)
    ) {
      width += 2; // 全角文字は2倍の幅
    } else {
      width += 1; // 半角文字は1倍の幅
    }
  }
  return width;
}

export function calculateNodeSize(node: MindMapNode, editText?: string, isEditing: boolean = false): NodeSize {
  // 画像の有無を確認
  const hasImages = node.attachments && node.attachments.some((file: FileAttachment) => file.isImage);
  const imageHeight = hasImages ? 60 : 0; // 画像表示エリアの高さ
  
  // 編集中は editText の長さ、非編集時は表示用の長さを使用
  const effectiveText = isEditing && editText !== undefined ? editText : node.text;
  
  let displayTextWidth: number;
  if (isEditing) {
    // 編集中は実際のテキスト幅を計算し、最小10文字分の幅を確保
    displayTextWidth = Math.max(calculateTextWidth(effectiveText), 10);
  } else {
    // 非編集時は25文字を超える場合は省略表示を考慮
    if (node.text.length > 25) {
      const truncatedText = node.text.substring(0, 25) + '...';
      displayTextWidth = calculateTextWidth(truncatedText);
    } else {
      displayTextWidth = Math.max(calculateTextWidth(node.text), 5); // 最小5文字分の幅
    }
  }
  
  const nodeWidth = Math.max(displayTextWidth * 8, hasImages ? 150 : 20); // 最小20pxを確保
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