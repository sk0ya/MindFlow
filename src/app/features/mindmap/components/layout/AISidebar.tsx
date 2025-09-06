import React, { useState, useEffect } from 'react';
import { useAI } from '../../../../core/hooks/useAI';

const AISidebar: React.FC = () => {
  const {
    aiSettings,
    updateAISettings,
    toggleAIEnabled,
    testConnection,
    getAvailableModels,
    generationError,
    validateSettings,
    clearError
  } = useAI();
  
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string>('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  
  // 設定の妥当性をチェック
  const { errors: validationErrors } = validateSettings();
  
  // 接続テスト
  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError('');
    clearError();
    
    try {
      const result = await testConnection();
      if (result.success) {
        setConnectionStatus('success');
        // 接続成功時にモデル一覧も取得
        await handleLoadModels();
      } else {
        setConnectionStatus('error');
        setConnectionError(result.error || '接続に失敗しました');
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionError(error instanceof Error ? error.message : '接続テストでエラーが発生しました');
    }
  };
  
  // モデル一覧の取得
  const handleLoadModels = async () => {
    setIsLoadingModels(true);
    try {
      const models = await getAvailableModels();
      setAvailableModels(models);
      // 現在のモデルがリストにない場合、最初のモデルを選択
      if (models.length > 0 && !models.includes(aiSettings.model)) {
        updateAISettings({ model: models[0] });
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };
  
  // AI機能が有効になった時にモデル一覧を取得
  useEffect(() => {
    if (aiSettings.enabled && availableModels.length === 0) {
      handleLoadModels();
    }
  }, [aiSettings.enabled]);
  
  return (
    <div className="ai-sidebar">
      <div className="ai-sidebar-header">
        <h2 className="ai-sidebar-title">🤖 AI機能</h2>
        <p className="ai-sidebar-description">
          ローカルLLMを使用してマインドマップの子ノードを自動生成できます
        </p>
      </div>

      <div className="ai-sidebar-content">
        <div className="ai-section">
          <h3 className="ai-section-title">基本設定</h3>
          <div className="ai-section-content">
            <label className="ai-toggle">
              <input
                type="checkbox"
                checked={aiSettings.enabled}
                onChange={toggleAIEnabled}
              />
              <span className="ai-toggle-label">
                <span className="ai-toggle-icon">🤖</span>
                AI子ノード生成を有効にする
              </span>
            </label>
            
            {!aiSettings.enabled && (
              <div className="ai-info-box">
                <p>AI機能を有効にすると、ノードの右クリックメニューから「AI子ノード生成」オプションが利用できます。</p>
                <div className="ai-setup-steps">
                  <h4>セットアップ手順:</h4>
                  <ol>
                    <li>DockerでOllamaを起動</li>
                    <li>モデルをダウンロード（例: llama2）</li>
                    <li>下記の設定でOllamaに接続</li>
                    <li>AI機能を有効化</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {aiSettings.enabled && (
          <>
            <div className="ai-section">
              <h3 className="ai-section-title">接続設定</h3>
              <div className="ai-section-content">
                <div className="ai-setting-group">
                  <label className="ai-setting-label">
                    Ollama URL:
                    <input
                      type="text"
                      className="ai-input"
                      value={aiSettings.ollamaUrl}
                      onChange={(e) => updateAISettings({ ollamaUrl: e.target.value })}
                      placeholder="http://localhost:11434"
                    />
                  </label>
                  <button 
                    className={`ai-test-button ${connectionStatus}`}
                    onClick={handleTestConnection}
                    disabled={connectionStatus === 'testing' || !aiSettings.ollamaUrl.trim()}
                  >
                    {connectionStatus === 'testing' && '🔄 テスト中...'}
                    {connectionStatus === 'success' && '✅ 接続成功'}
                    {connectionStatus === 'error' && '❌ 接続失敗'}
                    {connectionStatus === 'idle' && '🔌 接続テスト'}
                  </button>
                  {connectionError && (
                    <div className="ai-error">{connectionError}</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="ai-section">
              <h3 className="ai-section-title">モデル設定</h3>
              <div className="ai-section-content">
                <div className="ai-setting-group">
                  <label className="ai-setting-label">
                    使用モデル:
                    <select
                      className="ai-select"
                      value={aiSettings.model}
                      onChange={(e) => updateAISettings({ model: e.target.value })}
                      disabled={isLoadingModels}
                    >
                      {isLoadingModels ? (
                        <option>読み込み中...</option>
                      ) : availableModels.length > 0 ? (
                        availableModels.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))
                      ) : (
                        <option value={aiSettings.model}>{aiSettings.model}</option>
                      )}
                    </select>
                  </label>
                  {availableModels.length === 0 && !isLoadingModels && (
                    <button className="ai-refresh-button" onClick={handleLoadModels}>
                      🔄 モデル一覧を更新
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="ai-section">
              <h3 className="ai-section-title">生成パラメータ</h3>
              <div className="ai-section-content">
                <div className="ai-setting-group">
                  <label className="ai-setting-label">
                    最大トークン数: {aiSettings.maxTokens}
                    <input
                      type="range"
                      className="ai-slider"
                      min="50"
                      max="500"
                      value={aiSettings.maxTokens}
                      onChange={(e) => updateAISettings({ maxTokens: parseInt(e.target.value) })}
                    />
                    <div className="ai-slider-info">
                      <span>50</span>
                      <span className="ai-current-value">{aiSettings.maxTokens}</span>
                      <span>500</span>
                    </div>
                  </label>
                </div>
                
                <div className="ai-setting-group">
                  <label className="ai-setting-label">
                    Temperature: {aiSettings.temperature}
                    <input
                      type="range"
                      className="ai-slider"
                      min="0"
                      max="2"
                      step="0.1"
                      value={aiSettings.temperature}
                      onChange={(e) => updateAISettings({ temperature: parseFloat(e.target.value) })}
                    />
                    <div className="ai-slider-info">
                      <span>0.0</span>
                      <span className="ai-current-value">{aiSettings.temperature}</span>
                      <span>2.0</span>
                    </div>
                  </label>
                  <p className="ai-param-description">
                    低い値ほど一貫性のある結果、高い値ほど創造的な結果が得られます
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ai-section">
              <h3 className="ai-section-title">高度な設定</h3>
              <div className="ai-section-content">
                <div className="ai-setting-group">
                  <label className="ai-setting-label">
                    システムプロンプト:
                    <textarea
                      className="ai-textarea"
                      value={aiSettings.systemPrompt}
                      onChange={(e) => updateAISettings({ systemPrompt: e.target.value })}
                      rows={3}
                      placeholder="AIの動作を制御するシステムプロンプト"
                    />
                  </label>
                </div>
                
                <div className="ai-setting-group">
                  <label className="ai-setting-label">
                    子ノード生成プロンプト:
                    <textarea
                      className="ai-textarea"
                      value={aiSettings.childGenerationPrompt}
                      onChange={(e) => updateAISettings({ childGenerationPrompt: e.target.value })}
                      rows={4}
                      placeholder="子ノード生成時のプロンプトテンプレート"
                    />
                  </label>
                  <p className="ai-param-description">
                    {'{parentText}'} と {'{context}'} は自動で置換されます
                  </p>
                </div>
                
                <button 
                  className="ai-reset-button"
                  onClick={() => {
                    if (window.confirm('AI設定をデフォルトに戻しますか？')) {
                      // デフォルト設定に戻す
                      updateAISettings({
                        systemPrompt: 'あなたは創造的で論理的な思考を持つAIアシスタントです。ユーザーのマインドマップ作成をサポートします。',
                        childGenerationPrompt: '以下のトピックについて、関連する子要素やサブトピックを3〜5個生成してください。各項目は簡潔に1〜3単語で表現してください。\n\nトピック: {parentText}\nコンテキスト: {context}',
                        maxTokens: 150,
                        temperature: 0.7
                      });
                    }
                  }}
                >
                  🔄 設定をデフォルトに戻す
                </button>
              </div>
            </div>
            
            {validationErrors.length > 0 && (
              <div className="ai-section">
                <h3 className="ai-section-title">⚠️ 設定の問題</h3>
                <div className="ai-validation-errors">
                  {validationErrors.map((error, index) => (
                    <div key={index} className="ai-error">{error}</div>
                  ))}
                </div>
              </div>
            )}
            
            {generationError && (
              <div className="ai-section">
                <h3 className="ai-section-title">🚨 エラー</h3>
                <div className="ai-section-content">
                  <div className="ai-error">{generationError}</div>
                  <button className="ai-button-secondary" onClick={clearError}>
                    エラーをクリア
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      <style>{`
        .ai-sidebar {
          height: 100%;
          overflow-y: auto;
          background: #1e1e1e;
          color: #cccccc;
        }

        .ai-sidebar-header {
          padding: 16px;
          border-bottom: 1px solid #3e3e42;
          background: #252526;
        }

        .ai-sidebar-title {
          margin: 0 0 8px 0;
          color: #ffffff;
          font-size: 18px;
          font-weight: 600;
        }

        .ai-sidebar-description {
          margin: 0;
          font-size: 14px;
          color: #cccccc;
          line-height: 1.4;
        }

        .ai-sidebar-content {
          padding: 16px;
        }

        .ai-section {
          margin-bottom: 24px;
        }

        .ai-section-title {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          margin: 0 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid #3e3e42;
        }

        .ai-section-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ai-toggle {
          display: flex;
          align-items: center;
          padding: 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
          border: 1px solid #3e3e42;
        }

        .ai-toggle:hover {
          background-color: #2d2d30;
        }

        .ai-toggle input[type="checkbox"] {
          margin-right: 12px;
          accent-color: #007acc;
          scale: 1.2;
        }

        .ai-toggle-label {
          display: flex;
          align-items: center;
          color: #cccccc;
          font-size: 14px;
          font-weight: 500;
        }

        .ai-toggle-icon {
          margin-right: 8px;
          font-size: 16px;
        }

        .ai-info-box {
          background: rgba(33, 150, 243, 0.1);
          border: 1px solid #2196f3;
          border-radius: 6px;
          padding: 16px;
          color: #90caf9;
          font-size: 14px;
        }

        .ai-setup-steps {
          margin-top: 12px;
        }

        .ai-setup-steps h4 {
          margin: 0 0 8px 0;
          color: #ffffff;
          font-size: 13px;
        }

        .ai-setup-steps ol {
          margin: 0;
          padding-left: 20px;
        }

        .ai-setup-steps li {
          margin-bottom: 4px;
        }

        .ai-setting-group {
          margin-bottom: 16px;
        }

        .ai-setting-label {
          display: block;
          color: #cccccc;
          font-size: 13px;
          margin-bottom: 6px;
          font-weight: 500;
        }

        .ai-input,
        .ai-select,
        .ai-textarea {
          width: 100%;
          padding: 8px 12px;
          background: #2d2d30;
          border: 1px solid #464647;
          border-radius: 4px;
          color: #cccccc;
          font-size: 13px;
          margin-top: 6px;
          font-family: inherit;
        }

        .ai-input:focus,
        .ai-select:focus,
        .ai-textarea:focus {
          outline: none;
          border-color: #007acc;
          box-shadow: 0 0 0 1px #007acc;
        }

        .ai-textarea {
          resize: vertical;
          min-height: 60px;
        }

        .ai-slider {
          width: 100%;
          height: 6px;
          background: #464647;
          border-radius: 3px;
          outline: none;
          margin: 8px 0 4px 0;
          accent-color: #007acc;
        }

        .ai-slider-info {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #888;
          margin-top: 4px;
        }

        .ai-current-value {
          color: #007acc;
          font-weight: 600;
        }

        .ai-param-description {
          font-size: 12px;
          color: #888;
          margin: 4px 0 0 0;
          line-height: 1.4;
        }

        .ai-test-button,
        .ai-refresh-button,
        .ai-reset-button {
          width: 100%;
          padding: 8px 16px;
          background: #007acc;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
          margin-top: 8px;
          font-weight: 500;
        }

        .ai-test-button:hover,
        .ai-refresh-button:hover,
        .ai-reset-button:hover {
          background: #005a9e;
        }

        .ai-test-button:disabled {
          background: #464647;
          cursor: not-allowed;
        }

        .ai-test-button.success {
          background: #4caf50;
        }

        .ai-test-button.error {
          background: #f44336;
        }

        .ai-reset-button {
          background: #ff9800;
          margin-top: 16px;
        }

        .ai-reset-button:hover {
          background: #f57c00;
        }

        .ai-button-secondary {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid #464647;
          border-radius: 4px;
          color: #cccccc;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 12px;
          margin-top: 8px;
        }

        .ai-button-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .ai-error {
          color: #f44336;
          font-size: 12px;
          padding: 8px 12px;
          background: rgba(244, 67, 54, 0.1);
          border-radius: 4px;
          border-left: 3px solid #f44336;
          margin-top: 8px;
        }

        .ai-validation-errors {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        @media (prefers-color-scheme: light) {
          .ai-sidebar {
            background: #ffffff;
            color: #333333;
          }

          .ai-sidebar-header {
            background: #f5f5f5;
            border-bottom-color: #e0e0e0;
          }

          .ai-sidebar-title {
            color: #333333;
          }

          .ai-sidebar-description {
            color: #666666;
          }

          .ai-section-title {
            color: #333333;
            border-bottom-color: #e0e0e0;
          }

          .ai-toggle {
            border-color: #d1d1d1;
          }

          .ai-toggle:hover {
            background-color: #f5f5f5;
          }

          .ai-toggle-label {
            color: #333333;
          }

          .ai-setting-label {
            color: #333333;
          }

          .ai-input,
          .ai-select,
          .ai-textarea {
            background: #ffffff;
            border-color: #d1d1d1;
            color: #333333;
          }

          .ai-input:focus,
          .ai-select:focus,
          .ai-textarea:focus {
            border-color: #007acc;
          }

          .ai-slider {
            background: #d1d1d1;
          }

          .ai-button-secondary {
            background: rgba(0, 0, 0, 0.1);
            border-color: #d1d1d1;
            color: #333333;
          }

          .ai-button-secondary:hover {
            background: rgba(0, 0, 0, 0.2);
          }

          .ai-error {
            background: rgba(244, 67, 54, 0.1);
            color: #d32f2f;
          }
        }
      `}</style>
    </div>
  );
};

export default AISidebar;