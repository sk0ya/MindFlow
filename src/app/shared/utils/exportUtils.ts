import type { MindMapData, MindMapNode, FileAttachment } from '../types/dataTypes';
import { formatFileSize } from './fileUtils';
import JSZip from 'jszip';


interface ExportOptions {
  includeMetadata?: boolean;
  attachmentExportMode?: 'links-only' | 'download-urls' | 'embedded';
}

/**
 * マインドマップをJSON形式でエクスポート
 */
export const exportToJSON = (
  data: MindMapData, 
  options: ExportOptions = {}
): string => {
  const { attachmentExportMode = 'links-only' } = options;
  
  // 必要最小限のプロパティのみを含むクリーンなデータを作成
  const exportData: Record<string, unknown> = {};
  
  // title, settings, theme, id, category, createdAt, updatedAtなどの不要なプロパティは一切含めない
  
  // 不要なプロパティを削除する関数
  const cleanNode = (node: MindMapNode): Record<string, unknown> => {
    const cleanedNode: Record<string, unknown> = {
      text: node.text,
      children: node.children?.map(cleanNode) || []
    };
    
    // 添付ファイルが存在する場合のみ追加
    if (node.attachments && node.attachments.length > 0) {
      cleanedNode.attachments = node.attachments;
    }
    
    // リンクが存在する場合のみ追加
    if (node.links && node.links.length > 0) {
      cleanedNode.links = node.links;
    }
    
    return cleanedNode;
  };
  
  if (attachmentExportMode === 'embedded') {
    // ZIP形式用：不要なプロパティを削除し、添付ファイル情報をパスのみに簡素化、ノートもattachmentsに含める
    const updateAttachmentPaths = (node: MindMapNode): Record<string, unknown> => {
      const attachmentPaths = node.attachments?.map(attachment => `./attachments/${node.id}/${attachment.name}`) || [];
      
      // ノートがある場合は添付ファイルとして追加
      if (node.note && node.note.trim()) {
        const safeName = (node.text || node.id).replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]/g, '_').trim();
        attachmentPaths.push(`./attachments/${node.id}/${safeName}.md`);
      }
      
      const cleanedNode: Record<string, unknown> = {
        text: node.text,
        children: node.children?.map(updateAttachmentPaths) || []
      };
      
      // 添付ファイルがある場合のみ追加
      if (attachmentPaths.length > 0) {
        cleanedNode.attachments = attachmentPaths;
      }
      
      // リンクがある場合のみ追加
      if (node.links && node.links.length > 0) {
        cleanedNode.links = node.links;
      }
      
      return cleanedNode;
    };
    
    exportData.rootNode = updateAttachmentPaths(data.rootNode);
  } else {
    // 通常の添付ファイル付きの場合
    exportData.rootNode = cleanNode(data.rootNode);
  }
  
  return JSON.stringify(exportData, null, 2);
};

/**
 * マインドマップをMarkdown形式でエクスポート
 */
export const exportToMarkdown = (
  data: MindMapData, 
  options: ExportOptions = {}
): string => {
  const { 
    includeMetadata = true, 
    attachmentExportMode = 'links-only'
  } = options;
  
  let markdown = '';
  
  // メタデータ
  if (includeMetadata) {
    markdown += `# ${data.title}\n\n`;
    markdown += `- **カテゴリー**: ${data.category}\n`;
    markdown += `- **作成日**: ${new Date(data.createdAt).toLocaleDateString('ja-JP')}\n`;
    markdown += `- **更新日**: ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}\n\n`;
    markdown += '---\n\n';
  }
  
  const convertNodeToMarkdown = (node: MindMapNode, level: number = 0): string => {
    // ZIP形式のembeddedモードでは見出しレベルを使用
    if (attachmentExportMode === 'embedded') {
      const headingLevel = Math.min(level + 1, 6); // 最大レベル6まで
      const heading = '#'.repeat(headingLevel);
      
      let nodeMarkdown = `${heading} ${node.text}\n\n`;
      
      // 添付ファイル（ノートファイル含む）
      if (node.attachments && node.attachments.length > 0) {
        node.attachments.forEach(attachment => {
          if (attachment.isImage) {
            nodeMarkdown += `![${attachment.name}](./attachments/${node.id}/${attachment.name})\n\n`;
          } else {
            nodeMarkdown += `📎 [${attachment.name}](./attachments/${node.id}/${attachment.name})\n\n`;
          }
        });
      }
      
      // ノートファイルを追加
      if (node.note && node.note.trim()) {
        const safeName = (node.text || node.id).replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]/g, '_').trim();
        nodeMarkdown += `📝 [${safeName}.md](./attachments/${node.id}/${safeName}.md)\n\n`;
      }
      
      // 子ノード
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          nodeMarkdown += convertNodeToMarkdown(child, level + 1);
        });
      }
      
      return nodeMarkdown;
    } else {
      // 通常のMarkdown形式（従来の処理）
      const indent = ' '.repeat(level * 2);
      const bullet = level === 0 ? '#' : '-';
      const prefix = level === 0 ? `${bullet} ` : `${indent}${bullet} `;
      
      let nodeMarkdown = `${prefix}${node.text}\n`;
      
      // 添付ファイル
      if (node.attachments && node.attachments.length > 0) {
        node.attachments.forEach(attachment => {
          switch (attachmentExportMode) {
            case 'download-urls':
              if (attachment.isImage && attachment.downloadUrl) {
                nodeMarkdown += `${indent}  ![${attachment.name}](${attachment.downloadUrl})\n`;
              } else if (attachment.downloadUrl) {
                nodeMarkdown += `${indent}  📎 [${attachment.name}](${attachment.downloadUrl})\n`;
              } else {
                nodeMarkdown += `${indent}  📎 ${attachment.name} (ダウンロードURL無し)\n`;
              }
              break;
            case 'links-only':
            default:
              nodeMarkdown += `${indent}  📎 ${attachment.name} (${formatFileSize(attachment.size)})\n`;
              break;
          }
        });
      }
      
      // 子ノード
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          nodeMarkdown += convertNodeToMarkdown(child, level + 1);
        });
      }
      
      return nodeMarkdown;
    }
  };
  
  markdown += convertNodeToMarkdown(data.rootNode);
  
  return markdown;
};

/**
 * マインドマップをプレーンテキスト形式でエクスポート
 */
export const exportToText = (
  data: MindMapData, 
  options: ExportOptions = {}
): string => {
  const { 
    includeMetadata = true, 
    attachmentExportMode = 'links-only'
  } = options;
  
  let text = '';
  
  // メタデータ
  if (includeMetadata) {
    text += `${data.title}\n`;
    text += '='.repeat(data.title.length) + '\n\n';
    text += `カテゴリー: ${data.category}\n`;
    text += `作成日: ${new Date(data.createdAt).toLocaleDateString('ja-JP')}\n`;
    text += `更新日: ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}\n\n`;
    text += '-'.repeat(50) + '\n\n';
  }
  
  const convertNodeToText = (node: MindMapNode, level: number = 0): string => {
    const indent = ' '.repeat(level * 2);
    let nodeText = `${indent}${node.text}\n`;
    
    // 添付ファイル
    if (node.attachments && node.attachments.length > 0) {
      node.attachments.forEach(attachment => {
        switch (attachmentExportMode) {
          case 'download-urls':
            if (attachment.downloadUrl) {
              nodeText += `${indent}  [添付] ${attachment.name} - ${attachment.downloadUrl}\n`;
            } else {
              nodeText += `${indent}  [添付] ${attachment.name} (ダウンロードURL無し)\n`;
            }
            break;
          case 'embedded':
            nodeText += `${indent}  [添付] ${attachment.name} -> ./attachments/${node.id}/${attachment.name}\n`;
            break;
          case 'links-only':
          default:
            nodeText += `${indent}  [添付] ${attachment.name} (${formatFileSize(attachment.size)})\n`;
            break;
        }
      });
    }
    
    // 子ノード
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        nodeText += convertNodeToText(child, level + 1);
      });
    }
    
    return nodeText;
  };
  
  text += convertNodeToText(data.rootNode);
  
  return text;
};

/**
 * ファイルをダウンロードする
 */
export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Blobをダウンロードする（フォールバック用）
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * ファイル保存ダイアログを使ってBlobを保存する
 */
export const saveBlobWithDialog = async (blob: Blob, defaultFilename: string): Promise<void> => {
  // File System Access APIが利用可能かチェック
  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as unknown as { showSaveFilePicker: (options: unknown) => Promise<{ createWritable: () => Promise<{ write: (data: unknown) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: 'ZIP files',
            accept: {
              'application/zip': ['.zip']
            }
          }
        ]
      });
      
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      return;
    } catch (error) {
      // ユーザーがキャンセルした場合はエラーをスローしない
      if ((error as Error).name === 'AbortError') {
        throw new Error('ファイル保存がキャンセルされました');
      }
      console.warn('File System Access API failed, falling back to download:', error);
    }
  }
  
  // フォールバック：従来のダウンロード方式
  downloadBlob(blob, defaultFilename);
};

/**
 * URLからファイルをfetchしてArrayBufferとして取得
 */
const fetchFileAsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  return response.arrayBuffer();
};

/**
 * dataURLをArrayBufferに変換
 */
const dataURLToArrayBuffer = (dataURL: string): ArrayBuffer => {
  const base64 = dataURL.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * 添付ファイルとそのノードIDの組み合わせ
 */
interface AttachmentWithNode {
  attachment: FileAttachment;
  nodeId: string;
  nodePath: string[]; // パンくずリスト用（将来の拡張用）
}

/**
 * ノートとそのノードIDの組み合わせ
 */
interface NodeWithNote {
  note: string;
  nodeId: string;
  nodeName: string;
  nodePath: string[]; // パンくずリスト用
}

/**
 * マインドマップの全添付ファイルを収集（ノードID付き）
 */
const collectAllAttachmentsWithNodes = (node: MindMapNode, path: string[] = []): AttachmentWithNode[] => {
  const attachmentsWithNodes: AttachmentWithNode[] = [];
  const currentPath = [...path, node.text || node.id];
  
  if (node.attachments && node.attachments.length > 0) {
    node.attachments.forEach(attachment => {
      attachmentsWithNodes.push({
        attachment,
        nodeId: node.id,
        nodePath: currentPath
      });
    });
  }
  
  if (node.children) {
    node.children.forEach(child => {
      attachmentsWithNodes.push(...collectAllAttachmentsWithNodes(child, currentPath));
    });
  }
  
  return attachmentsWithNodes;
};

/**
 * マインドマップの全ノートを収集（ノードID付き）
 */
const collectAllNotesWithNodes = (node: MindMapNode, path: string[] = []): NodeWithNote[] => {
  const notesWithNodes: NodeWithNote[] = [];
  const currentPath = [...path, node.text || node.id];
  
  if (node.note && node.note.trim()) {
    notesWithNodes.push({
      note: node.note,
      nodeId: node.id,
      nodeName: node.text || node.id,
      nodePath: currentPath
    });
  }
  
  if (node.children) {
    node.children.forEach(child => {
      notesWithNodes.push(...collectAllNotesWithNodes(child, currentPath));
    });
  }
  
  return notesWithNodes;
};

/**
 * マインドマップをZIP形式でエクスポート
 */
export const exportToZip = async (
  data: MindMapData,
  filename: string
): Promise<void> => {
  const zip = new JSZip();
  const safeFilename = filename.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]/g, '_').trim();
  
  try {
    // 1. マップデータをJSON形式で追加
    const jsonContent = exportToJSON(data, { attachmentExportMode: 'embedded' });
    zip.file(`${safeFilename}.json`, jsonContent);
    
    // 2. マップデータをMarkdown形式で追加（メタデータなし）
    const markdownContent = exportToMarkdown(data, { 
      attachmentExportMode: 'embedded',
      includeMetadata: false
    });
    zip.file(`${safeFilename}.md`, markdownContent);
    
    // 3. 添付ファイル情報を収集
    const allAttachmentsWithNodes = collectAllAttachmentsWithNodes(data.rootNode);
    
    // 3.1. ノート情報を収集
    const allNotesWithNodes = collectAllNotesWithNodes(data.rootNode);
    
    // 4. 添付ファイルを追加
    if (allAttachmentsWithNodes.length > 0) {
      const attachmentsFolder = zip.folder('attachments');
      
      if (attachmentsFolder && allAttachmentsWithNodes.length > 0) {
        // ノードごとにフォルダを作成し、その中にファイルを格納
        const downloadPromises = allAttachmentsWithNodes.map(async ({ attachment, nodeId }) => {
          try {
            let fileData: ArrayBuffer;
            
            // ノードIDをフォルダ名として使用
            const nodeFolder = attachmentsFolder.folder(nodeId);
            if (!nodeFolder) {
              console.warn(`Failed to create folder for node: ${nodeId}`);
              return;
            }
            
            if (attachment.downloadUrl) {
              // クラウドファイル: URLからダウンロード
              fileData = await fetchFileAsArrayBuffer(attachment.downloadUrl);
            } else if (attachment.dataURL) {
              // ローカルファイル: dataURLから変換
              fileData = dataURLToArrayBuffer(attachment.dataURL);
            } else {
              console.warn(`Attachment ${attachment.name} has no downloadUrl or dataURL, skipping`);
              return;
            }
            
            // ファイルをノード別フォルダに追加
            nodeFolder.file(attachment.name, fileData);
            // Successfully added attachment
            
          } catch (error) {
            console.error(`Failed to add attachment ${attachment.name} for node ${nodeId}:`, error);
            // エラーが発生したファイルはスキップして続行
          }
        });
        
        // すべての添付ファイルのダウンロードを並行実行
        await Promise.allSettled(downloadPromises);
      }
    }
    
    // 4.1. ノートファイルを追加（attachmentsフォルダ内）
    if (allNotesWithNodes.length > 0) {
      const attachmentsFolder = zip.folder('attachments') || zip.folder('attachments');
      
      if (attachmentsFolder) {
        allNotesWithNodes.forEach(({ note, nodeId, nodeName }) => {
          // ノードIDごとのフォルダを取得または作成
          const nodeFolder = attachmentsFolder.folder(nodeId);
          
          if (nodeFolder) {
            // ファイル名として安全な形式に変換（ノード名を使用）
            const safeName = nodeName.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]/g, '_').trim();
            const fileName = `${safeName}.md`;
            
            try {
              nodeFolder.file(fileName, note);
              // Successfully added note file
            } catch (error) {
              console.warn(`Failed to add note file ${fileName}:`, error);
              // エラーが発生した場合は、ノードIDをファイル名として使用
              const fallbackFileName = `${nodeId}.md`;
              try {
                nodeFolder.file(fallbackFileName, note);
                // Successfully added note file with fallback name
              } catch (fallbackError) {
                console.error(`Failed to add note file even with fallback name ${fallbackFileName}:`, fallbackError);
              }
            }
          }
        });
      }
    }
    
    // 5. README.txtを追加
    let attachmentInfo = '';
    // 添付ファイルまたはノートがある場合に情報を表示
    if (allAttachmentsWithNodes.length > 0 || allNotesWithNodes.length > 0) {
      attachmentInfo = '\n\nマップ構造と添付ファイル:\n';
      attachmentInfo += '='.repeat(20) + '\n';
      
      // ノードごとにグループ化（添付ファイルとノートファイルを統合）
      const nodeMap = new Map<string, { nodePath: string[], files: Array<{ name: string, type: 'attachment' | 'note' }> }>();
      
      // 添付ファイルを追加
      allAttachmentsWithNodes.forEach(({ attachment, nodeId, nodePath }: AttachmentWithNode) => {
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, { nodePath, files: [] });
        }
        nodeMap.get(nodeId)?.files.push({ name: attachment.name, type: 'attachment' });
      });
      
      // ノートファイルを追加
      allNotesWithNodes.forEach(({ nodeId, nodeName, nodePath }) => {
        const safeName = nodeName.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]/g, '_').trim();
        const fileName = `${safeName}.md`;
        
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, { nodePath, files: [] });
        }
        nodeMap.get(nodeId)?.files.push({ name: fileName, type: 'note' });
      });
      
      if (nodeMap.size === 0) {
        attachmentInfo += '\n添付ファイルはありません。\n';
      } else {
        nodeMap.forEach(({ nodePath, files }, nodeId) => {
          // ノード情報を表示
          attachmentInfo += `\n${nodePath.join(' > ')} [./attachments/${nodeId}]\n`;
          
          // ファイルを種類別に表示
          files.forEach(file => {
            const icon = file.type === 'note' ? '📝' : '📎';
            attachmentInfo += `  └─ ${icon} ${file.name}\n`;
          });
        });
      }
    }

    const readmeContent = `${data.title}
${'='.repeat(data.title.length)}

エクスポート日時: ${new Date().toLocaleString('ja-JP')}
形式: ZIP (マップデータ + 添付ファイル + ノート)

含まれるファイル:
- ${safeFilename}.json: 完全なマップデータ（再インポート用）
- ${safeFilename}.md: Markdown形式のマップ
- attachments/: 添付ファイル（ノードID別フォルダ構造、ノートファイル含む）${attachmentInfo}
`;
    
    zip.file('README.txt', readmeContent);
    
    // 6. ZIPファイルを生成してダウンロード
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    const zipFilename = `${safeFilename}.zip`;
    await saveBlobWithDialog(zipBlob, zipFilename);
    
  } catch (error) {
    console.error('ZIP export failed:', error);
    throw new Error(`ZIP形式でのエクスポートに失敗しました: ${error}`);
  }
};

