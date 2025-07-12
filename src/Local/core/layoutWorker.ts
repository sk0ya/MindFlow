// Web Worker for heavy layout calculations
import type { MindMapNode } from '../shared/types';

interface LayoutWorkerMessage {
  type: 'CALCULATE_LAYOUT' | 'OPTIMIZE_POSITIONS' | 'CALCULATE_BOUNDS';
  payload: any;
}

interface LayoutResult {
  type: 'LAYOUT_COMPLETE' | 'POSITIONS_OPTIMIZED' | 'BOUNDS_CALCULATED';
  payload: any;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
}

interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

// レイアウト計算のメイン処理
class LayoutCalculator {
  private static readonly HORIZONTAL_SPACING = 200;
  private static readonly VERTICAL_SPACING = 120;
  private static readonly ROOT_POSITION = { x: 0, y: 0 };

  // 自動レイアウト計算
  static calculateAutoLayout(rootNode: MindMapNode): NodePosition[] {
    const positions: NodePosition[] = [];
    const processedNodes = new Set<string>();

    // ルートノードの配置
    positions.push({
      id: rootNode.id,
      x: this.ROOT_POSITION.x,
      y: this.ROOT_POSITION.y
    });
    processedNodes.add(rootNode.id);

    // BFS でレイアウトを計算
    const queue = [{ node: rootNode, depth: 0 }];
    
    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      
      if (node.children && node.children.length > 0) {
        const childPositions = this.calculateChildPositions(
          node,
          node.children,
          depth + 1
        );
        
        childPositions.forEach(pos => {
          if (!processedNodes.has(pos.id)) {
            positions.push(pos);
            processedNodes.add(pos.id);
            
            const childNode = node.children!.find(c => c.id === pos.id);
            if (childNode) {
              queue.push({ node: childNode, depth: depth + 1 });
            }
          }
        });
      }
    }

    return positions;
  }

  // 子ノードの位置計算
  private static calculateChildPositions(
    parentNode: MindMapNode,
    children: MindMapNode[],
    depth: number
  ): NodePosition[] {
    const positions: NodePosition[] = [];
    const parentX = parentNode.x;
    const parentY = parentNode.y;
    
    // 子ノードの配置方向決定（ルートノードは左右、他は右側）
    const isRoot = parentNode.id === 'root';
    const childCount = children.length;
    
    if (isRoot) {
      // ルートノードの場合は左右に配置
      const leftChildren = Math.ceil(childCount / 2);
      const rightChildren = childCount - leftChildren;
      
      // 左側の子ノード
      for (let i = 0; i < leftChildren; i++) {
        const child = children[i];
        positions.push({
          id: child.id,
          x: parentX - this.HORIZONTAL_SPACING * depth,
          y: parentY + (i - (leftChildren - 1) / 2) * this.VERTICAL_SPACING
        });
      }
      
      // 右側の子ノード
      for (let i = 0; i < rightChildren; i++) {
        const child = children[leftChildren + i];
        positions.push({
          id: child.id,
          x: parentX + this.HORIZONTAL_SPACING * depth,
          y: parentY + (i - (rightChildren - 1) / 2) * this.VERTICAL_SPACING
        });
      }
    } else {
      // 非ルートノードは右側に配置
      const direction = parentX > 0 ? 1 : -1; // 親の位置に基づいて方向決定
      
      for (let i = 0; i < childCount; i++) {
        const child = children[i];
        positions.push({
          id: child.id,
          x: parentX + direction * this.HORIZONTAL_SPACING,
          y: parentY + (i - (childCount - 1) / 2) * this.VERTICAL_SPACING
        });
      }
    }

    return positions;
  }

  // 位置の最適化（重複回避）
  static optimizePositions(positions: NodePosition[]): NodePosition[] {
    const optimized = [...positions];
    const iterations = 5;
    const repulsionForce = 50;
    
    for (let iter = 0; iter < iterations; iter++) {
      // 各ノードペアの反発力計算
      for (let i = 0; i < optimized.length; i++) {
        for (let j = i + 1; j < optimized.length; j++) {
          const nodeA = optimized[i];
          const nodeB = optimized[j];
          
          const dx = nodeA.x - nodeB.x;
          const dy = nodeA.y - nodeB.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // 最小距離未満の場合は反発
          if (distance < this.VERTICAL_SPACING && distance > 0) {
            const force = repulsionForce / (distance * distance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            nodeA.x += fx;
            nodeA.y += fy;
            nodeB.x -= fx;
            nodeB.y -= fy;
          }
        }
      }
    }

    return optimized;
  }

  // 境界計算
  static calculateBounds(positions: NodePosition[]): LayoutBounds {
    if (positions.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    const minX = Math.min(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxX = Math.max(...positions.map(p => p.x));
    const maxY = Math.max(...positions.map(p => p.y));

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}

// Web Worker のメッセージハンドラー
self.onmessage = (event: MessageEvent<LayoutWorkerMessage>) => {
  const { type, payload } = event.data;
  
  try {
    switch (type) {
      case 'CALCULATE_LAYOUT': {
        const { rootNode } = payload;
        const positions = LayoutCalculator.calculateAutoLayout(rootNode);
        const result: LayoutResult = {
          type: 'LAYOUT_COMPLETE',
          payload: { positions }
        };
        self.postMessage(result);
        break;
      }
      
      case 'OPTIMIZE_POSITIONS': {
        const { positions } = payload;
        const optimized = LayoutCalculator.optimizePositions(positions);
        const result: LayoutResult = {
          type: 'POSITIONS_OPTIMIZED',
          payload: { positions: optimized }
        };
        self.postMessage(result);
        break;
      }
      
      case 'CALCULATE_BOUNDS': {
        const { positions } = payload;
        const bounds = LayoutCalculator.calculateBounds(positions);
        const result: LayoutResult = {
          type: 'BOUNDS_CALCULATED',
          payload: { bounds }
        };
        self.postMessage(result);
        break;
      }
      
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
};

// TypeScript用のエクスポート（実際には使われないが型チェック用）
export type { LayoutWorkerMessage, LayoutResult, NodePosition, LayoutBounds };
export { LayoutCalculator };