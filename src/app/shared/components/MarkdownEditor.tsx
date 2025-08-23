import React, { useRef, useEffect, useState } from 'react';
import { Editor, OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { marked } from 'marked';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  className?: string;
  height?: string;
  vimMode?: boolean;
  autoFocus?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  className = '',
  height = '400px',
  vimMode = false,
  autoFocus = false
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isVimEnabled, setIsVimEnabled] = useState(vimMode);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit');

  // Convert markdown to HTML
  const getPreviewHtml = (): string => {
    try {
      const result = marked.parse(value || '');
      return typeof result === 'string' ? result : '';
    } catch (error) {
      console.warn('Markdown parsing error:', error);
      return '<p>マークダウンの解析でエラーが発生しました</p>';
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure editor settings
    editor.updateOptions({
      wordWrap: 'on',
      minimap: { enabled: false },
      lineNumbers: 'on',
      fontSize: 14,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'boundary',
      folding: true,
      foldingStrategy: 'auto',
      showFoldingControls: 'always',
      glyphMargin: false,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    // Enable Vim mode if requested
    if (isVimEnabled) {
      enableVimMode(editor, monaco);
    }

    // Auto-focus when mounted (only if autoFocus is enabled)
    if (autoFocus) {
      editor.focus();
    }
  };

  const enableVimMode = async (editor: editor.IStandaloneCodeEditor, _monaco: typeof import('monaco-editor')) => {
    try {
      // Dynamically import monaco-vim for Vim mode support
      const { initVimMode } = await import('monaco-vim');
      
      // Initialize Vim mode
      const vimMode = initVimMode(editor, document.getElementById('vim-statusbar'));
      
      // Add Vim commands
      vimMode.defineEx('write', 'w', () => {
        onSave?.();
      });

      // Store vim mode instance for cleanup
      (editor as any)._vimMode = vimMode;
    } catch (error) {
      console.warn('Vim mode not available:', error);
      setIsVimEnabled(false);
    }
  };

  const toggleVimMode = async () => {
    if (!editorRef.current) return;

    if (isVimEnabled) {
      // Disable Vim mode
      const vimMode = (editorRef.current as any)._vimMode;
      if (vimMode) {
        vimMode.dispose();
        delete (editorRef.current as any)._vimMode;
      }
      setIsVimEnabled(false);
    } else {
      // Enable Vim mode
      const monaco = await import('monaco-editor');
      await enableVimMode(editorRef.current, monaco);
      setIsVimEnabled(true);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup Vim mode on unmount
      if (editorRef.current) {
        const vimMode = (editorRef.current as any)._vimMode;
        if (vimMode) {
          vimMode.dispose();
        }
      }
    };
  }, []);

  return (
    <div className={`markdown-editor ${className}`}>
      <div className="editor-toolbar">
        <div className="editor-controls">
          <div className="mode-toggles">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={`mode-toggle ${mode === 'edit' ? 'active' : ''}`}
              title="編集モード"
            >
              📝 編集
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`mode-toggle ${mode === 'preview' ? 'active' : ''}`}
              title="プレビューモード"
            >
              👁️ プレビュー
            </button>
            <button
              type="button"
              onClick={() => setMode('split')}
              className={`mode-toggle ${mode === 'split' ? 'active' : ''}`}
              title="分割表示モード"
            >
              🔄 分割
            </button>
          </div>
          <button
            type="button"
            onClick={toggleVimMode}
            className={`vim-toggle ${isVimEnabled ? 'active' : ''}`}
            title="Toggle Vim Mode"
          >
            Vim: {isVimEnabled ? 'ON' : 'OFF'}
          </button>
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="save-button"
              title="Save (Ctrl+S)"
            >
              Save
            </button>
          )}
        </div>
      </div>
      
      <div className={`editor-container mode-${mode}`} style={{ height }}>
        {(mode === 'edit' || mode === 'split') && (
          <div className="editor-pane">
            <Editor
              height="100%"
              defaultLanguage="markdown"
              value={value}
              onChange={(newValue) => {
                onChange(newValue ?? '');
              }}
              onMount={handleEditorDidMount}
              theme="vs"
              loading="エディターを読み込み中..."
              options={{
                selectOnLineNumbers: true,
                roundedSelection: false,
                readOnly: false,
                cursorStyle: 'line',
                automaticLayout: true,
                // キーボード関連の設定を明示的に指定
                acceptSuggestionOnEnter: 'off',
                acceptSuggestionOnCommitCharacter: false,
                quickSuggestions: false,
                parameterHints: { enabled: false },
                suggestOnTriggerCharacters: false,
                tabCompletion: 'off',
                wordBasedSuggestions: 'off'
              }}
            />
          </div>
        )}
        
        {(mode === 'preview' || mode === 'split') && (
          <div className="preview-pane">
            <div className="preview-content">
              {value.trim() ? (
                <div
                  className="markdown-preview"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                />
              ) : (
                <div className="preview-empty">
                  <div className="preview-empty-icon">📄</div>
                  <div className="preview-empty-message">プレビューするマークダウンテキストを入力してください</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {isVimEnabled && (
        <div id="vim-statusbar" className="vim-statusbar">
          <span className="vim-mode-indicator">-- NORMAL --</span>
        </div>
      )}
      
      <style>{`
        .markdown-editor {
          display: flex;
          flex-direction: column;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
          background-color: #ffffff;
        }

        .editor-toolbar {
          background-color: #f8f9fa;
          border-bottom: 1px solid #e5e7eb;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .editor-controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .mode-toggles {
          display: flex;
          gap: 4px;
        }

        .mode-toggle {
          background: #ffffff;
          border: 1px solid #d1d5db;
          color: #374151;
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .mode-toggle:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .mode-toggle.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .vim-toggle {
          background: #ffffff;
          border: 1px solid #d1d5db;
          color: #374151;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .vim-toggle:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .vim-toggle.active {
          background: #10b981;
          border-color: #10b981;
          color: white;
        }

        .save-button {
          background: #3b82f6;
          border: 1px solid #3b82f6;
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .save-button:hover {
          background: #2563eb;
        }

        .editor-container {
          flex: 1;
          overflow: hidden;
          display: flex;
        }

        .mode-edit .editor-pane {
          width: 100%;
        }

        .mode-preview .preview-pane {
          width: 100%;
        }

        .mode-split .editor-pane,
        .mode-split .preview-pane {
          width: 50%;
          border-right: 1px solid #e5e7eb;
        }

        .mode-split .preview-pane {
          border-right: none;
          border-left: 1px solid #e5e7eb;
        }

        .editor-pane {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .preview-pane {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ffffff;
        }

        .preview-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          height: 100%;
        }

        .markdown-preview {
          line-height: 1.6;
          color: #333333;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .markdown-preview h1,
        .markdown-preview h2,
        .markdown-preview h3,
        .markdown-preview h4,
        .markdown-preview h5,
        .markdown-preview h6 {
          margin: 20px 0 10px 0;
          font-weight: 600;
          line-height: 1.25;
        }

        .markdown-preview h1 {
          font-size: 2em;
          border-bottom: 1px solid #eaecef;
          padding-bottom: 10px;
        }

        .markdown-preview h2 {
          font-size: 1.5em;
          border-bottom: 1px solid #eaecef;
          padding-bottom: 8px;
        }

        .markdown-preview h3 {
          font-size: 1.25em;
        }

        .markdown-preview p {
          margin: 12px 0;
        }

        .markdown-preview ul,
        .markdown-preview ol {
          margin: 12px 0;
          padding-left: 20px;
        }

        .markdown-preview li {
          margin: 4px 0;
        }

        .markdown-preview pre {
          background: #f6f8fa;
          border-radius: 6px;
          padding: 16px;
          overflow-x: auto;
          border: 1px solid #e1e4e8;
          margin: 12px 0;
        }

        .markdown-preview code {
          background: #f6f8fa;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 85%;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }

        .markdown-preview pre code {
          background: none;
          padding: 0;
        }

        .markdown-preview blockquote {
          border-left: 4px solid #dfe2e5;
          padding: 0 16px;
          margin: 12px 0;
          color: #6a737d;
        }

        .markdown-preview table {
          border-collapse: collapse;
          margin: 12px 0;
          width: 100%;
        }

        .markdown-preview th,
        .markdown-preview td {
          border: 1px solid #dfe2e5;
          padding: 8px 12px;
          text-align: left;
        }

        .markdown-preview th {
          background: #f6f8fa;
          font-weight: 600;
        }

        .markdown-preview img {
          max-width: 100%;
          height: auto;
          margin: 12px 0;
        }

        .markdown-preview a {
          color: #0366d6;
          text-decoration: none;
        }

        .markdown-preview a:hover {
          text-decoration: underline;
        }

        .preview-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6b7280;
          text-align: center;
        }

        .preview-empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.6;
        }

        .preview-empty-message {
          font-size: 14px;
          line-height: 1.5;
        }

        .vim-statusbar {
          background-color: #f8f9fa;
          border-top: 1px solid #e5e7eb;
          padding: 4px 12px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          color: #374151;
          min-height: 20px;
          display: flex;
          align-items: center;
        }

        .vim-mode-indicator {
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default MarkdownEditor;