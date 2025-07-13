// マインドマップデータのエクスポート機能
import { MindMapData, MindMapNode } from '../../../shared/types/dataTypes';
import { logger } from '../../../shared/utils/logger';

// エクスポート可能なフォーマット
export type ExportFormat = 'json' | 'xml' | 'markdown' | 'txt' | 'csv';

// エクスポート設定
interface ExportOptions {
  includeAttachments: boolean;
  includeMapLinks: boolean;
  compressData: boolean;
  format: ExportFormat;
  encoding?: 'utf-8' | 'utf-16';
}

// デフォルトエクスポート設定
const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeAttachments: true,
  includeMapLinks: true,
  compressData: false,
  format: 'json',
  encoding: 'utf-8'
};

// JSONフォーマットでエクスポート
const exportToJSON = (data: MindMapData, options: ExportOptions): string => {
  const exportData = {
    ...data,
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      exportedBy: 'MindFlow',
      options: {
        includeAttachments: options.includeAttachments,
        includeMapLinks: options.includeMapLinks
      }
    }
  };

  // 添付ファイルを除外する場合
  if (!options.includeAttachments) {
    const removeAttachments = (node: MindMapNode): MindMapNode => ({
      ...node,
      attachments: undefined,
      children: node.children?.map(removeAttachments) || []
    });
    exportData.rootNode = removeAttachments(exportData.rootNode);
  }

  // マップリンクを除外する場合
  if (!options.includeMapLinks) {
    const removeMapLinks = (node: MindMapNode): MindMapNode => ({
      ...node,
      mapLinks: undefined,
      children: node.children?.map(removeMapLinks) || []
    });
    exportData.rootNode = removeMapLinks(exportData.rootNode);
  }

  return JSON.stringify(exportData, null, options.compressData ? 0 : 2);
};

// XMLフォーマットでエクスポート
const exportToXML = (data: MindMapData, options: ExportOptions): string => {
  const escapeXML = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  const nodeToXML = (node: MindMapNode, depth: number = 0): string => {
    const indent = '  '.repeat(depth);
    let xml = `${indent}<node id="${node.id}" text="${escapeXML(node.text)}"`;
    
    if (node.x !== undefined) xml += ` x="${node.x}"`;
    if (node.y !== undefined) xml += ` y="${node.y}"`;
    if (node.color) xml += ` color="${escapeXML(node.color)}"`;
    if (node.fontSize) xml += ` fontSize="${node.fontSize}"`;
    if (node.fontWeight) xml += ` fontWeight="${escapeXML(node.fontWeight)}"`;
    if (node.collapsed) xml += ` collapsed="${node.collapsed}"`;
    
    xml += '>\n';

    // 添付ファイル
    if (options.includeAttachments && node.attachments?.length) {
      xml += `${indent}  <attachments>\n`;
      node.attachments.forEach(attachment => {
        xml += `${indent}    <attachment id="${attachment.id}" name="${escapeXML(attachment.name)}" type="${attachment.type}" size="${attachment.size}" />\n`;
      });
      xml += `${indent}  </attachments>\n`;
    }

    // マップリンク
    if (options.includeMapLinks && node.mapLinks?.length) {
      xml += `${indent}  <mapLinks>\n`;
      node.mapLinks.forEach(link => {
        xml += `${indent}    <mapLink id="${link.id}" targetMapId="${link.targetMapId}" targetMapTitle="${escapeXML(link.targetMapTitle)}" />\n`;
      });
      xml += `${indent}  </mapLinks>\n`;
    }

    // 子ノード
    if (node.children?.length) {
      xml += `${indent}  <children>\n`;
      node.children.forEach(child => {
        xml += nodeToXML(child, depth + 2);
      });
      xml += `${indent}  </children>\n`;
    }

    xml += `${indent}</node>\n`;
    return xml;
  };

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<mindmap id="${data.id}" title="${escapeXML(data.title)}" createdAt="${data.createdAt}" updatedAt="${data.updatedAt}">\n`;
  xml += '  <metadata>\n';
  xml += `    <exportedAt>${new Date().toISOString()}</exportedAt>\n`;
  xml += '    <exportVersion>1.0</exportVersion>\n';
  xml += '    <exportedBy>MindFlow</exportedBy>\n';
  xml += '  </metadata>\n';
  xml += nodeToXML(data.rootNode, 1);
  xml += '</mindmap>';

  return xml;
};

// Markdownフォーマットでエクスポート
const exportToMarkdown = (data: MindMapData, options: ExportOptions): string => {
  const nodeToMarkdown = (node: MindMapNode, depth: number = 0): string => {
    const indent = '  '.repeat(depth);
    const prefix = depth === 0 ? '# ' : `${'#'.repeat(Math.min(depth + 1, 6))} `;
    
    let markdown = `${prefix}${node.text}\n\n`;

    // 添付ファイル情報
    if (options.includeAttachments && node.attachments?.length) {
      markdown += `${indent}**添付ファイル:**\n`;
      node.attachments.forEach(attachment => {
        if (attachment.type.startsWith('image/')) {
          markdown += `${indent}- ![${attachment.name}](${attachment.dataURL || '#'} "${attachment.name}")\n`;
        } else {
          markdown += `${indent}- [${attachment.name}](#) (${attachment.type}, ${(attachment.size / 1024).toFixed(1)}KB)\n`;
        }
      });
      markdown += '\n';
    }

    // マップリンク情報
    if (options.includeMapLinks && node.mapLinks?.length) {
      markdown += `${indent}**関連マップ:**\n`;
      node.mapLinks.forEach(link => {
        markdown += `${indent}- [${link.targetMapTitle}](#${link.targetMapId})\n`;
      });
      markdown += '\n';
    }

    // 子ノード
    if (node.children?.length) {
      node.children.forEach(child => {
        markdown += nodeToMarkdown(child, depth + 1);
      });
    }

    return markdown;
  };

  let markdown = `# ${data.title}\n\n`;
  markdown += `**作成日:** ${new Date(data.createdAt).toLocaleDateString('ja-JP')}\n`;
  markdown += `**更新日:** ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}\n`;
  markdown += `**エクスポート日:** ${new Date().toLocaleDateString('ja-JP')}\n\n`;
  markdown += '---\n\n';
  
  if (data.rootNode.children?.length) {
    data.rootNode.children.forEach(child => {
      markdown += nodeToMarkdown(child, 0);
    });
  }

  return markdown;
};

// テキストフォーマットでエクスポート
const exportToText = (data: MindMapData, options: ExportOptions): string => {
  const nodeToText = (node: MindMapNode, depth: number = 0): string => {
    const indent = '  '.repeat(depth);
    let text = `${indent}- ${node.text}\n`;

    // 添付ファイル情報
    if (options.includeAttachments && node.attachments?.length) {
      node.attachments.forEach(attachment => {
        text += `${indent}  📎 ${attachment.name} (${attachment.type})\n`;
      });
    }

    // マップリンク情報
    if (options.includeMapLinks && node.mapLinks?.length) {
      node.mapLinks.forEach(link => {
        text += `${indent}  🔗 ${link.targetMapTitle}\n`;
      });
    }

    // 子ノード
    if (node.children?.length) {
      node.children.forEach(child => {
        text += nodeToText(child, depth + 1);
      });
    }

    return text;
  };

  let text = `${data.title}\n`;
  text += '='.repeat(data.title.length) + '\n\n';
  text += `作成日: ${new Date(data.createdAt).toLocaleDateString('ja-JP')}\n`;
  text += `更新日: ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}\n`;
  text += `エクスポート日: ${new Date().toLocaleDateString('ja-JP')}\n\n`;
  
  if (data.rootNode.children?.length) {
    data.rootNode.children.forEach(child => {
      text += nodeToText(child, 0);
    });
  }

  return text;
};

// CSVフォーマットでエクスポート
const exportToCSV = (data: MindMapData, options: ExportOptions): string => {
  const escapeCSV = (str: string): string => {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const collectNodes = (node: MindMapNode, path: string[] = [], depth: number = 0): Array<{
    id: string;
    text: string;
    path: string;
    depth: number;
    x: number;
    y: number;
    color?: string;
    attachmentCount: number;
    mapLinkCount: number;
  }> => {
    const currentPath = [...path, node.text];
    const result = [{
      id: node.id,
      text: node.text,
      path: currentPath.join(' > '),
      depth,
      x: node.x ?? 0,
      y: node.y ?? 0,
      color: node.color,
      attachmentCount: node.attachments?.length || 0,
      mapLinkCount: node.mapLinks?.length || 0
    }];

    if (node.children?.length) {
      node.children.forEach(child => {
        result.push(...collectNodes(child, currentPath, depth + 1));
      });
    }

    return result;
  };

  const nodes = collectNodes(data.rootNode);
  
  let csv = 'ID,テキスト,パス,深度,X座標,Y座標,色';
  if (options.includeAttachments) csv += ',添付ファイル数';
  if (options.includeMapLinks) csv += ',マップリンク数';
  csv += '\n';

  nodes.forEach(node => {
    let row = [
      escapeCSV(node.id),
      escapeCSV(node.text),
      escapeCSV(node.path),
      node.depth.toString(),
      (node.x ?? 0).toString(),
      (node.y ?? 0).toString(),
      node.color || ''
    ].join(',');

    if (options.includeAttachments) row += `,${node.attachmentCount}`;
    if (options.includeMapLinks) row += `,${node.mapLinkCount}`;
    
    csv += row + '\n';
  });

  return csv;
};

// メインのエクスポート関数
export const exportMindMapData = (
  data: MindMapData, 
  options: Partial<ExportOptions> = {}
): { content: string; filename: string; mimeType: string } => {
  const finalOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  
  logger.info('📤 マインドマップエクスポート開始', {
    mapId: data.id,
    mapTitle: data.title,
    format: finalOptions.format,
    options: finalOptions
  });

  let content: string;
  let mimeType: string;
  let extension: string;

  try {
    switch (finalOptions.format) {
      case 'json':
        content = exportToJSON(data, finalOptions);
        mimeType = 'application/json';
        extension = 'json';
        break;
      
      case 'xml':
        content = exportToXML(data, finalOptions);
        mimeType = 'application/xml';
        extension = 'xml';
        break;
      
      case 'markdown':
        content = exportToMarkdown(data, finalOptions);
        mimeType = 'text/markdown';
        extension = 'md';
        break;
      
      case 'txt':
        content = exportToText(data, finalOptions);
        mimeType = 'text/plain';
        extension = 'txt';
        break;
      
      case 'csv':
        content = exportToCSV(data, finalOptions);
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      
      default:
        throw new Error(`サポートされていないエクスポートフォーマットです: ${finalOptions.format}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `${data.title}_${timestamp}.${extension}`;

    logger.info('✅ マインドマップエクスポート完了', {
      mapId: data.id,
      format: finalOptions.format,
      contentLength: content.length,
      filename
    });

    return {
      content,
      filename,
      mimeType
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ マインドマップエクスポート失敗', {
      mapId: data.id,
      format: finalOptions.format,
      error: errorMessage
    });
    throw error;
  }
};

// ファイルダウンロードの実行
export const downloadExportedData = (
  content: string, 
  filename: string, 
  mimeType: string
): void => {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    logger.info('📥 エクスポートファイルダウンロード完了', {
      filename,
      mimeType,
      size: content.length
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ エクスポートファイルダウンロード失敗', {
      filename,
      error: errorMessage
    });
    throw error;
  }
};

// 複数マップの一括エクスポート
export const exportMultipleMindMaps = (
  maps: MindMapData[],
  options: Partial<ExportOptions> = {}
): { content: string; filename: string; mimeType: string } => {
  const finalOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  
  logger.info('📤 複数マインドマップ一括エクスポート開始', {
    mapCount: maps.length,
    format: finalOptions.format
  });

  const exportData = {
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      exportedBy: 'MindFlow',
      mapCount: maps.length,
      options: finalOptions
    },
    maps: maps.map(map => {
      // 各マップのエクスポートオプションを適用
      const processedMap = { ...map };
      
      if (!finalOptions.includeAttachments) {
        const removeAttachments = (node: MindMapNode): MindMapNode => ({
          ...node,
          attachments: undefined,
          children: node.children?.map(removeAttachments) || []
        });
        processedMap.rootNode = removeAttachments(processedMap.rootNode);
      }

      if (!finalOptions.includeMapLinks) {
        const removeMapLinks = (node: MindMapNode): MindMapNode => ({
          ...node,
          mapLinks: undefined,
          children: node.children?.map(removeMapLinks) || []
        });
        processedMap.rootNode = removeMapLinks(processedMap.rootNode);
      }

      return processedMap;
    })
  };

  const content = JSON.stringify(exportData, null, finalOptions.compressData ? 0 : 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `mindmaps_backup_${timestamp}.json`;

  logger.info('✅ 複数マインドマップ一括エクスポート完了', {
    mapCount: maps.length,
    contentLength: content.length,
    filename
  });

  return {
    content,
    filename,
    mimeType: 'application/json'
  };
};