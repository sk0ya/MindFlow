import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useAI } from '../../../../core/hooks/useAI';
import type { MindMapNode } from '../../../../shared/types';

interface AIGenerationModalProps {
  isOpen: boolean;
  parentNode: MindMapNode | null;
  contextNodes?: MindMapNode[];
  onClose: () => void;
  onGenerationComplete: (childTexts: string[]) => void;
}

const AIGenerationModal: React.FC<AIGenerationModalProps> = React.memo(({
  isOpen,
  parentNode,
  contextNodes = [],
  onClose,
  onGenerationComplete
}) => {
  const {
    aiSettings,
    isGenerating,
    generationError,
    generateChildNodes,
    generateText,
    clearError,
    validateSettings
  } = useAI();
  
  const [generatedChildren, setGeneratedChildren] = useState<string[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<boolean[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [step, setStep] = useState<'generating' | 'selecting' | 'completed'>('generating');
  
  const { isValid: isSettingsValid, errors: validationErrors } = validateSettings();
  
  const resetModal = useCallback(() => {
    setGeneratedChildren([]);
    setSelectedChildren([]);
    setCustomPrompt('');
    setShowCustomPrompt(false);
    setStep('generating');
    clearError();
  }, []); // 空の依存関係で固定
  
  const handleGenerate = useCallback(async () => {
    if (!parentNode) return;
    
    setStep('generating');
    setGeneratedChildren([]);
    clearError();
    
    try {
      const childTexts = await generateChildNodes(parentNode, contextNodes);
      setGeneratedChildren(childTexts);
      setSelectedChildren(new Array(childTexts.length).fill(true));
      setStep('selecting');
    } catch (error) {
      console.error('AI generation failed:', error);
      // エラーが発生してもモーダルは開いたまま
    }
  }, []); // 空の依存関係で固定してループを防止
  
  // モーダルが開かれたときに自動生成を開始 (無限ループを避けるため最低限の依存関係のみ)
  useEffect(() => {
    if (isOpen && parentNode && aiSettings.enabled && isSettingsValid) {
      handleGenerate();
    }
  }, [isOpen]);
  
  // モーダルが閉じられたときにリセット
  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen, resetModal]);
  
  const handleCustomGenerate = async () => {
    if (!parentNode || !customPrompt.trim()) return;
    
    setStep('generating');
    clearError();
    
    try {
      // カスタムプロンプトを使用してテキスト生成
      const fullPrompt = `${customPrompt}\n\n親ノード: ${parentNode.text}\nコンテキスト: ${contextNodes.map(n => n.text).join(', ')}`;
      
      const response = await generateText(fullPrompt);
      
      // レスポンスをパースして子ノードに変換
      const lines = response.split('\n').filter((line: string) => line.trim());
      const childTexts = lines.slice(0, 5).map((line: string) => 
        line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim()
      ).filter((text: string) => text);
      
      if (childTexts.length > 0) {
        setGeneratedChildren(childTexts);
        setSelectedChildren(new Array(childTexts.length).fill(true));
        setStep('selecting');
      }
    } catch (error) {
      console.error('Custom AI generation failed:', error);
    }
  };
  
  const handleToggleChild = (index: number) => {
    setSelectedChildren(prev => {
      const newSelected = [...prev];
      newSelected[index] = !newSelected[index];
      return newSelected;
    });
  };
  
  const handleAccept = () => {
    const selectedTexts = generatedChildren.filter((_, index) => selectedChildren[index]);
    if (selectedTexts.length > 0) {
      onGenerationComplete(selectedTexts);
    }
    onClose();
  };
  
  const handleRegenerate = () => {
    setStep('generating');
    handleGenerate();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="ai-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ai-modal">
        <div className="ai-modal-header">
          <h3>🤖 AI子ノード生成</h3>
          <button className="ai-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="ai-modal-content">
          {!aiSettings.enabled && (
            <div className="ai-warning">
              AI機能が無効です。設定画面でOllamaの設定を行い、AI機能を有効にしてください。
            </div>
          )}
          
          {!isSettingsValid && validationErrors.length > 0 && (
            <div className="ai-errors">
              <h4>設定に問題があります:</h4>
              {validationErrors.map((error, index) => (
                <div key={index} className="ai-error">{error}</div>
              ))}
            </div>
          )}
          
          {parentNode && (
            <div className="ai-parent-node">
              <strong>親ノード:</strong> "{parentNode.text}"
            </div>
          )}
          
          {contextNodes.length > 0 && (
            <div className="ai-context-nodes">
              <strong>コンテキスト:</strong> {contextNodes.map(n => n.text).join(', ')}
            </div>
          )}
          
          {step === 'generating' && (
            <div className="ai-generating">
              {isGenerating ? (
                <>
                  <div className="ai-spinner">🔄</div>
                  <p>AI が子ノードを生成中...</p>
                </>
              ) : generationError ? (
                <>
                  <div className="ai-error-display">
                    <h4>❌ 生成に失敗しました</h4>
                    <p>{generationError}</p>
                    <div className="ai-error-actions">
                      <button className="ai-button ai-button-primary" onClick={handleGenerate}>
                        🔄 再試行
                      </button>
                      <button className="ai-button ai-button-secondary" onClick={() => setShowCustomPrompt(true)}>
                        ✏️ カスタムプロンプト
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
          
          {step === 'selecting' && generatedChildren.length > 0 && (
            <div className="ai-selection">
              <h4>生成された子ノード (選択して追加):</h4>
              <div className="ai-children-list">
                {generatedChildren.map((child, index) => (
                  <label key={index} className="ai-child-item">
                    <input
                      type="checkbox"
                      checked={selectedChildren[index]}
                      onChange={() => handleToggleChild(index)}
                    />
                    <span className="ai-child-text">{child}</span>
                  </label>
                ))}
              </div>
              <div className="ai-selection-actions">
                <button 
                  className="ai-button ai-button-primary"
                  onClick={handleAccept}
                  disabled={!selectedChildren.some(selected => selected)}
                >
                  ✅ 選択したノードを追加
                </button>
                <button className="ai-button ai-button-secondary" onClick={handleRegenerate}>
                  🔄 再生成
                </button>
                <button className="ai-button ai-button-secondary" onClick={() => setShowCustomPrompt(true)}>
                  ✏️ カスタムプロンプト
                </button>
              </div>
            </div>
          )}
          
          {showCustomPrompt && (
            <div className="ai-custom-prompt">
              <h4>カスタムプロンプト:</h4>
              <textarea
                className="ai-prompt-textarea"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="どのような子ノードを生成したいか詳しく説明してください..."
                rows={4}
              />
              <div className="ai-custom-actions">
                <button 
                  className="ai-button ai-button-primary"
                  onClick={handleCustomGenerate}
                  disabled={!customPrompt.trim() || isGenerating}
                >
                  🚀 生成
                </button>
                <button className="ai-button ai-button-secondary" onClick={() => setShowCustomPrompt(false)}>
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
        
        <style>{`
          .ai-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
          }
          
          .ai-modal {
            background: #1e1e1e;
            border-radius: 8px;
            width: min(90vw, 600px);
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          }
          
          .ai-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid #3e3e42;
            background: #252526;
          }
          
          .ai-modal-header h3 {
            margin: 0;
            color: #cccccc;
            font-size: 16px;
          }
          
          .ai-modal-close {
            background: none;
            border: none;
            color: #cccccc;
            font-size: 20px;
            cursor: pointer;
            padding: 4px;
            border-radius: 3px;
          }
          
          .ai-modal-close:hover {
            background: rgba(255, 255, 255, 0.1);
          }
          
          .ai-modal-content {
            padding: 20px;
            max-height: calc(80vh - 70px);
            overflow-y: auto;
          }
          
          .ai-warning,
          .ai-errors {
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid #f44336;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 16px;
            color: #f48fb1;
          }
          
          .ai-parent-node,
          .ai-context-nodes {
            background: rgba(33, 150, 243, 0.1);
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 12px;
            color: #90caf9;
            font-size: 14px;
          }
          
          .ai-generating {
            text-align: center;
            padding: 40px 20px;
          }
          
          .ai-spinner {
            font-size: 24px;
            animation: spin 2s linear infinite;
            margin-bottom: 16px;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .ai-error-display {
            background: rgba(244, 67, 54, 0.1);
            border-radius: 8px;
            padding: 20px;
            text-align: center;
          }
          
          .ai-error-display h4 {
            color: #f44336;
            margin: 0 0 12px 0;
          }
          
          .ai-error-display p {
            color: #cccccc;
            margin: 0 0 16px 0;
          }
          
          .ai-error-actions,
          .ai-selection-actions,
          .ai-custom-actions {
            display: flex;
            gap: 8px;
            justify-content: center;
            flex-wrap: wrap;
          }
          
          .ai-children-list {
            margin: 16px 0;
          }
          
          .ai-child-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          
          .ai-child-item:hover {
            background: rgba(255, 255, 255, 0.1);
          }
          
          .ai-child-item input[type="checkbox"] {
            margin-right: 12px;
            accent-color: #007acc;
          }
          
          .ai-child-text {
            color: #cccccc;
            flex: 1;
          }
          
          .ai-prompt-textarea {
            width: 100%;
            padding: 12px;
            background: #2d2d30;
            border: 1px solid #464647;
            border-radius: 4px;
            color: #cccccc;
            font-family: inherit;
            font-size: 14px;
            resize: vertical;
            margin-bottom: 12px;
          }
          
          .ai-prompt-textarea:focus {
            outline: none;
            border-color: #007acc;
          }
          
          .ai-button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          }
          
          .ai-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .ai-button-primary {
            background: #007acc;
            color: white;
          }
          
          .ai-button-primary:hover:not(:disabled) {
            background: #005a9e;
          }
          
          .ai-button-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #cccccc;
          }
          
          .ai-button-secondary:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.2);
          }
          
          @media (prefers-color-scheme: light) {
            .ai-modal {
              background: #ffffff;
              color: #333333;
            }
            
            .ai-modal-header {
              background: #f5f5f5;
              border-bottom-color: #e0e0e0;
            }
            
            .ai-modal-header h3,
            .ai-modal-close {
              color: #333333;
            }
            
            .ai-child-item {
              background: rgba(0, 0, 0, 0.05);
            }
            
            .ai-child-item:hover {
              background: rgba(0, 0, 0, 0.1);
            }
            
            .ai-child-text {
              color: #333333;
            }
            
            .ai-prompt-textarea {
              background: #ffffff;
              border-color: #d1d1d1;
              color: #333333;
            }
            
            .ai-button-secondary {
              background: rgba(0, 0, 0, 0.1);
              color: #333333;
            }
            
            .ai-button-secondary:hover:not(:disabled) {
              background: rgba(0, 0, 0, 0.2);
            }
          }
        `}</style>
      </div>
    </div>
  );
});

export default AIGenerationModal;