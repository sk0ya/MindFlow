/**
 * MindMeisterのマークダウン形式をパースしてノード構造に変換するユーティリティ
 */

import { MindMapNode } from '../../shared/types';
import { generateId } from './idGenerator';

interface ParsedNode {
  text: string;
  level: number;
  children: ParsedNode[];
}

/**
 * MindMeisterのマークダウン形式からノード構造を解析
 */
export function parseMindMeisterMarkdown(markdown: string): MindMapNode | null {
  const lines = markdown.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return null;
  }

  // 最初の行からタイトルを抽出（# [タイトル](URL) 形式）
  const firstLine = lines[0].trim();
  let rootText = '';
  
  // MindMeisterのリンク形式を解析
  const linkMatch = firstLine.match(/^#\s*\[(.*?)\]/);
  if (linkMatch) {
    rootText = linkMatch[1];
  } else {
    // 通常のマークダウンヘッダー形式
    const headerMatch = firstLine.match(/^#+\s*(.+)/);
    rootText = headerMatch ? headerMatch[1] : firstLine;
  }

  // まず全行からインデントレベルを抽出して階層構造を判定
  const getAllIndentLevels = (lines: string[]): number[] => {
    const levels: number[] = [];
    for (const line of lines.slice(1)) { // 最初の行（タイトル）は除外
      const indentMatch = line.match(/^(\s*)-\s*(.+)/);
      if (indentMatch) {
        levels.push(indentMatch[1].length);
      }
    }
    return [...new Set(levels)].sort((a, b) => a - b); // 重複削除してソート
  };

  const indentLevels = getAllIndentLevels(lines);
  
  // 残りの行を解析してツリー構造を構築
  const parseTree = (lines: string[], startIndex: number): ParsedNode[] => {
    const nodes: ParsedNode[] = [];
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      
      // インデントレベルを計算（trimしない）
      const indentMatch = line.match(/^(\s*)-\s*(.+)/);
      if (!indentMatch) {
        i++;
        continue;
      }

      // インデントスペース数から実際のレベルを算出
      const indentSpaces = indentMatch[1].length;
      const indentLevel = indentLevels.indexOf(indentSpaces);
      const nodeText = indentMatch[2];

      const node: ParsedNode = {
        text: nodeText,
        level: indentLevel,
        children: []
      };

      // 子ノードを探す
      let j = i + 1;
      const childLines: string[] = [];
      
      while (j < lines.length) {
        const nextLine = lines[j];
        const nextIndentMatch = nextLine.match(/^(\s*)-\s*(.+)/);
        
        if (nextIndentMatch) {
          const nextIndentSpaces = nextIndentMatch[1].length;
          const nextIndentLevel = indentLevels.indexOf(nextIndentSpaces);
          
          if (nextIndentLevel > indentLevel) {
            childLines.push(lines[j]);
            j++;
          } else {
            break;
          }
        } else {
          j++;
        }
      }

      // 子ノードを再帰的に解析
      if (childLines.length > 0) {
        node.children = parseTree(childLines, 0);
      }

      nodes.push(node);
      i = j;
    }

    return nodes;
  };

  // ルートノード以外の行を解析
  const childNodes = parseTree(lines.slice(1), 0);

  // MindMapNode形式に変換
  const convertToMindMapNode = (parsedNode: ParsedNode): MindMapNode => {
    return {
      id: generateId(),
      text: parsedNode.text,
      x: 0,
      y: 0,
      children: parsedNode.children.map(convertToMindMapNode),
      collapsed: false,
      fontSize: 16,
      fontWeight: 'normal',
      color: '#333333',
      attachments: [],
      note: ''
    };
  };

  // ルートノードを作成
  const rootNode: MindMapNode = {
    id: generateId(),
    text: rootText,
    x: 0,
    y: 0,
    children: childNodes.map(convertToMindMapNode),
    collapsed: false,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    attachments: [],
    note: ''
  };

  return rootNode;
}

/**
 * マークダウンテキストがMindMeister形式かどうかを判定
 */
export function isMindMeisterFormat(text: string): boolean {
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return false;
  
  // 最初の行が # [タイトル](URL) 形式かどうか
  const firstLine = lines[0].trim();
  const hasMindMeisterLink = firstLine.match(/^#\s*\[.*?\]\(https?:\/\/.*mindmeister\.com.*\)/);
  
  if (hasMindMeisterLink) return true;
  
  // または、箇条書き形式のマークダウンかどうか
  const hasListItems = lines.some(line => line.trim().match(/^\s*-\s+.+/));
  const hasHeader = Boolean(lines[0].match(/^#+\s+.+/));
  
  return hasHeader && hasListItems;
}