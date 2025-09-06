import { useCallback } from 'react';
import { useMindMapStore } from '../store/mindMapStore';
import { getOllamaService } from '../services/ollamaService';
import { logger } from '../../shared/utils/logger';
import type { MindMapNode } from '../../../shared/types';

/**
 * AI機能を管理するカスタムフック
 */
export function useAI() {
  const store = useMindMapStore();
  const {
    aiSettings,
    isGenerating,
    generationError,
    updateAISettings,
    resetAISettings,
    setIsGenerating,
    setGenerationError,
    toggleAIEnabled,
  } = store;
  
  /**
   * Ollamaサーバーの接続をテストする
   */
  const testConnection = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const service = getOllamaService(aiSettings.ollamaUrl);
      return await service.testConnection();
    } catch (error) {
      logger.error('Connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [aiSettings.ollamaUrl]);
  
  /**
   * 利用可能なモデル一覧を取得する
   */
  const getAvailableModels = useCallback(async (): Promise<string[]> => {
    try {
      const service = getOllamaService(aiSettings.ollamaUrl);
      return await service.getAvailableModels();
    } catch (error) {
      logger.error('Failed to get available models:', error);
      setGenerationError(error instanceof Error ? error.message : 'モデル一覧の取得に失敗しました');
      return [];
    }
  }, [aiSettings.ollamaUrl, setGenerationError]);
  
  /**
   * 子ノードを生成する
   */
  const generateChildNodes = useCallback(async (
    parentNode: MindMapNode,
    contextNodes?: MindMapNode[]
  ): Promise<string[]> => {
    if (!aiSettings.enabled) {
      throw new Error('AI機能が無効です');
    }
    
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      logger.info('Starting AI child node generation', {
        parentText: parentNode.text,
        parentId: parentNode.id,
        contextCount: contextNodes?.length || 0
      });
      
      // コンテキストを作成
      let context = parentNode.text;
      if (contextNodes && contextNodes.length > 0) {
        const contextTexts = contextNodes
          .map(node => node.text)
          .filter(text => text && text !== parentNode.text)
          .slice(0, 3); // 最大3つのコンテキストノード
        
        if (contextTexts.length > 0) {
          context += `\n\n関連するトピック: ${contextTexts.join(', ')}`;
        }
      }
      
      const service = getOllamaService(aiSettings.ollamaUrl);
      const childNodes = await service.generateChildNodes(
        parentNode.text,
        context,
        aiSettings
      );
      
      logger.info('AI child node generation completed', {
        parentText: parentNode.text,
        generatedCount: childNodes.length,
        childNodes
      });
      
      return childNodes;
    } catch (error) {
      logger.error('AI child node generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : '子ノードの生成に失敗しました';
      setGenerationError(errorMessage);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [aiSettings, setIsGenerating, setGenerationError]);
  
  /**
   * カスタムプロンプトでテキストを生成する
   */
  const generateText = useCallback(async (
    prompt: string,
    systemPrompt?: string
  ): Promise<string> => {
    if (!aiSettings.enabled) {
      throw new Error('AI機能が無効です');
    }
    
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      logger.info('Starting AI text generation', {
        promptLength: prompt.length,
        hasSystemPrompt: !!systemPrompt
      });
      
      const service = getOllamaService(aiSettings.ollamaUrl);
      const result = await service.generateText(prompt, aiSettings, systemPrompt);
      
      logger.info('AI text generation completed', {
        resultLength: result.length
      });
      
      return result;
    } catch (error) {
      logger.error('AI text generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'テキスト生成に失敗しました';
      setGenerationError(errorMessage);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [aiSettings, setIsGenerating, setGenerationError]);
  
  /**
   * 設定の妥当性をチェックする
   */
  const validateSettings = useCallback((): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!aiSettings.ollamaUrl.trim()) {
      errors.push('OllamaのURLが設定されていません');
    } else {
      try {
        new URL(aiSettings.ollamaUrl);
      } catch {
        errors.push('OllamaのURLが無効です');
      }
    }
    
    if (!aiSettings.model.trim()) {
      errors.push('モデルが選択されていません');
    }
    
    if (aiSettings.maxTokens < 1 || aiSettings.maxTokens > 4000) {
      errors.push('最大トークン数は1〜4000の範囲で設定してください');
    }
    
    if (aiSettings.temperature < 0 || aiSettings.temperature > 2) {
      errors.push('Temperature は0〜2の範囲で設定してください');
    }
    
    if (!aiSettings.systemPrompt.trim()) {
      errors.push('システムプロンプトが設定されていません');
    }
    
    if (!aiSettings.childGenerationPrompt.trim()) {
      errors.push('子ノード生成プロンプトが設定されていません');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }, [aiSettings]);
  
  return {
    // 設定
    aiSettings,
    updateAISettings,
    resetAISettings,
    toggleAIEnabled,
    
    // 状態
    isGenerating,
    generationError,
    
    // 機能
    testConnection,
    getAvailableModels,
    generateChildNodes,
    generateText,
    validateSettings,
    
    // ユーティリティ
    clearError: () => setGenerationError(null),
  };
}