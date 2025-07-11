import { Command } from '../Command';
import type { MindMapNode } from '../../../shared/types';

export interface NodeOperations {
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text: string, options?: any) => string;
  deleteNode: (nodeId: string) => void;
  findNode: (nodeId: string) => MindMapNode | null;
  changeParent: (nodeId: string, newParentId: string) => void;
  changeSiblingOrder: (nodeId: string, direction: 'up' | 'down') => void;
}

export class UpdateNodeCommand implements Command {
  private nodeId: string;
  private newData: Partial<MindMapNode>;
  private oldData: Partial<MindMapNode>;
  private operations: NodeOperations;
  private executed: boolean = false;

  constructor(
    nodeId: string,
    newData: Partial<MindMapNode>,
    operations: NodeOperations
  ) {
    this.nodeId = nodeId;
    this.newData = newData;
    this.operations = operations;
    
    // 現在の状態を保存
    const currentNode = operations.findNode(nodeId);
    if (currentNode) {
      this.oldData = {
        text: currentNode.text,
        color: currentNode.color,
        fontSize: currentNode.fontSize,
        fontWeight: currentNode.fontWeight,
        collapsed: currentNode.collapsed,
        attachments: currentNode.attachments,
        mapLinks: currentNode.mapLinks
      };
    } else {
      this.oldData = {};
    }
  }

  execute(): void {
    if (!this.executed) {
      this.operations.updateNode(this.nodeId, this.newData);
      this.executed = true;
    }
  }

  undo(): void {
    if (this.executed) {
      this.operations.updateNode(this.nodeId, this.oldData);
      this.executed = false;
    }
  }

  getDescription(): string {
    const changes = Object.keys(this.newData);
    if (changes.includes('text')) {
      return 'テキストの変更';
    }
    if (changes.includes('color')) {
      return 'ノードの色変更';
    }
    if (changes.includes('fontSize')) {
      return 'フォントサイズの変更';
    }
    if (changes.includes('collapsed')) {
      return 'ノードの折りたたみ';
    }
    return 'ノードの更新';
  }
}

export class AddChildNodeCommand implements Command {
  private parentId: string;
  private text: string;
  private options: any;
  private addedNodeId: string | null = null;
  private operations: NodeOperations;
  private executed: boolean = false;

  constructor(
    parentId: string,
    text: string,
    options: any,
    operations: NodeOperations
  ) {
    this.parentId = parentId;
    this.text = text;
    this.options = options;
    this.operations = operations;
  }

  execute(): void {
    if (!this.executed) {
      this.addedNodeId = this.operations.addChildNode(this.parentId, this.text, this.options);
      this.executed = true;
    }
  }

  undo(): void {
    if (this.executed && this.addedNodeId) {
      this.operations.deleteNode(this.addedNodeId);
      this.executed = false;
    }
  }

  getDescription(): string {
    return '子ノードの追加';
  }
}

export class DeleteNodeCommand implements Command {
  private nodeId: string;
  private parentId: string | null = null;
  private nodeData: MindMapNode | null = null;
  private operations: NodeOperations;
  private executed: boolean = false;

  constructor(nodeId: string, operations: NodeOperations) {
    this.nodeId = nodeId;
    this.operations = operations;
    
    // 削除前の状態を保存
    const node = operations.findNode(nodeId);
    if (node) {
      this.nodeData = { ...node };
      
      // 親ノードとその中での位置を特定
      const parentNode = this.findParentNode(nodeId);
      if (parentNode) {
        this.parentId = parentNode.id;
      }
    }
  }

  private findParentNode(nodeId: string): MindMapNode | null {
    // 正規化データ構造から親を見つける実装
    // まず全ノードを取得して親子関係を探す
    const allNodes = this.operations.findNode('root')?.children || [];
    
    const findParentRecursive = (nodes: MindMapNode[], targetId: string): MindMapNode | null => {
      for (const node of nodes) {
        if (node.children.some(child => child.id === targetId)) {
          return node;
        }
        const parentInChildren = findParentRecursive(node.children, targetId);
        if (parentInChildren) {
          return parentInChildren;
        }
      }
      return null;
    };
    
    // ルートノードから検索
    const rootNode = this.operations.findNode('root');
    if (rootNode && rootNode.children.some(child => child.id === nodeId)) {
      return rootNode;
    }
    
    return findParentRecursive(allNodes, nodeId);
  }

  execute(): void {
    if (!this.executed) {
      this.operations.deleteNode(this.nodeId);
      this.executed = true;
    }
  }

  undo(): void {
    if (this.executed && this.nodeData && this.parentId) {
      // ノードを復元
      const restoredId = this.operations.addChildNode(this.parentId, this.nodeData.text, {
        fontSize: this.nodeData.fontSize,
        fontWeight: this.nodeData.fontWeight,
        color: this.nodeData.color,
        collapsed: this.nodeData.collapsed,
        attachments: this.nodeData.attachments,
        mapLinks: this.nodeData.mapLinks
      });
      
      // 子ノードも復元
      this.restoreChildren(restoredId, this.nodeData.children);
      this.executed = false;
    }
  }

  private restoreChildren(parentId: string, children: MindMapNode[]): void {
    children.forEach(child => {
      const childId = this.operations.addChildNode(parentId, child.text, {
        fontSize: child.fontSize,
        fontWeight: child.fontWeight,
        color: child.color,
        collapsed: child.collapsed,
        attachments: child.attachments,
        mapLinks: child.mapLinks
      });
      
      if (child.children.length > 0) {
        this.restoreChildren(childId, child.children);
      }
    });
  }

  getDescription(): string {
    return 'ノードの削除';
  }
}

export class ChangeParentCommand implements Command {
  private nodeId: string;
  private newParentId: string;
  private oldParentId: string | null = null;
  private operations: NodeOperations;

  constructor(
    nodeId: string,
    newParentId: string,
    operations: NodeOperations
  ) {
    this.nodeId = nodeId;
    this.newParentId = newParentId;
    this.operations = operations;
    
    // 現在の親を保存
    const parentNode = this.findParentNode(nodeId);
    if (parentNode) {
      this.oldParentId = parentNode.id;
    }
  }

  private findParentNode(_nodeId: string): MindMapNode | null {
    // 実装は具体的なデータ構造に依存
    // TODO: 正規化データ構造から親を見つける実装
    return null;
  }

  execute(): void {
    this.operations.changeParent(this.nodeId, this.newParentId);
  }

  undo(): void {
    if (this.oldParentId) {
      this.operations.changeParent(this.nodeId, this.oldParentId);
    }
  }

  getDescription(): string {
    return 'ノードの移動';
  }
}