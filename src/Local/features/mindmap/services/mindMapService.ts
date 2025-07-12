import type { MindMapNode, Position, FileAttachment, NodeMapLink } from '../../../../shared/types';

// 依存関係の型定義
interface MindMapHookDependency {
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text: string, options?: Partial<MindMapNode>) => string | undefined;
  deleteNode: (nodeId: string) => void;
  findNode: (nodeId: string) => MindMapNode | undefined;
  changeParent: (nodeId: string, newParentId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface FileHandlerDependency {
  uploadFile: (nodeId: string, file: File) => Promise<void>;
  removeFile: (nodeId: string, fileId: string) => Promise<void>;
  downloadFile: (nodeId: string, fileId: string) => Promise<void>;
  renameFile: (nodeId: string, fileId: string, newName: string) => Promise<void>;
  handleFileUpload: (nodeId: string, file: File) => Promise<void>;
  handleRemoveFile: (nodeId: string, fileId: string) => Promise<void>;
  handleFileDownload: (nodeId: string, fileId: string) => Promise<void>;
  handleFileRename: (nodeId: string, fileId: string, newName: string) => Promise<void>;
  handleShowImageModal: (image: { url: string; alt: string }) => void;
  handleShowFileActionMenu: (file: FileAttachment, position: Position) => void;
}

interface MapHandlerDependency {
  createMap: (title: string) => Promise<string>;
  deleteMap: (mapId: string) => Promise<void>;
  renameMap: (mapId: string, newTitle: string) => Promise<void>;
  changeMapCategory: (mapId: string, category: string) => Promise<void>;
  selectMap: (mapId: string) => Promise<void>;
  handleNavigateToMap: (mapId: string) => Promise<void>;
  handleCreateMap: (title: string) => Promise<string>;
  handleDeleteMap: (mapId: string) => Promise<void>;
  handleRenameMap: (mapId: string, newTitle: string) => Promise<void>;
  handleChangeCategory: (mapId: string, category: string) => Promise<void>;
  handleSelectMap: (mapId: string) => Promise<void>;
}

interface UIStateDependency {
  showImageModal: (image: { url: string; alt: string }) => void;
  showFileActionMenu: (file: FileAttachment, position: Position) => void;
  showNodeMapLinks: (node: MindMapNode, position: Position) => void;
  handleShowNodeMapLinks: (node: MindMapNode, position: Position) => void;
  handleCloseNodeMapLinksPanel: () => void;
}

export interface MindMapService {
  // ノード操作
  copyNode(node: MindMapNode): MindMapNode;
  pasteNode(parentId: string, clipboard: MindMapNode | null): Promise<void>;
  
  // コマンドベースのノード操作
  updateNodeWithCommand(nodeId: string, updates: Partial<MindMapNode>): void;
  addChildNodeWithCommand(parentId: string, text: string, options?: Partial<MindMapNode>): string;
  deleteNodeWithCommand(nodeId: string): void;
  changeParentWithCommand(nodeId: string, newParentId: string): void;
  
  // Undo/Redo操作
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  getUndoDescription(): string | null;
  getRedoDescription(): string | null;
  
  // ノードマップリンク操作
  addNodeMapLink(nodeId: string, targetMapId: string): Promise<void>;
  removeNodeMapLink(nodeId: string, linkId: string): Promise<void>;
  navigateToMap(mapId: string): Promise<void>;
  
  // ファイル操作
  uploadFile(nodeId: string, file: File): Promise<void>;
  removeFile(nodeId: string, fileId: string): Promise<void>;
  downloadFile(nodeId: string, fileId: string): Promise<void>;
  renameFile(nodeId: string, fileId: string, newName: string): Promise<void>;
  
  // UI操作
  showImageModal(image: { url: string; alt: string }): void;
  showFileActionMenu(file: FileAttachment, position: Position): void;
  showNodeMapLinks(node: MindMapNode, position: Position): void;
  
  // マップ管理
  createMap(title: string): Promise<string>;
  deleteMap(mapId: string): Promise<void>;
  renameMap(mapId: string, newTitle: string): Promise<void>;
  changeMapCategory(mapId: string, category: string): Promise<void>;
  selectMap(mapId: string): Promise<void>;
}

export class LocalMindMapService implements MindMapService {
  private mindMapHook: MindMapHookDependency;
  private fileHandlers: FileHandlerDependency;
  private mapHandlers: MapHandlerDependency;
  private uiState: UIStateDependency;

  constructor(
    mindMapHook: MindMapHookDependency,
    fileHandlers: FileHandlerDependency,
    mapHandlers: MapHandlerDependency,
    uiState: UIStateDependency
  ) {
    this.mindMapHook = mindMapHook;
    this.fileHandlers = fileHandlers;
    this.mapHandlers = mapHandlers;
    this.uiState = uiState;
  }

  // コマンドベースのノード操作（既存のZustandストアを直接使用）
  updateNodeWithCommand(nodeId: string, updates: Partial<MindMapNode>): void {
    // 既存のストアの履歴機能を利用
    this.mindMapHook.updateNode(nodeId, updates);
  }

  addChildNodeWithCommand(parentId: string, text: string, _options?: Partial<MindMapNode>): string {
    // 既存のストアの履歴機能を利用
    const nodeId = this.mindMapHook.addChildNode(parentId, text);
    return nodeId || `node_${Date.now()}`;
  }

  deleteNodeWithCommand(nodeId: string): void {
    // 既存のストアの履歴機能を利用
    this.mindMapHook.deleteNode(nodeId);
  }

  changeParentWithCommand(nodeId: string, newParentId: string): void {
    // 既存のストアの履歴機能を利用
    this.mindMapHook.changeParent(nodeId, newParentId);
  }

  // Undo/Redo操作（既存のZustandストアのundo/redoを使用）
  undo(): boolean {
    this.mindMapHook.undo();
    return true;
  }

  redo(): boolean {
    this.mindMapHook.redo();
    return true;
  }

  canUndo(): boolean {
    return this.mindMapHook.canUndo;
  }

  canRedo(): boolean {
    return this.mindMapHook.canRedo;
  }

  getUndoDescription(): string | null {
    return null; // 既存のストアには説明機能がない
  }

  getRedoDescription(): string | null {
    return null; // 既存のストアには説明機能がない
  }

  copyNode(node: MindMapNode): MindMapNode {
    const copyNodeRecursive = (node: MindMapNode): MindMapNode => ({
      ...node,
      id: `${node.id}_copy_${Date.now()}`,
      children: node.children.map(copyNodeRecursive)
    });
    
    return copyNodeRecursive(node);
  }

  async pasteNode(parentId: string, clipboard: MindMapNode | null): Promise<void> {
    if (!clipboard) {
      throw new Error('クリップボードにノードがありません');
    }
    
    const pasteNodeRecursive = (node: MindMapNode, parentId: string): void => {
      const newNodeId = this.mindMapHook.addChildNode(parentId, node.text, {
        fontSize: node.fontSize,
        fontWeight: node.fontWeight,
        color: node.color,
        attachments: node.attachments || [],
        mapLinks: node.mapLinks || []
      });
      
      if (newNodeId) {
        node.children.forEach(child => {
          pasteNodeRecursive(child, newNodeId);
        });
      }
    };
    
    pasteNodeRecursive(clipboard, parentId);
  }

  async addNodeMapLink(nodeId: string, targetMapId: string): Promise<void> {
    const node = this.mindMapHook.findNode(nodeId);
    if (!node) {
      throw new Error('ノードが見つかりません');
    }
    
    const existingLinks = node.mapLinks || [];
    const newLink: NodeMapLink = {
      id: `link_${Date.now()}`,
      targetMapId: targetMapId,
      targetMapTitle: '', // TODO: Get actual title from target map
      description: '',
      createdAt: new Date().toISOString()
    };
    
    await this.mindMapHook.updateNode(nodeId, {
      mapLinks: [...existingLinks, newLink]
    });
  }

  async removeNodeMapLink(nodeId: string, linkId: string): Promise<void> {
    const node = this.mindMapHook.findNode(nodeId);
    if (!node) {
      throw new Error('ノードが見つかりません');
    }
    
    const updatedLinks = (node.mapLinks || []).filter(link => link.id !== linkId);
    await this.mindMapHook.updateNode(nodeId, { mapLinks: updatedLinks });
  }

  async navigateToMap(mapId: string): Promise<void> {
    try {
      await this.mapHandlers.handleNavigateToMap(mapId);
      this.uiState.handleCloseNodeMapLinksPanel();
    } catch (error) {
      console.error('マップナビゲーションエラー:', error);
      throw new Error(`マップの切り替えに失敗しました: ${(error as Error).message}`);
    }
  }

  async uploadFile(nodeId: string, file: File): Promise<void> {
    return this.fileHandlers.handleFileUpload(nodeId, file);
  }

  async removeFile(nodeId: string, fileId: string): Promise<void> {
    return this.fileHandlers.handleRemoveFile(nodeId, fileId);
  }

  async downloadFile(nodeId: string, fileId: string): Promise<void> {
    return this.fileHandlers.handleFileDownload(nodeId, fileId);
  }

  async renameFile(nodeId: string, fileId: string, newName: string): Promise<void> {
    return this.fileHandlers.handleFileRename(nodeId, fileId, newName);
  }

  showImageModal(image: { url: string; alt: string }): void {
    this.fileHandlers.handleShowImageModal(image);
  }

  showFileActionMenu(file: FileAttachment, position: Position): void {
    this.fileHandlers.handleShowFileActionMenu(file, position);
  }

  showNodeMapLinks(node: MindMapNode, position: Position): void {
    this.uiState.handleShowNodeMapLinks(node, position);
  }

  async createMap(title: string): Promise<string> {
    return this.mapHandlers.handleCreateMap(title);
  }

  async deleteMap(mapId: string): Promise<void> {
    return this.mapHandlers.handleDeleteMap(mapId);
  }

  async renameMap(mapId: string, newTitle: string): Promise<void> {
    return this.mapHandlers.handleRenameMap(mapId, newTitle);
  }

  async changeMapCategory(mapId: string, category: string): Promise<void> {
    return this.mapHandlers.handleChangeCategory(mapId, category);
  }

  async selectMap(mapId: string): Promise<void> {
    return this.mapHandlers.handleSelectMap(mapId);
  }
}