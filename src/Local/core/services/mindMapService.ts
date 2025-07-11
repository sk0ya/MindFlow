import type { MindMapNode, Position } from '../../shared/types';

export interface MindMapService {
  // ノード操作
  copyNode(node: MindMapNode): MindMapNode;
  pasteNode(parentId: string, clipboard: MindMapNode | null): Promise<void>;
  
  // コマンドベースのノード操作
  updateNodeWithCommand(nodeId: string, updates: Partial<MindMapNode>): void;
  addChildNodeWithCommand(parentId: string, text: string, options?: any): string;
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
  showFileActionMenu(file: any, position: Position): void;
  showNodeMapLinks(node: MindMapNode, position: Position): void;
  
  // マップ管理
  createMap(title: string): Promise<string>;
  deleteMap(mapId: string): Promise<void>;
  renameMap(mapId: string, newTitle: string): Promise<void>;
  changeMapCategory(mapId: string, category: string): Promise<void>;
  selectMap(mapId: string): Promise<void>;
}

export class LocalMindMapService implements MindMapService {
  private mindMapHook: any;
  private fileHandlers: any;
  private mapHandlers: any;
  private uiState: any;

  constructor(
    mindMapHook: any,
    fileHandlers: any,
    mapHandlers: any,
    uiState: any
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

  addChildNodeWithCommand(parentId: string, text: string, _options?: any): string {
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
      this.mindMapHook.addChildNode(parentId, node.text, {
        fontSize: node.fontSize,
        fontWeight: node.fontWeight,
        color: node.color,
        attachments: node.attachments || [],
        mapLinks: node.mapLinks || []
      });
      
      node.children.forEach(child => {
        pasteNodeRecursive(child, node.id);
      });
    };
    
    pasteNodeRecursive(clipboard, parentId);
  }

  async addNodeMapLink(nodeId: string, targetMapId: string): Promise<void> {
    const node = this.mindMapHook.findNode(nodeId);
    if (!node) {
      throw new Error('ノードが見つかりません');
    }
    
    const existingLinks = node.mapLinks || [];
    const newLink = {
      id: `link_${Date.now()}`,
      mapId: targetMapId,
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
    
    const updatedLinks = (node.mapLinks || []).filter((link: any) => link.id !== linkId);
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

  showFileActionMenu(file: any, position: Position): void {
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