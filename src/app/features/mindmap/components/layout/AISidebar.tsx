import React, { useState, useEffect } from 'react';
import { Bot, Plug, CheckCircle, AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { useAI } from '../../../../core/hooks/useAI';
import { useConnectionTest } from '../../../../shared/hooks/useConnectionTest';
import { useModelLoader } from '../../../../shared/hooks/useModelLoader';

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
  
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  
  // 接続テスト用フック
  const {
    connectionStatus,
    connectionError,
    handleTestConnection
  } = useConnectionTest({
    testConnection,
    clearError,
    onSuccess: async () => {
      await loadModels();
    }
  });
  
  // モデル読み込み用フック
  const {
    availableModels,
    isLoadingModels,
    loadModels
  } = useModelLoader({
    getAvailableModels,
    currentModel: aiSettings.model,
    updateModel: (model) => updateAISettings({ model }),
    onCORSError: () => {
      // CORSエラー時に接続状態をエラーに設定
      // この処理は useConnectionTest で handleTestConnection を呼び出すことで対処
    }
  });
  
  // 設定の妥当性をチェック
  const { errors: validationErrors } = validateSettings();
  
  // 拡張機能の検出
  useEffect(() => {
    const checkExtension = () => {
      const isAvailable = typeof window !== 'undefined' && 
                         !!window.MindFlowOllamaBridge && 
                         window.MindFlowOllamaBridge.available === true;
      setExtensionAvailable(isAvailable);
    };
    
    // 初期チェック
    checkExtension();
    
    // 拡張機能の準備完了イベントをリッスン
    const handleExtensionReady = () => {
      checkExtension();
    };
    
    window.addEventListener('mindflowOllamaBridgeReady', handleExtensionReady);
    
    // 定期的にチェック（拡張機能が後から読み込まれる場合）
    const interval = setInterval(checkExtension, 1000);
    
    return () => {
      window.removeEventListener('mindflowOllamaBridgeReady', handleExtensionReady);
      clearInterval(interval);
    };
  }, []);
  
  // AI機能が有効になった時にモデル一覧を取得
  useEffect(() => {
    if (aiSettings.enabled && availableModels.length === 0) {
      loadModels();
    }
  }, [aiSettings.enabled, availableModels.length, loadModels]);
  
  return (
    <div className="ai-sidebar">
      <div className="ai-sidebar-header">
        <h2 className="ai-sidebar-title"><Bot size={14} style={{marginRight: '8px', verticalAlign: 'middle', width: '14px', height: '14px'}} />AI機能</h2>
        <p className="ai-sidebar-description">
          ローカルLLMを使用してマインドマップの子ノードを自動生成できます
        </p>
      </div>

      <div className="ai-sidebar-content">
        {/* 拡張機能ステータス */}
        <div className="ai-section">
          <h3 className="ai-section-title"><Plug size={14} style={{marginRight: '6px', verticalAlign: 'middle', width: '14px', height: '14px'}} />接続方法</h3>
          <div className="ai-section-content">
            {extensionAvailable ? (
              <div className="ai-extension-status success">
                <span className="ai-status-icon"><CheckCircle size={14} color="#4caf50" style={{width: '14px', height: '14px'}} /></span>
                <div className="ai-status-info">
                  <strong>MindFlow Ollama Bridge が利用可能</strong>
                  <p>本番環境でもローカルLLMにアクセスできます</p>
                </div>
              </div>
            ) : (
              <div className="ai-extension-status warning">
                <span className="ai-status-icon"><AlertTriangle size={14} color="#ff9800" style={{width: '14px', height: '14px'}} /></span>
                <div className="ai-status-info">
                  <strong>拡張機能なし - ローカル開発のみ</strong>
                  <p>
                    本番環境でローカルLLMを使用するには 
                    <a href="https://github.com/sk0ya/MindFlow/tree/main/browser-extension" 
                       target="_blank" rel="noopener noreferrer">
                      MindFlow Ollama Bridge拡張機能
                    </a> をインストールしてください。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
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
                <span className="ai-toggle-icon"><Bot size={14} style={{width: '14px', height: '14px'}} /></span>
                AI子ノード生成を有効にする
              </span>
            </label>
            
            {!aiSettings.enabled && (
              <div className="ai-info-box">
                <p>AI機能を有効にすると、ノードの右クリックメニューから「AI子ノード生成」オプションが利用できます。</p>
                <div className="ai-setup-steps">
                  <h4>ローカル環境でのセットアップ手順:</h4>
                  <ol>
                    <li>DockerでOllamaを起動</li>
                    <li>モデルをダウンロード（例: llama2）</li>
                    <li>下記の設定でOllamaに接続</li>
                    <li>AI機能を有効化</li>
                  </ol>
                  <p className="ai-deployment-note">
                    <strong>注意:</strong> デプロイされたアプリでは、ブラウザのCORSポリシーによりローカルのOllamaサーバーに直接アクセスできません。
                    ローカル開発環境でのみ利用可能です。
                  </p>
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
                    {connectionStatus === 'testing' && <><RefreshCw size={14} style={{marginRight: '6px', verticalAlign: 'middle', width: '14px', height: '14px'}} />テスト中...</>}
                    {connectionStatus === 'success' && <><CheckCircle size={14} style={{marginRight: '6px', verticalAlign: 'middle', width: '14px', height: '14px'}} />接続成功</>}
                    {connectionStatus === 'error' && <><AlertTriangle size={14} style={{marginRight: '6px', verticalAlign: 'middle', width: '14px', height: '14px'}} />接続失敗</>}
                    {connectionStatus === 'idle' && <><Plug size={14} style={{marginRight: '6px', verticalAlign: 'middle', width: '14px', height: '14px'}} />接続テスト</>}
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
                    <button className="ai-refresh-button" onClick={loadModels}>
<RefreshCw size={16} style={{marginRight: '6px', verticalAlign: 'middle'}} />モデル一覧を更新
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
<RotateCcw size={14} style={{marginRight: '6px', verticalAlign: 'middle', width: '14px', height: '14px'}} />設定をデフォルトに戻す
                </button>
              </div>
            </div>
            
            {validationErrors.length > 0 && (
              <div className="ai-section">
                <h3 className="ai-section-title"><AlertTriangle size={16} style={{marginRight: '6px', verticalAlign: 'middle'}} />設定の問題</h3>
                <div className="ai-validation-errors">
                  {validationErrors.map((error, index) => (
                    <div key={index} className="ai-error">{error}</div>
                  ))}
                </div>
              </div>
            )}
            
            {generationError && (
              <div className="ai-section">
                <h3 className="ai-section-title"><AlertTriangle size={16} style={{marginRight: '6px', verticalAlign: 'middle', color: '#f44336'}} />エラー</h3>
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
          display: flex;
          align-items: center;
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
          display: flex;
          align-items: center;
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

        .ai-deployment-note {
          margin-top: 12px;
          padding: 12px;
          background: rgba(255, 152, 0, 0.1);
          border: 1px solid #ff9800;
          border-radius: 4px;
          font-size: 12px;
          color: #ffb74d;
        }

        .ai-extension-status {
          display: flex;
          align-items: flex-start;
          padding: 12px;
          border-radius: 6px;
          gap: 12px;
        }

        .ai-extension-status.success {
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid #4caf50;
        }

        .ai-extension-status.warning {
          background: rgba(255, 152, 0, 0.1);
          border: 1px solid #ff9800;
        }

        .ai-status-icon {
          line-height: 1;
          flex-shrink: 0;
        }

        .ai-status-info {
          flex: 1;
        }

        .ai-status-info strong {
          display: block;
          margin-bottom: 6px;
          color: #ffffff;
          font-size: 13px;
        }

        .ai-status-info p {
          margin: 0;
          font-size: 12px;
          line-height: 1.4;
          color: #cccccc;
        }

        .ai-status-info a {
          color: #2196f3;
          text-decoration: none;
        }

        .ai-status-info a:hover {
          text-decoration: underline;
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
          display: flex;
          align-items: center;
          justify-content: center;
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

        /* ライトテーマ（デフォルト） */
        [data-theme="light"] .ai-sidebar,
        :root:not([data-theme="dark"]) .ai-sidebar {
          background: #ffffff;
          color: #333333;
        }

        [data-theme="light"] .ai-sidebar-header,
        :root:not([data-theme="dark"]) .ai-sidebar-header {
          background: #f5f5f5;
          border-bottom-color: #e0e0e0;
        }

        [data-theme="light"] .ai-sidebar-title,
        :root:not([data-theme="dark"]) .ai-sidebar-title {
          color: #333333;
        }

        [data-theme="light"] .ai-sidebar-description,
        :root:not([data-theme="dark"]) .ai-sidebar-description {
          color: #666666;
        }

        [data-theme="light"] .ai-section-title,
        :root:not([data-theme="dark"]) .ai-section-title {
          color: #333333;
          border-bottom-color: #e0e0e0;
        }

        [data-theme="light"] .ai-toggle,
        :root:not([data-theme="dark"]) .ai-toggle {
          border-color: #d1d1d1;
        }

        [data-theme="light"] .ai-toggle:hover,
        :root:not([data-theme="dark"]) .ai-toggle:hover {
          background-color: #f5f5f5;
        }

        [data-theme="light"] .ai-toggle-label,
        :root:not([data-theme="dark"]) .ai-toggle-label {
          color: #333333;
        }

        [data-theme="light"] .ai-setting-label,
        :root:not([data-theme="dark"]) .ai-setting-label {
          color: #333333;
        }

        [data-theme="light"] .ai-input,
        [data-theme="light"] .ai-select,
        [data-theme="light"] .ai-textarea,
        :root:not([data-theme="dark"]) .ai-input,
        :root:not([data-theme="dark"]) .ai-select,
        :root:not([data-theme="dark"]) .ai-textarea {
          background: #ffffff;
          border-color: #d1d1d1;
          color: #333333;
        }

        [data-theme="light"] .ai-input:focus,
        [data-theme="light"] .ai-select:focus,
        [data-theme="light"] .ai-textarea:focus,
        :root:not([data-theme="dark"]) .ai-input:focus,
        :root:not([data-theme="dark"]) .ai-select:focus,
        :root:not([data-theme="dark"]) .ai-textarea:focus {
          border-color: #007acc;
        }

        [data-theme="light"] .ai-slider,
        :root:not([data-theme="dark"]) .ai-slider {
          background: #d1d1d1;
        }

        [data-theme="light"] .ai-button-secondary,
        :root:not([data-theme="dark"]) .ai-button-secondary {
          background: rgba(0, 0, 0, 0.1);
          border-color: #d1d1d1;
          color: #333333;
        }

        [data-theme="light"] .ai-button-secondary:hover,
        :root:not([data-theme="dark"]) .ai-button-secondary:hover {
          background: rgba(0, 0, 0, 0.2);
        }

        [data-theme="light"] .ai-error,
        :root:not([data-theme="dark"]) .ai-error {
          background: rgba(244, 67, 54, 0.1);
          color: #d32f2f;
        }
      `}</style>
    </div>
  );
};

export default AISidebar;