/**
 * データ変換ユーティリティ
 * 階層型データ構造 ⇔ リレーショナル型データ構造の変換
 */

// ===== Type Definitions =====

// Data format types
export type DataFormat = 'hierarchical' | 'relational';
export type NodeType = 'root' | 'branch';
export type AttachmentType = 'image' | 'file';

// Base interfaces for data structures
export interface BaseNode {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  fontWeight?: string;
  backgroundColor?: string;
  textColor?: string;
  color?: string;
  collapsed?: boolean;
  notes?: string;
  tags?: string[];
}

// Hierarchical data structures
export interface HierarchicalNode extends BaseNode {
  children?: HierarchicalNode[];
  attachments?: LegacyAttachment[];
  mapLinks?: LegacyMapLink[];
}

export interface HierarchicalMindMapData {
  id: string;
  title: string;
  category?: string | undefined;
  theme?: string | undefined;
  settings?: Record<string, any> | undefined;
  user_id?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  rootNode: HierarchicalNode;
}

// Legacy attachment structure (from hierarchical format)
export interface LegacyAttachment {
  id?: string;
  name?: string;
  type?: string;
  size?: number;
  dataURL?: string;
  isImage?: boolean;
}

// Legacy map link structure
export interface LegacyMapLink {
  id?: string;
  url: string;
  title?: string;
  description?: string;
}

// Relational data structures
export interface RelationalMindMap {
  id: string;
  title: string;
  category: string;
  theme: string;
  settings: string; // JSON string
  user_id: string;
  created_at?: string;
  updated_at?: string;
  migrated_to_relational?: boolean;
  migration_date?: string;
}

export interface RelationalNode {
  id: string;
  mindmap_id: string;
  text: string;
  type: NodeType;
  parent_id: string | null;
  position_x: number;
  position_y: number;
  style_settings: string; // JSON string
  notes: string;
  tags: string; // JSON string
  collapsed: boolean;
  created_at: string;
  updated_at: string;
}

export interface RelationalAttachment {
  id: string;
  node_id: string;
  file_name: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  attachment_type: AttachmentType;
  legacy_data_url?: string | undefined;
  uploaded_at: string;
}

export interface RelationalLink {
  id: string;
  node_id: string;
  url: string;
  title: string;
  description: string;
  domain: string;
  created_at: string;
}

export interface RelationalConnection {
  id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: string;
  created_at: string;
}

// Conversion result types
export interface RelationalDataSet {
  mindmap: RelationalMindMap;
  nodes: RelationalNode[];
  connections: RelationalConnection[];
  attachments: RelationalAttachment[];
  links: RelationalLink[];
}

export interface ConvertedHierarchicalNode extends BaseNode {
  children: ConvertedHierarchicalNode[];
  attachments: ConvertedAttachment[];
  mapLinks: ConvertedMapLink[];
}

export interface ConvertedHierarchicalData {
  id: string;
  title: string;
  category?: string;
  theme?: string;
  settings: Record<string, any>;
  user_id?: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  rootNode: ConvertedHierarchicalNode;
}

export interface ConvertedAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  isImage: boolean;
  dataURL?: string | undefined;
  downloadUrl?: string | undefined;
}

export interface ConvertedMapLink {
  id: string;
  url: string;
  title: string;
  description: string;
  domain: string;
}

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Statistics types
export interface DataStatistics {
  totalNodes: number;
  totalAttachments: number;
  totalLinks: number;
  totalConnections?: number;
  nodesByType?: Record<string, number>;
  attachmentsByType?: Record<string, number>;
  maxDepth: number;
  nodesByLevel?: Record<number, number>;
}

// File validation types
export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
}

// Performance optimization types
export interface ConversionOptions {
  batchSize?: number;
  enableProgressCallback?: boolean;
  validateData?: boolean;
  optimizeForLargeDatasets?: boolean;
}

export interface ConversionProgress {
  processed: number;
  total: number;
  currentOperation: string;
  timeElapsed: number;
  estimatedTimeRemaining: number;
}

// Version compatibility types
export interface VersionInfo {
  dataVersion: string;
  converterVersion: string;
  compatibilityLevel: 'full' | 'partial' | 'incompatible';
}

// Error handling types
export class DataConversionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'DataConversionError';
  }
}

// Type guards
export function isHierarchicalData(data: any): data is HierarchicalMindMapData {
  return data && typeof data.id === 'string' && data.rootNode && typeof data.rootNode === 'object';
}

export function isRelationalData(data: any): data is RelationalDataSet {
  return data && data.mindmap && Array.isArray(data.nodes) && Array.isArray(data.attachments) && Array.isArray(data.links);
}

export function isValidNode(node: any): node is HierarchicalNode {
  return node && typeof node.id === 'string' && typeof node.text === 'string' && typeof node.x === 'number' && typeof node.y === 'number';
}

// ===== Main DataConverter Class =====

export class DataConverter {
  /**
   * 階層型データをリレーショナル型に変換
   * @param mindmapData - 既存の階層型データ
   * @param options - 変換オプション
   * @returns リレーショナル型データ
   */
  static hierarchicalToRelational(
    mindmapData: HierarchicalMindMapData,
    _options: ConversionOptions = {}
  ): RelationalDataSet {
    const nodes: RelationalNode[] = [];
    const connections: RelationalConnection[] = [];
    const attachments: RelationalAttachment[] = [];
    const links: RelationalLink[] = [];

    // ルートノードから再帰的に変換
    this.convertNodeRecursively(
      mindmapData.rootNode, 
      mindmapData.id, 
      null, 
      nodes,
      attachments,
      links
    );

    return {
      mindmap: {
        id: mindmapData.id,
        title: mindmapData.title,
        category: mindmapData.category || 'general',
        theme: mindmapData.theme || 'default', 
        settings: JSON.stringify(mindmapData.settings || {}),
        user_id: mindmapData.user_id || 'default-user',
        created_at: mindmapData.createdAt || new Date().toISOString(),
        updated_at: mindmapData.updatedAt || new Date().toISOString(),
        migrated_to_relational: true,
        migration_date: new Date().toISOString()
      },
      nodes,
      connections,
      attachments,
      links
    };
  }

  /**
   * ノードを再帰的に変換
   */
  static convertNodeRecursively(
    node: HierarchicalNode,
    mindmapId: string,
    parentId: string | null,
    nodes: RelationalNode[],
    attachments: RelationalAttachment[],
    links: RelationalLink[]
  ): void {
    // ノード変換
    const convertedNode: RelationalNode = {
      id: node.id,
      mindmap_id: mindmapId,
      text: node.text || '',
      type: node.id === 'root' ? 'root' : 'branch',
      parent_id: parentId,
      position_x: node.x || 0,
      position_y: node.y || 0,
      style_settings: JSON.stringify({
        fontSize: node.fontSize || 14,
        fontWeight: node.fontWeight || 'normal',
        backgroundColor: node.backgroundColor,
        textColor: node.textColor,
        color: node.color
      }),
      notes: node.notes || '',
      tags: JSON.stringify(node.tags || []),
      collapsed: node.collapsed || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    nodes.push(convertedNode);

    // 添付ファイル変換
    if (node.attachments && Array.isArray(node.attachments)) {
      node.attachments.forEach((attachment: LegacyAttachment) => {
        const attachmentId = attachment.id || `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const convertedAttachment: RelationalAttachment = {
          id: attachmentId,
          node_id: node.id,
          file_name: attachment.name || 'untitled',
          original_name: attachment.name || 'untitled',
          file_size: attachment.size || 0,
          mime_type: attachment.type || 'application/octet-stream',
          storage_path: `legacy/${attachmentId}`, // 後でR2に移行
          attachment_type: attachment.isImage ? 'image' : 'file',
          legacy_data_url: attachment.dataURL || undefined,
          uploaded_at: new Date().toISOString()
        };
        attachments.push(convertedAttachment);
      });
    }

    // リンク変換
    if (node.mapLinks && Array.isArray(node.mapLinks)) {
      node.mapLinks.forEach((link: LegacyMapLink) => {
        const linkId = link.id || `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        try {
          const url = new URL(link.url);
          links.push({
            id: linkId,
            node_id: node.id,
            url: link.url,
            title: link.title || link.url,
            description: link.description || '',
            domain: url.hostname,
            created_at: new Date().toISOString()
          });
        } catch (e: unknown) {
          // 無効なURLの場合はスキップ
          console.warn('Invalid URL in mapLinks:', link.url, e);
        }
      });
    }

    // 子ノード再帰処理
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: HierarchicalNode) => {
        this.convertNodeRecursively(child, mindmapId, node.id, nodes, attachments, links);
      });
    }
  }

  /**
   * リレーショナル型データを階層型に変換（後方互換性用）
   * @param mindmap - マインドマップ情報
   * @param nodes - ノード配列
   * @param connections - 接続配列（現在未使用だが互換性のため保持）
   * @param attachments - 添付ファイル配列
   * @param links - リンク配列
   * @returns 階層型データ
   */
  static relationalToHierarchical(
    mindmap: RelationalMindMap,
    nodes: RelationalNode[],
    _connections: RelationalConnection[],
    attachments: RelationalAttachment[],
    links: RelationalLink[]
  ): ConvertedHierarchicalData {
    const nodeMap = new Map<string, ConvertedHierarchicalNode>();
    const attachmentMap = new Map<string, ConvertedAttachment[]>();
    const linkMap = new Map<string, ConvertedMapLink[]>();

    // 添付ファイルをノード別にグループ化
    attachments.forEach((att: RelationalAttachment) => {
      if (!attachmentMap.has(att.node_id)) {
        attachmentMap.set(att.node_id, []);
      }
      const convertedAttachment: ConvertedAttachment = {
        id: att.id,
        name: att.file_name,
        type: att.mime_type,
        size: att.file_size,
        isImage: att.attachment_type === 'image',
        dataURL: att.legacy_data_url || undefined,
        downloadUrl: att.storage_path
      };
      attachmentMap.get(att.node_id)!.push(convertedAttachment);
    });

    // リンクをノード別にグループ化
    links.forEach((link: RelationalLink) => {
      if (!linkMap.has(link.node_id)) {
        linkMap.set(link.node_id, []);
      }
      linkMap.get(link.node_id)!.push({
        id: link.id,
        url: link.url,
        title: link.title,
        description: link.description,
        domain: link.domain
      });
    });

    // ノードを階層構造に変換
    nodes.forEach((node: RelationalNode) => {
      const style: Record<string, any> = JSON.parse(node.style_settings || '{}');
      const convertedNode: ConvertedHierarchicalNode = {
        id: node.id,
        text: node.text,
        x: node.position_x,
        y: node.position_y,
        fontSize: style.fontSize || 14,
        fontWeight: style.fontWeight || 'normal',
        backgroundColor: style.backgroundColor,
        textColor: style.textColor,
        color: style.color,
        collapsed: node.collapsed || false,
        notes: node.notes || '',
        tags: JSON.parse(node.tags || '[]'),
        children: [] as ConvertedHierarchicalNode[],
        attachments: attachmentMap.get(node.id) || [],
        mapLinks: linkMap.get(node.id) || []
      };
      nodeMap.set(node.id, convertedNode);
    });

    // 親子関係構築
    const rootNode = nodeMap.get('root');
    nodes.forEach((node: RelationalNode) => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        const parent = nodeMap.get(node.parent_id);
        const child = nodeMap.get(node.id);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    });

    // 設定の変換
    const settings: Record<string, any> = JSON.parse(mindmap.settings || '{}');

    return {
      id: mindmap.id,
      title: mindmap.title,
      category: mindmap.category,
      theme: mindmap.theme,
      settings: settings,
      user_id: mindmap.user_id,
      createdAt: mindmap.created_at || undefined,
      updatedAt: mindmap.updated_at || undefined,
      rootNode: rootNode || {
        id: 'root',
        text: 'メイントピック',
        x: 400,
        y: 300,
        fontSize: 16,
        fontWeight: 'bold',
        children: [] as ConvertedHierarchicalNode[],
        attachments: [] as ConvertedAttachment[],
        mapLinks: [] as ConvertedMapLink[]
      }
    };
  }

  /**
   * データ整合性チェック（統合版）
   * @param data - チェック対象データ
   * @param format - データ形式
   * @returns チェック結果
   */
  static validateData(
    data: HierarchicalMindMapData | RelationalDataSet,
    format: DataFormat = 'relational'
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (format === 'hierarchical') {
      return this.validateHierarchicalData(data as HierarchicalMindMapData);
    }

    const relationalData = data as RelationalDataSet;

    // リレーショナルデータのバリデーション
    if (!relationalData.mindmap?.id) {
      errors.push('mindmap.id is required');
    }
    if (!relationalData.mindmap?.title) {
      warnings.push('mindmap.title is empty');
    }

    // ノードの整合性チェック
    if (!relationalData.nodes || !Array.isArray(relationalData.nodes)) {
      errors.push('nodes array is required');
    } else {
      const nodeIds = new Set<string>();
      const rootNodes = relationalData.nodes.filter((n: RelationalNode) => n.type === 'root');
      
      if (rootNodes.length !== 1) {
        errors.push(`Expected 1 root node, found ${rootNodes.length}`);
      }

      relationalData.nodes.forEach((node: RelationalNode) => {
        if (!node.id) {
          errors.push('Node missing id');
        } else if (nodeIds.has(node.id)) {
          errors.push(`Duplicate node id: ${node.id}`);
        } else {
          nodeIds.add(node.id);
        }

        if (node.parent_id && !nodeIds.has(node.parent_id)) {
          warnings.push(`Node ${node.id} has invalid parent_id: ${node.parent_id}`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 階層型データのバリデーション
   */
  static validateHierarchicalData(data: HierarchicalMindMapData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 基本フィールドチェック
    if (!data.id) {
      errors.push('mindmap id is required');
    }
    if (!data.title) {
      warnings.push('mindmap title is empty');
    }
    if (!data.rootNode) {
      errors.push('rootNode is required');
      return { isValid: false, errors, warnings };
    }

    // ルートノードのチェック
    if (data.rootNode.id !== 'root') {
      errors.push('rootNode.id must be "root"');
    }
    if (!data.rootNode.text) {
      warnings.push('rootNode.text is empty');
    }

    // 再帰的ノードチェック
    const nodeIds = new Set<string>();
    const validateNodeRecursive = (node: HierarchicalNode, depth: number = 0): void => {
      if (!node.id) {
        errors.push(`Node at depth ${depth} missing id`);
        return;
      }
      
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node id: ${node.id}`);
      } else {
        nodeIds.add(node.id);
      }

      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: HierarchicalNode) => validateNodeRecursive(child, depth + 1));
      }
    };

    validateNodeRecursive(data.rootNode);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * ファイル添付のバリデーション
   */
  static validateFile(file: File | null, options: FileValidationOptions = {}): string[] {
    const errors: string[] = [];
    const MAX_FILE_SIZE = options.maxSize || 10 * 1024 * 1024; // 10MB
    const ALLOWED_FILE_TYPES = options.allowedTypes || [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'application/pdf', 'application/json'
    ];
    
    if (!file) {
      errors.push('ファイルが選択されていません');
      return errors;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`ファイルサイズが大きすぎます (${Math.round(file.size / 1024 / 1024)}MB > 10MB)`);
    }
    
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      errors.push(`サポートされていないファイル形式です: ${file.type}`);
    }
    
    return errors;
  }

  /**
   * データ統計情報の取得
   * @param data - 統計対象データ
   * @param format - データ形式
   * @returns 統計情報
   */
  static getDataStats(
    data: HierarchicalMindMapData | RelationalDataSet,
    format: DataFormat = 'relational'
  ): DataStatistics {
    if (format === 'hierarchical') {
      return this.getHierarchicalStats(data as HierarchicalMindMapData);
    }

    const relationalData = data as RelationalDataSet;

    // リレーショナルデータの統計
    const stats: DataStatistics = {
      totalNodes: relationalData.nodes?.length || 0,
      totalAttachments: relationalData.attachments?.length || 0,
      totalLinks: relationalData.links?.length || 0,
      totalConnections: relationalData.connections?.length || 0,
      nodesByType: {} as Record<string, number>,
      attachmentsByType: {} as Record<string, number>,
      maxDepth: 0
    };

    // ノードタイプ別統計
    if (relationalData.nodes && stats.nodesByType) {
      relationalData.nodes.forEach((node: RelationalNode) => {
        stats.nodesByType![node.type] = (stats.nodesByType![node.type] || 0) + 1;
      });
    }

    // 添付ファイルタイプ別統計
    if (relationalData.attachments && stats.attachmentsByType) {
      relationalData.attachments.forEach((att: RelationalAttachment) => {
        stats.attachmentsByType![att.attachment_type] = (stats.attachmentsByType![att.attachment_type] || 0) + 1;
      });
    }

    // 最大深度計算
    if (relationalData.nodes) {
      const calculateDepth = (nodeId: string, depth: number = 0): number => {
        const children = relationalData.nodes.filter((n: RelationalNode) => n.parent_id === nodeId);
        if (children.length === 0) return depth;
        return Math.max(...children.map((child: RelationalNode) => calculateDepth(child.id, depth + 1)));
      };
      
      const rootNode = relationalData.nodes.find((n: RelationalNode) => n.type === 'root');
      if (rootNode) {
        stats.maxDepth = calculateDepth(rootNode.id);
      }
    }

    return stats;
  }

  /**
   * 階層型データの統計
   */
  static getHierarchicalStats(data: HierarchicalMindMapData): DataStatistics {
    const stats: DataStatistics = {
      totalNodes: 0,
      totalAttachments: 0,
      totalLinks: 0,
      maxDepth: 0,
      nodesByLevel: {} as Record<number, number>
    };

    const countNodeRecursive = (node: HierarchicalNode, depth: number = 0): void => {
      stats.totalNodes++;
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      if (stats.nodesByLevel) {
        stats.nodesByLevel[depth] = (stats.nodesByLevel[depth] || 0) + 1;
      }
      
      if (node.attachments) {
        stats.totalAttachments += node.attachments.length;
      }
      if (node.mapLinks) {
        stats.totalLinks += node.mapLinks.length;
      }
      
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: HierarchicalNode) => countNodeRecursive(child, depth + 1));
      }
    };

    if (data.rootNode) {
      countNodeRecursive(data.rootNode);
    }

    return stats;
  }

  /**
   * データクリーニング
   * 破損したデータや無効なノードを除去
   */
  static cleanupData(
    data: HierarchicalMindMapData | RelationalDataSet,
    format: DataFormat = 'hierarchical'
  ): HierarchicalMindMapData | RelationalDataSet | null {
    if (format === 'hierarchical') {
      return this.cleanupHierarchicalData(data as HierarchicalMindMapData);
    }
    
    // リレーショナルデータのクリーニング
    const cleaned = JSON.parse(JSON.stringify(data)) as RelationalDataSet;
    
    if (cleaned.nodes) {
      cleaned.nodes = cleaned.nodes.filter((node: any) => {
        return node && node.id && typeof node.id === 'string';
      });
    }
    
    return cleaned;
  }

  /**
   * 階層型データのクリーニング
   */
  static cleanupHierarchicalData(data: HierarchicalMindMapData): HierarchicalMindMapData | null {
    if (!data || !data.rootNode) {
      return null;
    }
    
    const cleaned = JSON.parse(JSON.stringify(data)) as HierarchicalMindMapData;
    
    const cleanupNodeRecursive = (node: any): ConvertedHierarchicalNode | null => {
      if (!node || !node.id) {
        return null;
      }
      
      // 基本フィールドの正規化
      if (typeof node.text !== 'string') {
        node.text = '';
      }
      if (typeof node.x !== 'number') {
        node.x = 0;
      }
      if (typeof node.y !== 'number') {
        node.y = 0;
      }
      if (!Array.isArray(node.children)) {
        node.children = [];
      }
      if (!Array.isArray(node.attachments)) {
        node.attachments = [];
      }
      if (!Array.isArray(node.mapLinks)) {
        node.mapLinks = [];
      }
      
      // 子ノードの再帰クリーニング
      node.children = node.children
        .map((child: any) => cleanupNodeRecursive(child))
        .filter((child: ConvertedHierarchicalNode | null) => child !== null);
      
      return node;
    };
    
    const cleanedRootNode = cleanupNodeRecursive(cleaned.rootNode);
    if (cleanedRootNode) {
      cleaned.rootNode = cleanedRootNode as HierarchicalNode;
      return cleaned;
    }
    return null;
  }

  // ===== Advanced Features =====

  /**
   * バッチ変換 - 大量データの効率的処理
   */
  static async batchHierarchicalToRelational(
    datasets: HierarchicalMindMapData[],
    options: ConversionOptions = {}
  ): Promise<RelationalDataSet[]> {
    const batchSize = options.batchSize || 100;
    const results: RelationalDataSet[] = [];
    
    for (let i = 0; i < datasets.length; i += batchSize) {
      const batch = datasets.slice(i, i + batchSize);
      const batchResults = batch.map(data => 
        this.hierarchicalToRelational(data, options)
      );
      results.push(...batchResults);
      
      // 進捗コールバック
      if (options.enableProgressCallback) {
        const progress: ConversionProgress = {
          processed: Math.min(i + batchSize, datasets.length),
          total: datasets.length,
          currentOperation: 'batch_conversion',
          timeElapsed: Date.now(),
          estimatedTimeRemaining: 0
        };
        console.log('Batch conversion progress:', progress);
      }
      
      // 非同期処理として次のイベントループで実行
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return results;
  }

  /**
   * データ形式の自動検出
   */
  static detectDataFormat(data: any): DataFormat | null {
    if (isHierarchicalData(data)) {
      return 'hierarchical';
    }
    if (isRelationalData(data)) {
      return 'relational';
    }
    return null;
  }

  /**
   * バージョン互換性チェック
   */
  static checkVersionCompatibility(data: any): VersionInfo {
    const dataVersion = data.version || data.dataVersion || '1.0.0';
    const converterVersion = '2.0.0'; // Current converter version
    
    // Simple version comparison logic
    const isCompatible = dataVersion.startsWith('1.') || dataVersion.startsWith('2.');
    
    return {
      dataVersion,
      converterVersion,
      compatibilityLevel: isCompatible ? 'full' : 'incompatible'
    };
  }

  /**
   * データ完全性のディープバリデーション
   */
  static deepValidateData(
    data: HierarchicalMindMapData | RelationalDataSet,
    format: DataFormat
  ): ValidationResult {
    const basicValidation = this.validateData(data, format);
    const errors = [...basicValidation.errors];
    const warnings = [...basicValidation.warnings];

    if (format === 'hierarchical') {
      const hierarchicalData = data as HierarchicalMindMapData;
      
      // 循環参照チェック
      const visitedNodes = new Set<string>();
      const recursionStack = new Set<string>();
      
      const checkCircularReference = (node: HierarchicalNode): boolean => {
        if (recursionStack.has(node.id)) {
          errors.push(`Circular reference detected at node: ${node.id}`);
          return false;
        }
        
        if (visitedNodes.has(node.id)) {
          return true;
        }
        
        visitedNodes.add(node.id);
        recursionStack.add(node.id);
        
        if (node.children) {
          for (const child of node.children) {
            if (!checkCircularReference(child)) {
              return false;
            }
          }
        }
        
        recursionStack.delete(node.id);
        return true;
      };
      
      checkCircularReference(hierarchicalData.rootNode);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * データサイズ最適化
   */
  static optimizeDataSize(
    data: HierarchicalMindMapData | RelationalDataSet,
    format: DataFormat
  ): HierarchicalMindMapData | RelationalDataSet {
    if (format === 'hierarchical') {
      const hierarchicalData = JSON.parse(JSON.stringify(data)) as HierarchicalMindMapData;
      
      const optimizeNode = (node: HierarchicalNode): void => {
        // 空の配列を削除
        if (node.children && node.children.length === 0) {
          delete node.children;
        }
        if (node.attachments && node.attachments.length === 0) {
          delete node.attachments;
        }
        if (node.mapLinks && node.mapLinks.length === 0) {
          delete node.mapLinks;
        }
        
        // デフォルト値を削除
        if (node.fontSize === 14) delete node.fontSize;
        if (node.fontWeight === 'normal') delete node.fontWeight;
        if (node.collapsed === false) delete node.collapsed;
        
        // 子ノードを再帰的に最適化
        if (node.children) {
          node.children.forEach(optimizeNode);
        }
      };
      
      optimizeNode(hierarchicalData.rootNode);
      return hierarchicalData;
    }
    
    return data; // Relational data optimization would be implemented here
  }

  /**
   * JSON シリアライゼーションの安全な実行
   */
  static safeStringify(data: any): string {
    try {
      return JSON.stringify(data, (_key, value) => {
        // 循環参照を検出して除外
        if (typeof value === 'object' && value !== null) {
          if (this._seenObjects?.has(value)) {
            return '[Circular Reference]';
          }
          this._seenObjects = this._seenObjects || new WeakSet();
          this._seenObjects.add(value);
        }
        return value;
      }, 2);
    } catch (error) {
      throw new DataConversionError(
        'Failed to serialize data',
        'SERIALIZATION_ERROR',
        { originalError: error }
      );
    } finally {
      this._seenObjects = undefined as WeakSet<object> | undefined;
    }
  }

  /**
   * JSON デシリアライゼーションの安全な実行
   */
  static safeParse<T>(jsonString: string): T {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new DataConversionError(
        'Failed to parse JSON data',
        'PARSING_ERROR',
        { originalError: error, jsonString: jsonString.substring(0, 100) + '...' }
      );
    }
  }

  /**
   * データマイグレーション（レガシーフォーマット対応）
   */
  static migrateFromLegacyFormat(legacyData: any): HierarchicalMindMapData {
    // Legacy format detection and conversion logic
    if (legacyData.nodes && Array.isArray(legacyData.nodes)) {
      // Legacy relational format
      return this.relationalToHierarchical(
        legacyData.mindmap || { id: 'legacy', title: 'Migrated Data' },
        legacyData.nodes,
        legacyData.connections || [],
        legacyData.attachments || [],
        legacyData.links || []
      ) as HierarchicalMindMapData;
    }
    
    // Assume it's already hierarchical or compatible
    return legacyData as HierarchicalMindMapData;
  }

  /**
   * パフォーマンス測定付き変換
   */
  static async performanceAwareConversion(
    data: HierarchicalMindMapData,
    options: ConversionOptions = {}
  ): Promise<{ result: RelationalDataSet; metrics: any }> {
    const startTime = performance.now();
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    const result = this.hierarchicalToRelational(data, options);
    
    const endTime = performance.now();
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    const metrics = {
      conversionTime: endTime - startTime,
      memoryDelta: finalMemory - initialMemory,
      nodeCount: result.nodes.length,
      attachmentCount: result.attachments.length,
      linkCount: result.links.length
    };
    
    return { result, metrics };
  }

  // 内部プロパティ（循環参照検出用）
  private static _seenObjects?: WeakSet<object> | undefined;
}

export default DataConverter;

// 後方互換性のためのユーティリティエクスポート
export const validateData = DataConverter.validateData;
export const validateFile = DataConverter.validateFile;
export const cleanupData = DataConverter.cleanupData;