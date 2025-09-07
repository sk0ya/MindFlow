import type { MindMapNode, FileAttachment } from '@shared/types';

interface NodeSize {
  width: number;
  height: number;
  imageHeight: number;
}

// Canvas要素を使用してテキストの実際の幅を測定するためのキャッシュ
let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

/**
 * Canvas APIを使用してテキストの実際の幅を測定
 * @param text 計算対象のテキスト
 * @param fontSize フォントサイズ（px）
 * @param fontFamily フォントファミリー
 * @param fontWeight フォントウェイト
 * @param fontStyle フォントスタイル
 * @returns 実際のピクセル幅
 */
function measureTextWidth(
  text: string, 
  fontSize: number = 14, 
  fontFamily: string = 'system-ui, -apple-system, sans-serif',
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): number {
  // 空文字の場合は0を返す
  if (!text) return 0;
  
  // Canvasコンテキストを初期化（一度だけ）
  if (!measureCanvas || !measureContext) {
    measureCanvas = document.createElement('canvas');
    measureContext = measureCanvas.getContext('2d');
    
    if (!measureContext) {
      // Canvas APIが使用できない場合は従来の文字数ベースの計算にフォールバック
      return calculateTextWidthFallback(text) * fontSize * 0.6;
    }
  }
  
  // フォント設定を適用
  const fontString = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  measureContext.font = fontString;
  
  // テキストの実際の幅を測定
  const metrics = measureContext.measureText(text);
  return metrics.width;
}

/**
 * テキストの表示幅を計算（全角文字を考慮） - フォールバック用
 * @param text 計算対象のテキスト
 * @returns 表示幅（半角文字1文字を1とした単位）
 */
function calculateTextWidthFallback(text: string): number {
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
      code > 0x007F
    ) {
      width += 2; // 全角文字は2倍の幅
    } else {
      width += 1; // 半角文字は1倍の幅
    }
  }
  return width;
}

export function calculateNodeSize(
  node: MindMapNode, 
  editText?: string, 
  isEditing: boolean = false,
  globalFontSize?: number
): NodeSize {
  // 画像の有無とサイズを確認
  const hasImages = node.attachments && node.attachments.some((file: FileAttachment) => file.isImage);
  
  let imageHeight = 0;
  let imageWidth = 0;
  
  if (hasImages) {
    // カスタムサイズを優先
    if (node.customImageWidth && node.customImageHeight) {
      imageWidth = node.customImageWidth;
      imageHeight = node.customImageHeight;
    } else {
      // ノードの画像サイズ設定を取得
      const imageSize = node.imageSize || 'medium';
      const sizeMap = {
        'small': { width: 100, height: 70 },
        'medium': { width: 150, height: 105 },
        'large': { width: 200, height: 140 },
        'extra-large': { width: 250, height: 175 }
      };
      const dimensions = sizeMap[imageSize];
      imageWidth = dimensions.width;
      imageHeight = dimensions.height;
    }
  }
  
  // 編集中は editText の長さ、非編集時は表示用の長さを使用
  const effectiveText = isEditing && editText !== undefined ? editText : node.text;
  
  // フォント設定を取得
  const fontSize = globalFontSize || node.fontSize || 14;
  const fontFamily = node.fontFamily || 'system-ui, -apple-system, sans-serif';
  const fontWeight = node.fontWeight || 'normal';
  const fontStyle = node.fontStyle || 'normal';
  
  // Canvas APIを使用して実際のテキスト幅を測定
  let actualTextWidth: number;
  if (isEditing) {
    // 編集中は実際のテキスト幅を計算し、最小幅を確保
    const measuredWidth = measureTextWidth(effectiveText, fontSize, fontFamily, fontWeight, fontStyle);
    const minWidth = fontSize * 8; // 最小8文字分の幅
    actualTextWidth = Math.max(measuredWidth, minWidth);
  } else {
    // 非編集時は実際のテキスト幅を計算
    const measuredWidth = measureTextWidth(node.text, fontSize, fontFamily, fontWeight, fontStyle);
    const minWidth = fontSize * 4; // 最小4文字分の幅
    actualTextWidth = Math.max(measuredWidth, minWidth);
  }
  
  // 添付ファイルクリップアイコン用の余白を追加
  const hasAttachments = node.attachments && node.attachments.length > 0;
  const clipIconPadding = hasAttachments ? 40 : 0; // クリップアイコンと個数表示のための余白
  
  // パディングを追加（左右に余白を持たせる）
  const horizontalPadding = fontSize * 1.5; // フォントサイズに比例したパディング
  const textBasedWidth = Math.max(actualTextWidth + horizontalPadding + clipIconPadding, fontSize * 2);
  
  // ノードの高さもフォントサイズに応じて調整
  const baseNodeHeight = Math.max(fontSize * 2.5, 30); // フォントサイズに比例した最小高さ
  
  // 画像がある場合は画像幅とテキスト幅の大きい方を使用（画像の左右マージン10px追加）
  const nodeWidth = hasImages ? Math.max(textBasedWidth, imageWidth + 10) : textBasedWidth;
  const nodeHeight = baseNodeHeight + imageHeight;

  return {
    width: nodeWidth,
    height: nodeHeight,
    imageHeight
  };
}

export function getToggleButtonPosition(node: MindMapNode, rootNode: MindMapNode, nodeSize: NodeSize) {
  const isOnRight = node.x > rootNode.x;
  
  // ノードサイズに応じた動的なマージン調整
  // 画像が大きい場合は、より大きなマージンを適用
  let baseMargin = 20;
  
  // 画像の高さに応じてマージンを調整
  if (nodeSize.imageHeight > 100) {
    baseMargin = 25 + (nodeSize.imageHeight - 100) * 0.1;
  }
  
  // 幅に応じた追加調整
  const widthAdjustment = Math.max(0, (nodeSize.width - 100) * 0.05);
  const totalMargin = baseMargin + widthAdjustment;
  
  // ノードの右端から一定距離でトグルボタンを配置
  const nodeRightEdge = node.x + nodeSize.width / 2;
  const nodeLeftEdge = node.x - nodeSize.width / 2;
  
  const toggleX = isOnRight ? (nodeRightEdge + totalMargin) : (nodeLeftEdge - totalMargin);
  const toggleY = node.y;
  
  return { x: toggleX, y: toggleY };
}

/**
 * 親ノードの右端から子ノードの左端までの水平距離を計算
 */
export function getDynamicNodeSpacing(parentNodeSize: NodeSize, childNodeSize: NodeSize, isRootChild: boolean = false): number {
  if (isRootChild) {
    // ルートノードの子の場合：ルートノードのサイズに応じて調整
    const baseDistance = 120; // LAYOUT.ROOT_TO_CHILD_DISTANCE
    const widthAdjustment = Math.max(0, (parentNodeSize.width - 100) * 0.2);
    const imageAdjustment = parentNodeSize.imageHeight > 0 ? parentNodeSize.imageHeight * 0.15 : 0;
    
    return baseDistance + widthAdjustment + imageAdjustment;
  } else {
    // 通常の親子間：両方のノードサイズを考慮
    const baseDistance = 60; // LAYOUT.TOGGLE_TO_CHILD_DISTANCE
    const parentWidthAdjustment = Math.max(0, (parentNodeSize.width - 100) * 0.1);
    const parentImageAdjustment = parentNodeSize.imageHeight > 0 ? parentNodeSize.imageHeight * 0.1 : 0;
    const childSizeAdjustment = Math.max(0, (childNodeSize.width - 100) * 0.05);
    
    return baseDistance + parentWidthAdjustment + parentImageAdjustment + childSizeAdjustment;
  }
}

/**
 * 親ノードの右端から子ノードの左端までの距離に基づいて子ノードのX座標を計算
 */
export function calculateChildNodeX(parentNode: MindMapNode, childNodeSize: NodeSize, edgeToEdgeDistance: number): number {
  const parentNodeSize = calculateNodeSize(parentNode);
  const parentRightEdge = parentNode.x + parentNodeSize.width / 2;
  const childLeftEdge = parentRightEdge + edgeToEdgeDistance;
  const childCenterX = childLeftEdge + childNodeSize.width / 2;
  
  return childCenterX;
}