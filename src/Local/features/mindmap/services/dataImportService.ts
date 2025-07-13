// マインドマップデータのインポート機能
import { MindMapData, MindMapNode, FileAttachment } from '../../../shared/types/dataTypes';
import { logger } from '../../../shared/utils/logger';
import { localEngine } from '../../../core/storage/LocalEngine';

// インポート可能なフォーマット
export type ImportFormat = 'json' | 'xml';

// インポート設定
interface ImportOptions {
  validateStructure: boolean;
  sanitizeContent: boolean;
  preserveIds: boolean;
  importAttachments: boolean;
  importMapLinks: boolean;
  overwriteExisting: boolean;
}

// デフォルトインポート設定
const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  validateStructure: true,
  sanitizeContent: true,
  preserveIds: false,
  importAttachments: true,
  importMapLinks: true,
  overwriteExisting: false
};

// インポート結果の型
interface ImportResult {
  success: boolean;
  data?: MindMapData;
  errors: string[];
  warnings: string[];
  metadata?: {
    originalFormat: ImportFormat;
    nodeCount: number;
    attachmentCount: number;
    mapLinkCount: number;
    importedAt: string;
  };
}

// データ構造の検証
const validateMindMapStructure = (data: unknown): data is MindMapData => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const map = data as Record<string, unknown>;
  
  // 必須フィールドの確認
  if (!map.id || typeof map.id !== 'string') {
    return false;
  }
  
  if (!map.title || typeof map.title !== 'string') {
    return false;
  }
  
  if (!map.rootNode || typeof map.rootNode !== 'object') {
    return false;
  }

  return true;
};

// ノード構造の検証
const validateNodeStructure = (node: unknown): node is MindMapNode => {
  if (!node || typeof node !== 'object') {
    return false;
  }

  const nodeObj = node as Record<string, unknown>;
  
  return (
    typeof nodeObj.id === 'string' &&
    typeof nodeObj.text === 'string' &&
    typeof nodeObj.x === 'number' &&
    typeof nodeObj.y === 'number' &&
    (nodeObj.children === undefined || Array.isArray(nodeObj.children))
  );
};

// コンテンツのサニタイズ
const sanitizeContent = (content: string): string => {
  // HTMLタグの除去
  const withoutHtml = content.replace(/<[^>]*>/g, '');
  
  // 危険なスクリプトの除去
  const withoutScript = withoutHtml.replace(/javascript:/gi, '');
  
  // 制御文字の除去
  const withoutControl = withoutScript.replace(/[\x00-\x1F\x7F]/g, '');
  
  return withoutControl.trim();
};

// ノードのサニタイズ
const sanitizeNode = (node: MindMapNode): MindMapNode => {
  const sanitized: MindMapNode = {
    ...node,
    text: sanitizeContent(node.text),
    children: node.children?.map(sanitizeNode) || []
  };

  // 添付ファイルのサニタイズ
  if (node.attachments) {
    sanitized.attachments = node.attachments.map((attachment: FileAttachment) => ({
      ...attachment,
      name: sanitizeContent(attachment.name)
    }));
  }

  return sanitized;
};

// IDの再生成
const regenerateIds = (node: MindMapNode): MindMapNode => {
  const newNode: MindMapNode = {
    ...node,
    id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    children: node.children?.map(regenerateIds) || []
  };

  // 添付ファイルのIDも再生成
  if (node.attachments) {
    newNode.attachments = node.attachments.map((attachment: FileAttachment) => ({
      ...attachment,
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));
  }

  return newNode;
};

// ノード数のカウント
const countNodes = (node: MindMapNode): number => {
  let count = 1;
  if (node.children) {
    node.children.forEach(child => {
      count += countNodes(child);
    });
  }
  return count;
};

// 添付ファイル数のカウント
const countAttachments = (node: MindMapNode): number => {
  let count = node.attachments?.length || 0;
  if (node.children) {
    node.children.forEach(child => {
      count += countAttachments(child);
    });
  }
  return count;
};

// マップリンク数のカウント
const countMapLinks = (node: MindMapNode): number => {
  let count = node.mapLinks?.length || 0;
  if (node.children) {
    node.children.forEach(child => {
      count += countMapLinks(child);
    });
  }
  return count;
};

// JSONフォーマットからのインポート
const importFromJSON = async (jsonString: string, options: ImportOptions): Promise<ImportResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // JSONパース
    const parsedData = JSON.parse(jsonString);
    
    // 複数マップのエクスポートデータかチェック
    if (parsedData.maps && Array.isArray(parsedData.maps)) {
      errors.push('複数マップの一括インポートは現在サポートされていません。単一マップを選択してください。');
      return { success: false, errors, warnings };
    }

    // データ構造の検証
    if (options.validateStructure && !validateMindMapStructure(parsedData)) {
      errors.push('無効なマインドマップデータ構造です');
      return { success: false, errors, warnings };
    }

    // ルートノードの検証
    if (options.validateStructure && !validateNodeStructure(parsedData.rootNode)) {
      errors.push('無効なルートノード構造です');
      return { success: false, errors, warnings };
    }

    let processedData = { ...parsedData } as MindMapData;

    // コンテンツのサニタイズ
    if (options.sanitizeContent) {
      processedData.title = sanitizeContent(processedData.title);
      processedData.rootNode = sanitizeNode(processedData.rootNode);
      warnings.push('コンテンツをサニタイズしました');
    }

    // IDの再生成
    if (!options.preserveIds) {
      processedData.id = `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      processedData.rootNode = regenerateIds(processedData.rootNode);
      warnings.push('IDを再生成しました');
    }

    // 添付ファイルの除去
    if (!options.importAttachments) {
      const removeAttachments = (node: MindMapNode): MindMapNode => ({
        ...node,
        attachments: undefined,
        children: node.children?.map(removeAttachments) || []
      });
      processedData.rootNode = removeAttachments(processedData.rootNode);
      warnings.push('添付ファイルをスキップしました');
    }

    // マップリンクの除去
    if (!options.importMapLinks) {
      const removeMapLinks = (node: MindMapNode): MindMapNode => ({
        ...node,
        mapLinks: undefined,
        children: node.children?.map(removeMapLinks) || []
      });
      processedData.rootNode = removeMapLinks(processedData.rootNode);
      warnings.push('マップリンクをスキップしました');
    }

    // タイムスタンプの更新
    processedData.createdAt = processedData.createdAt || new Date().toISOString();
    processedData.updatedAt = new Date().toISOString();

    // メタデータの生成
    const metadata = {
      originalFormat: 'json' as ImportFormat,
      nodeCount: countNodes(processedData.rootNode),
      attachmentCount: countAttachments(processedData.rootNode),
      mapLinkCount: countMapLinks(processedData.rootNode),
      importedAt: new Date().toISOString()
    };

    return {
      success: true,
      data: processedData,
      errors,
      warnings,
      metadata
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'JSONパースエラー';
    errors.push(`JSONの解析に失敗しました: ${errorMessage}`);
    return { success: false, errors, warnings };
  }
};

// XMLフォーマットからのインポート
const importFromXML = async (xmlString: string, options: ImportOptions): Promise<ImportResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // DOMParserでXMLをパース
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // パースエラーのチェック
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      errors.push('XMLの解析に失敗しました: ' + parseError.textContent);
      return { success: false, errors, warnings };
    }

    // ルート要素の取得
    const mindmapElement = xmlDoc.documentElement;
    if (mindmapElement.tagName !== 'mindmap') {
      errors.push('無効なXML構造です。ルート要素は<mindmap>である必要があります。');
      return { success: false, errors, warnings };
    }

    // 基本情報の抽出
    const id = options.preserveIds 
      ? mindmapElement.getAttribute('id') || `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      : `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const title = mindmapElement.getAttribute('title') || '無題のマインドマップ';
    const createdAt = mindmapElement.getAttribute('createdAt') || new Date().toISOString();

    // ノードの再帰的パース
    const parseNode = (element: Element): MindMapNode | null => {
      if (element.tagName !== 'node') return null;

      const nodeId = options.preserveIds 
        ? element.getAttribute('id') || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        : `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const text = element.getAttribute('text') || '';
      const x = parseFloat(element.getAttribute('x') || '0');
      const y = parseFloat(element.getAttribute('y') || '0');
      const color = element.getAttribute('color') || undefined;
      const fontSize = element.getAttribute('fontSize') ? parseInt(element.getAttribute('fontSize')!) : undefined;
      const fontWeight = element.getAttribute('fontWeight') || undefined;
      const collapsed = element.getAttribute('collapsed') === 'true';

      const node: MindMapNode = {
        id: nodeId,
        text: options.sanitizeContent ? sanitizeContent(text) : text,
        x,
        y,
        children: [],
        ...(color && { color }),
        ...(fontSize && { fontSize }),
        ...(fontWeight && { fontWeight }),
        ...(collapsed && { collapsed })
      };

      // 添付ファイルの処理
      if (options.importAttachments) {
        const attachmentsElement = element.querySelector('attachments');
        if (attachmentsElement) {
          const attachmentElements = attachmentsElement.querySelectorAll('attachment');
          node.attachments = Array.from(attachmentElements).map(att => ({
            id: options.preserveIds 
              ? att.getAttribute('id') || `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              : `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: att.getAttribute('name') || '',
            type: att.getAttribute('type') || '',
            size: parseInt(att.getAttribute('size') || '0'),
            data: '', // XMLでは実際のデータは含まれない
            isImage: (att.getAttribute('type') || '').startsWith('image/'),
            createdAt: new Date().toISOString(),
            uploadedAt: new Date().toISOString()
          }));
        }
      }

      // マップリンクの処理
      if (options.importMapLinks) {
        const mapLinksElement = element.querySelector('mapLinks');
        if (mapLinksElement) {
          const mapLinkElements = mapLinksElement.querySelectorAll('mapLink');
          node.mapLinks = Array.from(mapLinkElements).map(link => ({
            id: options.preserveIds 
              ? link.getAttribute('id') || `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              : `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            targetMapId: link.getAttribute('targetMapId') || '',
            targetMapTitle: link.getAttribute('targetMapTitle') || '',
            description: link.getAttribute('description') || '',
            createdAt: new Date().toISOString()
          }));
        }
      }

      // 子ノードの処理
      const childrenElement = element.querySelector('children');
      if (childrenElement) {
        const childNodes = childrenElement.querySelectorAll(':scope > node');
        node.children = Array.from(childNodes)
          .map(parseNode)
          .filter((child): child is MindMapNode => child !== null);
      }

      return node;
    };

    // ルートノードの取得
    const rootNodeElement = mindmapElement.querySelector('node');
    if (!rootNodeElement) {
      errors.push('ルートノードが見つかりません');
      return { success: false, errors, warnings };
    }

    const rootNode = parseNode(rootNodeElement);
    if (!rootNode) {
      errors.push('ルートノードの解析に失敗しました');
      return { success: false, errors, warnings };
    }

    // MindMapDataオブジェクトの構築
    const processedData: MindMapData = {
      id,
      title: options.sanitizeContent ? sanitizeContent(title) : title,
      rootNode,
      createdAt,
      updatedAt: new Date().toISOString(),
      settings: {
        autoSave: true,
        autoLayout: false
      }
    };

    // メタデータの生成
    const metadata = {
      originalFormat: 'xml' as ImportFormat,
      nodeCount: countNodes(processedData.rootNode),
      attachmentCount: countAttachments(processedData.rootNode),
      mapLinkCount: countMapLinks(processedData.rootNode),
      importedAt: new Date().toISOString()
    };

    if (!options.importAttachments && metadata.attachmentCount > 0) {
      warnings.push('添付ファイル情報はスキップされました（実際のファイルデータはXMLに含まれません）');
    }

    return {
      success: true,
      data: processedData,
      errors,
      warnings,
      metadata
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'XML解析エラー';
    errors.push(`XMLの解析に失敗しました: ${errorMessage}`);
    return { success: false, errors, warnings };
  }
};

// メインのインポート関数
export const importMindMapData = async (
  content: string,
  format: ImportFormat,
  options: Partial<ImportOptions> = {}
): Promise<ImportResult> => {
  const finalOptions = { ...DEFAULT_IMPORT_OPTIONS, ...options };
  
  logger.info('📥 マインドマップインポート開始', {
    format,
    contentLength: content.length,
    options: finalOptions
  });

  let result: ImportResult;

  try {
    switch (format) {
      case 'json':
        result = await importFromJSON(content, finalOptions);
        break;
      
      case 'xml':
        result = await importFromXML(content, finalOptions);
        break;
      
      default:
        result = {
          success: false,
          errors: [`サポートされていないインポートフォーマットです: ${format}`],
          warnings: []
        };
    }

    if (result.success) {
      logger.info('✅ マインドマップインポート完了', {
        format,
        success: result.success,
        nodeCount: result.metadata?.nodeCount,
        warnings: result.warnings.length
      });
    } else {
      logger.error('❌ マインドマップインポート失敗', {
        format,
        errors: result.errors
      });
    }

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ マインドマップインポート中に予期しないエラー', {
      format,
      error: errorMessage
    });
    
    return {
      success: false,
      errors: [`インポート中に予期しないエラーが発生しました: ${errorMessage}`],
      warnings: []
    };
  }
};

// ファイルからのインポート
export const importMindMapFromFile = async (
  file: File,
  options: Partial<ImportOptions> = {}
): Promise<ImportResult> => {
  try {
    // ファイル形式の判定
    let format: ImportFormat;
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      format = 'json';
    } else if (file.type === 'application/xml' || file.type === 'text/xml' || file.name.endsWith('.xml')) {
      format = 'xml';
    } else {
      return {
        success: false,
        errors: [`サポートされていないファイル形式です: ${file.type}`],
        warnings: []
      };
    }

    // ファイルの読み取り
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!e.target?.result) {
          reject(new Error('ファイルの読み取りに失敗しました'));
          return;
        }
        resolve(e.target.result as string);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });

    return await importMindMapData(content, format, options);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ ファイルからのインポート失敗', {
      fileName: file.name,
      error: errorMessage
    });

    return {
      success: false,
      errors: [`ファイルの読み取りに失敗しました: ${errorMessage}`],
      warnings: []
    };
  }
};

// インポートしたデータをストレージに保存
export const saveImportedMindMap = async (
  importResult: ImportResult,
  options: { overwrite?: boolean } = {}
): Promise<{ success: boolean; mapId?: string; error?: string }> => {
  if (!importResult.success || !importResult.data) {
    return { success: false, error: 'インポートデータが無効です' };
  }

  try {
    const { data } = importResult;
    
    // 既存マップの確認
    const existingMap = localEngine.getMindMap(data.id);
    if (existingMap && !options.overwrite) {
      return { 
        success: false, 
        error: `マップID "${data.id}" は既に存在します。上書きするには overwrite オプションを有効にしてください。` 
      };
    }

    // マップの保存
    const saveResult = localEngine.createMindMap(data);
    
    if (saveResult.success) {
      logger.info('✅ インポートしたマインドマップを保存', {
        mapId: data.id,
        title: data.title,
        nodeCount: importResult.metadata?.nodeCount
      });
      
      return { success: true, mapId: data.id };
    } else {
      return { success: false, error: saveResult.error };
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ インポートしたマインドマップの保存失敗', {
      error: errorMessage
    });
    
    return { success: false, error: errorMessage };
  }
};