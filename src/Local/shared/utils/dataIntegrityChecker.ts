/**
 * データ整合性チェッカー
 * ルートノード消失などの問題を検出・修復
 */

import type { MindMapData, MindMapNode } from '../types/dataTypes';

export interface DataIntegrityIssue {
  type: 'missing_root' | 'orphaned_nodes' | 'circular_reference' | 'invalid_structure';
  description: string;
  severity: 'critical' | 'warning' | 'info';
  data?: unknown;
}

export interface IntegrityCheckResult {
  isValid: boolean;
  issues: DataIntegrityIssue[];
  repairSuggestions: string[];
}

export class DataIntegrityChecker {
  /**
   * マインドマップデータの整合性をチェック
   */
  static checkMindMapIntegrity(mapData: MindMapData | null | undefined): IntegrityCheckResult {
    const issues: DataIntegrityIssue[] = [];
    const repairSuggestions: string[] = [];

    if (!mapData) {
      issues.push({
        type: 'invalid_structure',
        description: 'Map data is null or undefined',
        severity: 'critical'
      });
      return { isValid: false, issues, repairSuggestions };
    }

    // 1. ルートノードの存在チェック
    if (!mapData.rootNode) {
      issues.push({
        type: 'missing_root',
        description: 'Root node is missing',
        severity: 'critical',
        data: { mapId: mapData.id, title: mapData.title }
      });
      repairSuggestions.push('Create a new root node with default properties');
    } else {
      // ルートノードの基本プロパティチェック
      if (!mapData.rootNode.id) {
        issues.push({
          type: 'invalid_structure',
          description: 'Root node missing ID',
          severity: 'critical'
        });
        repairSuggestions.push('Set root node ID to "root"');
      }

      if (mapData.rootNode.id !== 'root') {
        issues.push({
          type: 'invalid_structure',
          description: `Root node ID should be "root", but found "${mapData.rootNode.id}"`,
          severity: 'warning'
        });
        repairSuggestions.push('Change root node ID to "root"');
      }

      if (!mapData.rootNode.text && mapData.rootNode.text !== '') {
        issues.push({
          type: 'invalid_structure',
          description: 'Root node missing text property',
          severity: 'warning'
        });
        repairSuggestions.push('Set default text for root node');
      }
    }

    // 2. 必須プロパティのチェック
    if (!mapData.id) {
      issues.push({
        type: 'invalid_structure',
        description: 'Map ID is missing',
        severity: 'critical'
      });
      repairSuggestions.push('Generate a new unique map ID');
    }

    if (!mapData.title) {
      issues.push({
        type: 'invalid_structure',
        description: 'Map title is missing',
        severity: 'warning'
      });
      repairSuggestions.push('Set default title "Untitled Map"');
    }

    // 3. ノード構造の再帰的チェック
    if (mapData.rootNode) {
      const nodeIssues = this.checkNodeStructure(mapData.rootNode, new Set(), 'root');
      issues.push(...nodeIssues.issues);
      repairSuggestions.push(...nodeIssues.repairSuggestions);
    }

    return {
      isValid: issues.filter(issue => issue.severity === 'critical').length === 0,
      issues,
      repairSuggestions
    };
  }

  /**
   * ノード構造の再帰的チェック
   */
  private static checkNodeStructure(
    node: MindMapNode | null | undefined, 
    visitedIds: Set<string>, 
    path: string
  ): { issues: DataIntegrityIssue[], repairSuggestions: string[] } {
    const issues: DataIntegrityIssue[] = [];
    const repairSuggestions: string[] = [];

    if (!node) {
      issues.push({
        type: 'invalid_structure',
        description: `Node is null at path: ${path}`,
        severity: 'critical'
      });
      return { issues, repairSuggestions };
    }

    // ID重複チェック
    if (visitedIds.has(node.id)) {
      issues.push({
        type: 'circular_reference',
        description: `Duplicate node ID found: ${node.id} at path: ${path}`,
        severity: 'critical',
        data: { nodeId: node.id, path }
      });
      repairSuggestions.push(`Generate new unique ID for node at ${path}`);
      return { issues, repairSuggestions }; // 循環参照の場合は処理を停止
    }

    visitedIds.add(node.id);

    // 必須プロパティチェック
    if (!node.id) {
      issues.push({
        type: 'invalid_structure',
        description: `Node missing ID at path: ${path}`,
        severity: 'critical'
      });
      repairSuggestions.push(`Generate unique ID for node at ${path}`);
    }

    if (node.text === undefined || node.text === null) {
      issues.push({
        type: 'invalid_structure',
        description: `Node missing text property at path: ${path}`,
        severity: 'warning'
      });
      repairSuggestions.push(`Set default text for node at ${path}`);
    }

    // 座標チェック
    if (typeof node.x !== 'number' || typeof node.y !== 'number') {
      issues.push({
        type: 'invalid_structure',
        description: `Node missing or invalid coordinates at path: ${path}`,
        severity: 'warning'
      });
      repairSuggestions.push(`Set default coordinates for node at ${path}`);
    }

    // 子ノードの再帰的チェック
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: MindMapNode, index: number) => {
        const childResult = this.checkNodeStructure(
          child, 
          visitedIds, 
          `${path}.children[${index}]`
        );
        issues.push(...childResult.issues);
        repairSuggestions.push(...childResult.repairSuggestions);
      });
    } else if (node.children && !Array.isArray(node.children)) {
      issues.push({
        type: 'invalid_structure',
        description: `Node children is not an array at path: ${path}`,
        severity: 'critical'
      });
      repairSuggestions.push(`Convert children to empty array at ${path}`);
    }

    return { issues, repairSuggestions };
  }

  /**
   * データ修復を試行
   */
  static repairMindMapData(mapData: MindMapData | null | undefined): { repaired: MindMapData | null, issues: DataIntegrityIssue[] } {
    if (!mapData) {
      console.error('❌ 修復不可: データがnullまたはundefined');
      return { repaired: null, issues: [] };
    }

    const repaired = JSON.parse(JSON.stringify(mapData)); // ディープコピー
    const issues: DataIntegrityIssue[] = [];

    // ルートノードが存在しない場合は作成
    if (!repaired.rootNode) {
      console.warn('🔧 ルートノードを再作成します');
      repaired.rootNode = {
        id: 'root',
        text: repaired.title || 'Root',
        x: 400,
        y: 300,
        children: []
      };
      issues.push({
        type: 'missing_root',
        description: 'Root node was recreated',
        severity: 'critical'
      });
    }

    // 必須プロパティの修復
    if (!repaired.id) {
      repaired.id = `map_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      issues.push({
        type: 'invalid_structure',
        description: 'Map ID was generated',
        severity: 'critical'
      });
    }

    if (!repaired.title) {
      repaired.title = 'Untitled Map';
      issues.push({
        type: 'invalid_structure',
        description: 'Default title was set',
        severity: 'warning'
      });
    }

    // ルートノードのIDを確実に'root'にする
    if (repaired.rootNode.id !== 'root') {
      console.warn(`🔧 ルートノードIDを "${repaired.rootNode.id}" から "root" に修正`);
      repaired.rootNode.id = 'root';
      issues.push({
        type: 'invalid_structure',
        description: 'Root node ID was corrected to "root"',
        severity: 'warning'
      });
    }

    return { repaired, issues };
  }

  /**
   * 操作前のデータ検証
   */
  static validateBeforeOperation(mapData: MindMapData | null | undefined, operation: string): boolean {
    const result = this.checkMindMapIntegrity(mapData);
    
    if (!result.isValid) {
      console.error(`❌ 操作前検証失敗: ${operation}`, {
        issues: result.issues,
        suggestions: result.repairSuggestions
      });
      return false;
    }

    return true;
  }

  /**
   * 詳細ログ出力
   */
  static logIntegrityReport(result: IntegrityCheckResult, mapData: MindMapData | null | undefined): void {
    // eslint-disable-next-line no-console
    console.group(`📊 データ整合性レポート: ${mapData?.title || 'Unknown Map'}`);
    
    
    if (result.issues.length > 0) {
      // eslint-disable-next-line no-console
      console.group('🚨 問題詳細:');
      result.issues.forEach((issue) => {
        if (issue.data) {
          // Log issue data if needed
        }
      });
      // eslint-disable-next-line no-console
      console.groupEnd();

      // eslint-disable-next-line no-console
      console.group('💡 修復提案:');
      result.repairSuggestions.forEach(() => {
        // Log suggestions if needed
      });
      // eslint-disable-next-line no-console
      console.groupEnd();
    }

    console.groupEnd();
  }
}