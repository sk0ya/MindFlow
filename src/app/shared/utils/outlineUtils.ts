import type { MindMapNode, MindMapData } from '@shared/types';

interface OutlineNode {
  id: string;
  text: string;
  note?: string;
  level: number;
  attachments?: any[];
  links?: any[];
  originalId?: string;
  children: OutlineNode[];
}

const escapeMarkdownHeadings = (text: string): string => {
  return text.replace(/^#+\s*/gm, '\\$&');
};

const convertNodeToOutlineNode = (node: MindMapNode, level: number = 1): OutlineNode => {
  return {
    id: node.id,
    text: node.text,
    note: node.note,
    level,
    attachments: node.attachments,
    links: node.links,
    children: node.children.map(child => convertNodeToOutlineNode(child, level + 1))
  };
};

const convertOutlineNodeToMarkdown = (node: OutlineNode, rootLevel: boolean = false): string => {
  let markdown = '';
  
  if (!rootLevel) {
    const headingLevel = Math.min(node.level, 6);
    const heading = '#'.repeat(headingLevel);
    markdown += `${heading} ${node.text}\n\n`;
  }
  
  if (node.note && node.note.trim()) {
    const escapedNote = escapeMarkdownHeadings(node.note.trim());
    markdown += `${escapedNote}\n\n`;
  }
  
  for (const child of node.children) {
    markdown += convertOutlineNodeToMarkdown(child);
  }
  
  return markdown;
};

export const convertMindMapToOutline = (data: MindMapData): string => {
  if (!data || !data.rootNode) {
    return '';
  }
  
  const rootOutlineNode = convertNodeToOutlineNode(data.rootNode, 0);
  return convertOutlineNodeToMarkdown(rootOutlineNode, true);
};


const parseMarkdownToOutlineNodes = (
  markdown: string, 
  lineToMetadataMap?: Map<number, { nodeId: string, attachments: any[], links: any[] }>
): OutlineNode[] => {
  const lines = markdown.split('\n');
  const nodes: OutlineNode[] = [];
  const nodeStack: OutlineNode[] = [];
  let currentNode: OutlineNode | null = null;
  let currentNoteLines: string[] = [];
  let nodeIdCounter = 1;
  
  const generateNodeId = () => `node_${nodeIdCounter++}`;
  
  const flushCurrentNote = () => {
    if (currentNode && currentNoteLines.length > 0) {
      currentNode.note = currentNoteLines.join('\n').trim();
      currentNoteLines = [];
    }
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (trimmedLine === '') {
      if (currentNoteLines.length > 0 || (i > 0 && lines[i - 1].trim() !== '')) {
        currentNoteLines.push('');
      }
      continue;
    }
    
    const headingMatch = trimmedLine.match(/^(#+)\s+(.+)$/);
    if (headingMatch) {
      flushCurrentNote();
      
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      
      const newNode: OutlineNode = {
        id: generateNodeId(),
        text,
        level,
        children: []
      };
      
      // 現在の行番号からNodeIDマッピングを取得し、そのNodeIDのメタデータを復元
      if (lineToMetadataMap) {
        const currentLineNumber = i + 1; // 1-based line number
        const lineMetadata = lineToMetadataMap.get(currentLineNumber);
        console.log(`Checking line ${currentLineNumber} (${text}) for metadata:`, lineMetadata);
        console.log(`Available line mappings:`, Array.from(lineToMetadataMap.keys()));
        
        if (lineMetadata && (lineMetadata.attachments.length > 0 || lineMetadata.links.length > 0)) {
          newNode.attachments = lineMetadata.attachments;
          newNode.links = lineMetadata.links;
          newNode.originalId = lineMetadata.nodeId;
          console.log(`✅ Restored metadata for line ${currentLineNumber} (${text}) from node ${lineMetadata.nodeId}:`, {
            attachments: lineMetadata.attachments.length,
            links: lineMetadata.links.length
          });
        } else if (lineMetadata) {
          console.log(`❌ Line ${currentLineNumber} has metadata but no attachments/links:`, lineMetadata);
        } else {
          console.log(`ℹ️ No metadata found for line ${currentLineNumber}`);
        }
      }
      
      while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].level >= level) {
        nodeStack.pop();
      }
      
      if (nodeStack.length === 0) {
        nodes.push(newNode);
      } else {
        nodeStack[nodeStack.length - 1].children.push(newNode);
      }
      
      nodeStack.push(newNode);
      currentNode = newNode;
    } else {
      const unescapedLine = trimmedLine.replace(/^\\(#+\s*)/g, '$1');
      currentNoteLines.push(unescapedLine);
    }
  }
  
  flushCurrentNote();
  return nodes;
};

const convertOutlineNodeToMindMapNode = (outlineNode: OutlineNode): MindMapNode => {
  return {
    id: outlineNode.id,
    text: outlineNode.text,
    note: outlineNode.note,
    x: 0,
    y: 0,
    attachments: outlineNode.attachments || [],
    links: outlineNode.links || [],
    children: outlineNode.children.map(convertOutlineNodeToMindMapNode)
  };
};

export const convertOutlineToMindMap = (
  markdown: string,
  originalData: MindMapData,
  lineToMetadataMap?: Map<number, { nodeId: string, attachments: any[], links: any[] }>
): MindMapData => {
  const lines = markdown.split('\n');
  let rootNote = '';
  let noteLines: string[] = [];
  
  // ルートノードのnoteを抽出（最初の見出しより前のコンテンツ）
  for (const line of lines) {
    const trimmedLine = line.trim();
    const headingMatch = trimmedLine.match(/^#+\s+(.+)$/);
    
    if (headingMatch) {
      break;
    }
    
    if (trimmedLine !== '' || noteLines.length > 0) {
      noteLines.push(line);
    }
  }
  
  rootNote = noteLines.join('\n').trim();
  
  const outlineNodes = parseMarkdownToOutlineNodes(markdown, lineToMetadataMap);
  
  let rootNode: MindMapNode;
  
  if (outlineNodes.length === 1) {
    rootNode = convertOutlineNodeToMindMapNode(outlineNodes[0]);
    rootNode.id = 'root';
    rootNode.text = originalData.rootNode.text; // 元のルートノードテキストを保持
    if (rootNote) {
      rootNode.note = rootNote;
    }
  } else if (outlineNodes.length > 1) {
    rootNode = {
      id: 'root',
      text: originalData.rootNode.text, // 元のルートノードテキストを保持
      note: rootNote || originalData.rootNode.note, // ルートノートを保持
      x: originalData.rootNode.x || 0,
      y: originalData.rootNode.y || 0,
      children: outlineNodes.map(convertOutlineNodeToMindMapNode)
    };
  } else {
    rootNode = {
      id: 'root',
      text: originalData.rootNode.text, // 元のルートノードテキストを保持
      note: rootNote || originalData.rootNode.note, // ルートノートを保持
      x: originalData.rootNode.x || 0,
      y: originalData.rootNode.y || 0,
      children: []
    };
  }
  
  return {
    ...originalData,
    rootNode,
    updatedAt: new Date().toISOString()
  };
};