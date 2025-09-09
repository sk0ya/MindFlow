import { type MindMapNode, createNewNode } from '../types/dataTypes';
import { logger } from './logger';

/**
 * マークダウンの見出し行を解析
 */
interface ParsedHeading {
  level: number;
  text: string;
  content: string;
}

/**
 * マークダウンテキストを解析してノード階層に変換
 */
export class MarkdownImporter {
  
  /**
   * マークダウンテキストをパースしてMindMapNode構造に変換
   */
  static parseMarkdownToNodes(markdownText: string): MindMapNode {
    logger.debug('🔍 マークダウンパース開始', { 
      textLength: markdownText.length, 
      firstLine: markdownText.split('\n')[0] 
    });
    
    const lines = markdownText.split('\n');
    const headings = this.extractHeadings(lines);
    
    logger.debug('📝 見出し抽出結果', { 
      headingsCount: headings.length,
      headings: headings.map(h => ({ level: h.level, text: h.text }))
    });
    
    if (headings.length === 0) {
      // 見出しがない場合は全体を1つのノートとする
      logger.info('⚠️ 見出しが見つからないため、全体をノートとして処理');
      const rootNode = createNewNode('インポートされた内容');
      rootNode.id = 'root';
      rootNode.note = markdownText;
      return rootNode;
    }
    
    // 階層構造を正規化
    const normalizedHeadings = this.normalizeHeadingHierarchy(headings);
    logger.debug('🔄 階層正規化結果', { 
      normalizedCount: normalizedHeadings.length,
      normalized: normalizedHeadings.map(h => ({ level: h.level, text: h.text }))
    });
    
    // ノード構造を構築
    const result = this.buildNodeHierarchy(normalizedHeadings);
    logger.debug('🏗️ ノード構築結果', { 
      rootText: result.text,
      childrenCount: result.children?.length || 0,
      result
    });
    
    return result;
  }
  
  /**
   * マークダウンから見出しとその内容を抽出
   */
  private static extractHeadings(lines: string[]): ParsedHeading[] {
    const headings: ParsedHeading[] = [];
    let currentContent: string[] = [];
    let currentHeading: ParsedHeading | null = null;
    
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // 前の見出しが存在する場合、その内容を保存
        if (currentHeading) {
          currentHeading.content = currentContent.join('\n').trim();
          headings.push(currentHeading);
        }
        
        // 新しい見出しを開始
        currentHeading = {
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
          content: ''
        };
        currentContent = [];
      } else {
        // 見出し以外の行は現在の見出しの内容として蓄積
        currentContent.push(line);
      }
    }
    
    // 最後の見出しの内容を保存
    if (currentHeading) {
      currentHeading.content = currentContent.join('\n').trim();
      headings.push(currentHeading);
    }
    
    return headings;
  }
  
  /**
   * 見出し階層を正規化（階層の欠落を空ノードで補完）
   */
  private static normalizeHeadingHierarchy(headings: ParsedHeading[]): ParsedHeading[] {
    if (headings.length === 0) return [];
    
    const normalized: ParsedHeading[] = [];
    let lastLevel = 0;
    
    for (const heading of headings) {
      // 階層が飛んでいる場合は空ノードで埋める
      if (heading.level > lastLevel + 1) {
        for (let level = lastLevel + 1; level < heading.level; level++) {
          normalized.push({
            level,
            text: '', // 空文字のノード
            content: ''
          });
        }
      }
      
      normalized.push(heading);
      lastLevel = heading.level;
    }
    
    return normalized;
  }
  
  /**
   * 正規化された見出しリストからノード階層を構築
   */
  private static buildNodeHierarchy(headings: ParsedHeading[]): MindMapNode {
    if (headings.length === 0) {
      return createNewNode('空のマップ');
    }
    
    // ルートノードを作成
    const firstHeading = headings[0];
    const rootNode = createNewNode(firstHeading.text || 'インポートされたマップ');
    rootNode.id = 'root';
    
    // 最初の見出しにノートがある場合は追加
    if (firstHeading.content) {
      rootNode.note = firstHeading.content;
    }
    
    // スタックでノード階層を管理
    const nodeStack: { node: MindMapNode; level: number }[] = [
      { node: rootNode, level: firstHeading.level }
    ];
    
    // 残りの見出しを処理
    for (let i = 1; i < headings.length; i++) {
      const heading = headings[i];
      const newNode = createNewNode(heading.text);
      
      // ノートがある場合は追加
      if (heading.content) {
        newNode.note = heading.content;
      }
      
      // 適切な親ノードを見つける
      while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].level >= heading.level) {
        nodeStack.pop();
      }
      
      if (nodeStack.length > 0) {
        const parentNode = nodeStack[nodeStack.length - 1].node;
        parentNode.children = parentNode.children || [];
        parentNode.children.push(newNode);
      }
      
      // 新しいノードをスタックに追加
      nodeStack.push({ node: newNode, level: heading.level });
    }
    
    return rootNode;
  }
}