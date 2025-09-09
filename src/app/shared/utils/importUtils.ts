import { type MindMapData, createInitialData, assignColorsToExistingNodes } from '../types/dataTypes';
import { MarkdownImporter } from './markdownImporter';
import { logger } from './logger';

/**
 * インポートオプション
 */
export interface ImportOptions {
  replaceMap?: boolean; // 既存のマップを置き換えるか
  category?: string; // インポート後のカテゴリ
  title?: string; // インポート後のタイトル
}

/**
 * インポート結果
 */
export interface ImportResult {
  success: boolean;
  data?: MindMapData;
  error?: string;
  warnings?: string[];
}

/**
 * マークダウンファイルインポート機能
 */
export class MarkdownFileImporter {
  
  /**
   * マークダウンファイルからマインドマップをインポート
   */
  static async importMarkdownFile(
    file: File, 
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      const { category = '', title } = options;
      
      // ファイル形式をチェック
      if (!this.isSupportedMarkdownFile(file)) {
        return {
          success: false,
          error: `マークダウンファイルのみサポートされています。選択されたファイル: ${file.name}`
        };
      }
      
      // ファイル内容を読み取り
      const content = await this.readFileContent(file);
      logger.debug('📄 ファイル内容読み取り完了', { 
        fileName: file.name, 
        contentLength: content.length,
        firstLine: content.split('\n')[0],
        lineCount: content.split('\n').length
      });
      
      // マークダウンからマインドマップデータを作成
      const importedData = await this.importMarkdown(
        content, 
        title || this.getFileNameWithoutExt(file), 
        category
      );
      
      logger.debug('🔄 マークダウン変換完了', {
        title: importedData.title,
        rootNodeText: importedData.rootNode.text,
        childrenCount: importedData.rootNode.children?.length || 0,
        rootNode: importedData.rootNode
      });
      
      // 色の自動割り当て（レイアウトは後でメインアプリで処理）
      const finalData = assignColorsToExistingNodes(importedData);
      
      logger.debug('✅ 最終データ準備完了', {
        title: finalData.title,
        rootNodeText: finalData.rootNode.text,
        childrenCount: finalData.rootNode.children?.length || 0
      });
      
      return {
        success: true,
        data: finalData
      };
      
    } catch (error) {
      return {
        success: false,
        error: `インポート中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      };
    }
  }
  
  /**
   * マークダウンファイルかチェック
   */
  private static isSupportedMarkdownFile(file: File): boolean {
    const supportedTypes = ['text/markdown'];
    const supportedExtensions = ['.md', '.markdown'];
    
    return supportedTypes.includes(file.type) || 
           supportedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }
  
  /**
   * ファイル内容を読み取り（改行コード統一）
   */
  private static readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          // すべての改行コードをLF(\n)に統一
          // 1. CRLF (\r\n) -> LF (\n)
          // 2. CR (\r) -> LF (\n)
          const normalizedContent = result
            .replace(/\r\n/g, '\n')  // Windows (CRLF)
            .replace(/\r/g, '\n');   // 旧Mac (CR)
          
          resolve(normalizedContent);
        } else {
          reject(new Error('ファイルの読み取りに失敗しました'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('ファイルの読み取り中にエラーが発生しました'));
      };
      
      reader.readAsText(file, 'utf-8');
    });
  }
  
  /**
   * Markdownファイルをインポート
   */
  private static async importMarkdown(content: string, title: string, category: string): Promise<MindMapData> {
    const rootNode = MarkdownImporter.parseMarkdownToNodes(content);
    
    const data = createInitialData();
    data.title = title;
    data.category = category;
    data.rootNode = rootNode;
    data.updatedAt = new Date().toISOString();
    
    return data;
  }
  
  
  /**
   * 拡張子を除いたファイル名を取得
   */
  private static getFileNameWithoutExt(file: File): string {
    const name = file.name;
    const lastDotIndex = name.lastIndexOf('.');
    return lastDotIndex > 0 ? name.substring(0, lastDotIndex) : name;
  }
}

// 後方互換性のため
export const FileImporter = MarkdownFileImporter;