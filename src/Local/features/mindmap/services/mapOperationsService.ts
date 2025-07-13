// マインドマップ操作サービス
import { MindMapData, MindMapNode, FileAttachment, NodeMapLink } from '../../../shared/types/dataTypes';
import { logger } from '../../../shared/utils/logger';
import { localEngine } from '../../../core/storage/LocalEngine';

// 複製オプション
interface DuplicationOptions {
  preserveAttachments: boolean;
  preserveMapLinks: boolean;
  preservePositions: boolean;
  addSuffix: boolean;
  customTitle?: string;
}

// デフォルト複製オプション
const DEFAULT_DUPLICATION_OPTIONS: DuplicationOptions = {
  preserveAttachments: true,
  preserveMapLinks: true,
  preservePositions: true,
  addSuffix: true
};

// 複製結果の型
interface DuplicationResult {
  success: boolean;
  data?: MindMapData;
  error?: string;
  metadata?: {
    originalMapId: string;
    newMapId: string;
    nodeCount: number;
    attachmentCount: number;
    mapLinkCount: number;
    duplicatedAt: string;
  };
}

// ノードの深いコピー（IDを再生成）
const deepCopyNode = (
  node: MindMapNode, 
  options: DuplicationOptions,
  idMapping: Map<string, string> = new Map()
): MindMapNode => {
  // 新しいIDを生成
  const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  idMapping.set(node.id, newNodeId);

  const copiedNode: MindMapNode = {
    id: newNodeId,
    text: node.text,
    x: options.preservePositions ? node.x : node.x + 50, // 位置を少しずらす
    y: options.preservePositions ? node.y : node.y + 50,
    children: []
  };

  // オプション属性をコピー
  if (node.fontSize !== undefined) copiedNode.fontSize = node.fontSize;
  if (node.fontWeight !== undefined) copiedNode.fontWeight = node.fontWeight;
  if (node.color !== undefined) copiedNode.color = node.color;
  if (node.collapsed !== undefined) copiedNode.collapsed = node.collapsed;

  // 添付ファイルの処理
  if (options.preserveAttachments && node.attachments) {
    copiedNode.attachments = node.attachments.map((attachment: FileAttachment) => ({
      ...attachment,
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uploadedAt: new Date().toISOString() // 複製時のタイムスタンプに更新
    }));
  }

  // マップリンクの処理
  if (options.preserveMapLinks && node.mapLinks) {
    copiedNode.mapLinks = node.mapLinks.map((link: NodeMapLink) => ({
      ...link,
      id: `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));
  }

  // 子ノードを再帰的にコピー
  if (node.children && node.children.length > 0) {
    copiedNode.children = node.children.map(child => 
      deepCopyNode(child, options, idMapping)
    );
  }

  return copiedNode;
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

// 一意なタイトルの生成
const generateUniqueTitle = (originalTitle: string, addSuffix: boolean): string => {
  if (!addSuffix) {
    return originalTitle;
  }

  // 既存のマップのタイトルを取得
  const existingMaps = localEngine.getAllMindMaps();
  const existingTitles = new Set(existingMaps.map(map => map.title));

  // "コピー" サフィックスを追加
  let newTitle = `${originalTitle} のコピー`;
  let counter = 1;

  // 重複があれば番号を付ける
  while (existingTitles.has(newTitle)) {
    counter++;
    newTitle = `${originalTitle} のコピー (${counter})`;
  }

  return newTitle;
};

// マインドマップの複製
export const duplicateMindMap = async (
  mapId: string,
  options: Partial<DuplicationOptions> = {}
): Promise<DuplicationResult> => {
  const finalOptions = { ...DEFAULT_DUPLICATION_OPTIONS, ...options };
  
  logger.info('📋 マインドマップ複製開始', {
    mapId,
    options: finalOptions
  });

  try {
    // 元のマップデータを取得
    const originalMap = localEngine.getMindMap(mapId);
    if (!originalMap) {
      const error = `マップが見つかりません: ${mapId}`;
      logger.error('❌ マップ複製失敗', { mapId, error });
      return { success: false, error };
    }

    // 新しいマップIDを生成
    const newMapId = `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // タイトルの決定
    const newTitle = finalOptions.customTitle || generateUniqueTitle(originalMap.title, finalOptions.addSuffix);

    // IDマッピングを追跡（後で必要になる場合のため）
    const idMapping = new Map<string, string>();

    // ルートノードの深いコピー
    const copiedRootNode = deepCopyNode(originalMap.rootNode, finalOptions, idMapping);

    // 新しいマップデータの構築
    const duplicatedMap: MindMapData = {
      id: newMapId,
      title: newTitle,
      rootNode: copiedRootNode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // 設定があれば引き継ぐ
      ...(originalMap.settings && { settings: { ...originalMap.settings } }),
      ...(originalMap.category && { category: originalMap.category })
    };

    // ストレージに保存
    const saveResult = localEngine.createMindMap(duplicatedMap);
    
    if (!saveResult.success) {
      const error = `複製したマップの保存に失敗: ${saveResult.error}`;
      logger.error('❌ マップ複製失敗', { mapId, newMapId, error });
      return { success: false, error };
    }

    // メタデータの生成
    const metadata = {
      originalMapId: mapId,
      newMapId,
      nodeCount: countNodes(copiedRootNode),
      attachmentCount: countAttachments(copiedRootNode),
      mapLinkCount: countMapLinks(copiedRootNode),
      duplicatedAt: new Date().toISOString()
    };

    logger.info('✅ マインドマップ複製完了', {
      originalMapId: mapId,
      newMapId,
      newTitle,
      nodeCount: metadata.nodeCount,
      attachmentCount: metadata.attachmentCount,
      mapLinkCount: metadata.mapLinkCount
    });

    return {
      success: true,
      data: duplicatedMap,
      metadata
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ マップ複製中に予期しないエラー', {
      mapId,
      error: errorMessage
    });

    return {
      success: false,
      error: `複製中に予期しないエラーが発生しました: ${errorMessage}`
    };
  }
};

// 複数マップの一括複製
export const duplicateMultipleMindMaps = async (
  mapIds: string[],
  options: Partial<DuplicationOptions> = {}
): Promise<{
  success: boolean;
  results: DuplicationResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}> => {
  logger.info('📋 複数マインドマップ一括複製開始', {
    mapCount: mapIds.length,
    mapIds
  });

  const results: DuplicationResult[] = [];
  
  for (const mapId of mapIds) {
    const result = await duplicateMindMap(mapId, options);
    results.push(result);
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  const summary = {
    total: mapIds.length,
    successful,
    failed
  };

  logger.info('✅ 複数マインドマップ一括複製完了', summary);

  return {
    success: failed === 0,
    results,
    summary
  };
};

// テンプレートからマップを作成
interface TemplateOptions {
  title: string;
  category?: string;
  preserveStructure: boolean;
  clearText: boolean;
}

export const createMapFromTemplate = async (
  templateMapId: string,
  options: TemplateOptions
): Promise<DuplicationResult> => {
  logger.info('📋 テンプレートからマップ作成開始', {
    templateMapId,
    options
  });

  try {
    // テンプレートマップを取得
    const templateMap = localEngine.getMindMap(templateMapId);
    if (!templateMap) {
      const error = `テンプレートマップが見つかりません: ${templateMapId}`;
      logger.error('❌ テンプレートからのマップ作成失敗', { templateMapId, error });
      return { success: false, error };
    }

    // テキストをクリアする関数
    const clearNodeText = (node: MindMapNode): MindMapNode => ({
      ...node,
      text: '', // テキストをクリア
      attachments: undefined, // 添付ファイルも削除
      mapLinks: undefined, // マップリンクも削除
      children: node.children?.map(clearNodeText) || []
    });

    // 複製オプションを設定
    const duplicationOptions: DuplicationOptions = {
      preserveAttachments: !options.clearText, // テキストクリア時は添付ファイルも削除
      preserveMapLinks: !options.clearText, // テキストクリア時はマップリンクも削除
      preservePositions: options.preserveStructure,
      addSuffix: false, // カスタムタイトルを使用
      customTitle: options.title
    };

    // まず通常の複製を実行
    const duplicationResult = await duplicateMindMap(templateMapId, duplicationOptions);
    
    if (!duplicationResult.success || !duplicationResult.data) {
      return duplicationResult;
    }

    // テキストをクリアする場合
    if (options.clearText) {
      const clearedRootNode = clearNodeText(duplicationResult.data.rootNode);
      duplicationResult.data.rootNode = clearedRootNode;
      
      // 変更をストレージに保存
      const updateResult = localEngine.updateMindMap(duplicationResult.data.id, duplicationResult.data);
      if (!updateResult.success) {
        logger.error('❌ テンプレートからのマップ作成失敗（更新）', {
          templateMapId,
          error: updateResult.error
        });
        return { success: false, error: updateResult.error };
      }
    }

    // カテゴリを設定
    if (options.category) {
      duplicationResult.data.category = options.category;
      const updateResult = localEngine.updateMindMap(duplicationResult.data.id, duplicationResult.data);
      if (!updateResult.success) {
        logger.warn('⚠️ カテゴリの設定に失敗', {
          mapId: duplicationResult.data.id,
          category: options.category
        });
      }
    }

    logger.info('✅ テンプレートからマップ作成完了', {
      templateMapId,
      newMapId: duplicationResult.data.id,
      title: options.title,
      category: options.category,
      textCleared: options.clearText
    });

    return duplicationResult;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ テンプレートからのマップ作成中に予期しないエラー', {
      templateMapId,
      error: errorMessage
    });

    return {
      success: false,
      error: `テンプレート作成中に予期しないエラーが発生しました: ${errorMessage}`
    };
  }
};

// マップの統計情報を取得
export const getMapStatistics = (mapId: string) => {
  try {
    const map = localEngine.getMindMap(mapId);
    if (!map) {
      return null;
    }

    const nodeCount = countNodes(map.rootNode);
    const attachmentCount = countAttachments(map.rootNode);
    const mapLinkCount = countMapLinks(map.rootNode);

    // ストレージサイズの計算（概算）
    const mapDataString = JSON.stringify(map);
    const storageSize = new Blob([mapDataString]).size;

    return {
      mapId,
      title: map.title,
      nodeCount,
      attachmentCount,
      mapLinkCount,
      storageSize,
      storageSizeFormatted: `${(storageSize / 1024).toFixed(1)} KB`,
      createdAt: map.createdAt,
      updatedAt: map.updatedAt,
      category: map.category || '未分類'
    };

  } catch (error) {
    logger.error('❌ マップ統計情報の取得失敗', {
      mapId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
};