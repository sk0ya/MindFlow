import type { MindMapNode, FileAttachment } from '@shared/types';
import type { NormalizedData } from '../../core/data/normalizedStore';
import { COLORS } from '../constants';

// アイコンレイアウト情報
interface IconLayout {
  totalWidth: number; // アイコン群の総幅
  attachmentIcon?: {
    x: number; // ノード中心からの相対X座標
    y: number; // ノード中心からの相対Y座標
  };
  linkIcon?: {
    x: number; // ノード中心からの相対X座標
    y: number; // ノード中心からの相対Y座標
  };
}

interface NodeSize {
  width: number;
  height: number;
  imageHeight: number;
}

// Canvas要素を使用してテキストの実際の幅を測定するためのキャッシュ
let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

/**
 * 測定用Canvasコンテキストを確実に初期化する
 */
function ensureMeasureContext(): CanvasRenderingContext2D | null {
  if (!measureCanvas || !measureContext) {
    measureCanvas = document.createElement('canvas');
    // DOMの影響を受けないようにCanvasを完全に隠し、配置しない
    measureCanvas.style.position = 'absolute';
    measureCanvas.style.left = '-9999px';
    measureCanvas.style.top = '-9999px';
    measureCanvas.style.visibility = 'hidden';
    measureCanvas.width = 1;
    measureCanvas.height = 1;
    
    measureContext = measureCanvas.getContext('2d');
    
    if (!measureContext) {
      return null;
    }
    
    // デフォルトのフォント設定でコンテキストをリセット
    measureContext.font = '14px system-ui, -apple-system, sans-serif';
    measureContext.textBaseline = 'alphabetic';
    measureContext.textAlign = 'left';
  }
  return measureContext;
}

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
  
  // 測定用Canvasコンテキストを確実に取得
  const context = ensureMeasureContext();
  
  if (!context) {
    // Canvas APIが使用できない場合は従来の文字数ベースの計算にフォールバック
    return calculateTextWidthFallback(text) * fontSize * 0.6;
  }
  
  // フォント設定を適用（毎回明示的に設定して一貫性を保つ）
  const fontString = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  context.font = fontString;
  
  // 一貫した測定のためにベースラインとアラインメントを再設定
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  
  // テキストの実際の幅を測定
  const metrics = context.measureText(text);
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

/**
 * ノードのアイコンレイアウトを計算
 */
export function calculateIconLayout(node: MindMapNode, nodeWidth: number): IconLayout {
  const hasAttachments = node.attachments && node.attachments.length > 0;
  const hasLinks = node.links && node.links.length > 0;
  
  // アイコンの基本サイズ
  const ICON_WIDTH = 32;
  const ICON_HEIGHT = 16;
  const ICON_SPACING = 6;
  const RIGHT_MARGIN = 12; // ノード右端からの最小マージン
  
  let totalWidth = 0;
  let attachmentIcon: { x: number; y: number } | undefined;
  let linkIcon: { x: number; y: number } | undefined;
  
  if (hasAttachments && hasLinks) {
    // 両方ある場合: 添付ファイル + スペース + リンク
    totalWidth = ICON_WIDTH + ICON_SPACING + ICON_WIDTH;
    const startX = nodeWidth / 2 - totalWidth - RIGHT_MARGIN;
    
    attachmentIcon = { x: startX, y: -ICON_HEIGHT / 2 };
    linkIcon = { x: startX + ICON_WIDTH + ICON_SPACING, y: -ICON_HEIGHT / 2 };
  } else if (hasAttachments) {
    // 添付ファイルのみ
    totalWidth = ICON_WIDTH;
    const startX = nodeWidth / 2 - totalWidth - RIGHT_MARGIN;
    
    attachmentIcon = { x: startX, y: -ICON_HEIGHT / 2 };
  } else if (hasLinks) {
    // リンクのみ
    totalWidth = ICON_WIDTH;
    const startX = nodeWidth / 2 - totalWidth - RIGHT_MARGIN;
    
    linkIcon = { x: startX, y: -ICON_HEIGHT / 2 };
  }
  
  return {
    totalWidth,
    attachmentIcon,
    linkIcon
  };
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
      // デフォルトの画像サイズを使用
      imageWidth = 150;
      imageHeight = 105;
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
  
  // アイコンレイアウトに必要な最小幅を計算
  const hasAttachments = node.attachments && node.attachments.length > 0;
  const hasLinks = node.links && node.links.length > 0;
  const ICON_WIDTH = 32;
  const ICON_SPACING = 6;
  const RIGHT_MARGIN = 12;
  
  let minIconWidth = 0;
  if (hasAttachments && hasLinks) {
    minIconWidth = ICON_WIDTH + ICON_SPACING + ICON_WIDTH + RIGHT_MARGIN;
  } else if (hasAttachments || hasLinks) {
    minIconWidth = ICON_WIDTH + RIGHT_MARGIN;
  }
  
  // パディングを追加（左右に余白を持たせる）
  const horizontalPadding = fontSize * 1.5; // フォントサイズに比例したパディング
  const textBasedWidth = Math.max(actualTextWidth + horizontalPadding, fontSize * 2);
  
  // ノードの高さは最小限に（フォントサイズ + 少しの上下パディング）
  const baseNodeHeight = Math.max(fontSize + 8, 22); // フォントサイズ + 上下4pxずつの最小パディング
  
  // アイコンとテキストが共存する場合の幅計算
  let finalWidth: number;
  
  if (minIconWidth > 0) {
    // アイコンがある場合：テキスト幅 + アイコン幅 + 余白を確保
    const TEXT_ICON_SPACING = 14; // テキストとアイコン間の余白
    const combinedWidth = textBasedWidth + minIconWidth + TEXT_ICON_SPACING;
    const imageBasedWidth = hasImages ? imageWidth + 10 : 0;
    finalWidth = Math.max(combinedWidth, imageBasedWidth);
  } else {
    // アイコンがない場合：従来通り
    const imageBasedWidth = hasImages ? imageWidth + 10 : 0;
    finalWidth = Math.max(textBasedWidth, imageBasedWidth);
  }
  
  const nodeWidth = finalWidth;
  // 画像マージンはレイアウト計算に含めず、描画時のみ使用
  const nodeHeight = baseNodeHeight + imageHeight;

  return {
    width: nodeWidth,
    height: nodeHeight,
    imageHeight
  };
}

/**
 * ノードの左端X座標を計算
 */
export function getNodeLeftX(node: MindMapNode, nodeWidth: number): number {
  return node.x - nodeWidth / 2;
}

export function getToggleButtonPosition(node: MindMapNode, rootNode: MindMapNode, nodeSize: NodeSize, globalFontSize?: number) {
  const isOnRight = node.x > rootNode.x;
  
  // フォントサイズとノードサイズに応じた動的なマージン調整
  const fontSize = globalFontSize || 14;
  
  // フォントサイズに比例した基本マージン
  let baseMargin = Math.max(fontSize * 1.5, 20);
  
  // 画像の高さに応じてマージンを調整
  if (nodeSize.imageHeight > 100) {
    baseMargin = baseMargin + (nodeSize.imageHeight - 100) * 0.1;
  }
  
  // 幅に応じた追加調整（フォントサイズも考慮）
  const expectedMinWidth = fontSize * 8; // 想定される最小幅
  const widthAdjustment = Math.max(0, (nodeSize.width - expectedMinWidth) * 0.08);
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

/**
 * ノードのルートブランチを特定し、そのブランチに対応する色を返す
 * @param nodeId ノードID
 * @param normalizedData 正規化されたデータ
 * @returns ブランチカラー
 */
export function getBranchColor(nodeId: string, normalizedData: NormalizedData): string {
  if (!normalizedData || !nodeId) return '#666';
  
  // ルートノードの場合は基本色
  if (nodeId === 'root') return '#333';
  
  // 現在のノードから親を辿ってルートノードの直接の子（ブランチルート）を見つける
  let currentNodeId = nodeId;
  let branchRootId: string | null = null;
  
  while (currentNodeId && currentNodeId !== 'root') {
    const parentId = normalizedData.parentMap[currentNodeId];
    
    if (parentId === 'root') {
      // ルートノードの直接の子が見つかった（これがブランチルート）
      branchRootId = currentNodeId;
      break;
    }
    
    if (!parentId) break;
    currentNodeId = parentId;
  }
  
  // ブランチルートが見つからない場合はデフォルト色
  if (!branchRootId) return '#666';
  
  // ルートノードの子ノード一覧を取得して、インデックスを特定
  const rootChildren = normalizedData.childrenMap['root'] || [];
  const branchIndex = rootChildren.indexOf(branchRootId);
  
  // インデックスに基づいて色を決定
  if (branchIndex >= 0) {
    return COLORS.NODE_COLORS[branchIndex % COLORS.NODE_COLORS.length];
  }
  
  return '#666';
}