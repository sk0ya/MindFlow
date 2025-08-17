import React, { useRef, useEffect, useState } from 'react';
import { Editor, OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

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
      showFoldingControls: 'always'
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
      
      <div className="editor-container" style={{ height }}>
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={value}
          onChange={(newValue) => onChange(newValue || '')}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: false,
            cursorStyle: 'line',
            automaticLayout: true,
          }}
        />
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
          background-color: #1e1e1e;
        }

        .editor-toolbar {
          background-color: #2d2d30;
          border-bottom: 1px solid #3e3e42;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .editor-controls {
          display: flex;
          gap: 8px;
        }

        .vim-toggle {
          background: #3c3c3c;
          border: 1px solid #5a5a5a;
          color: #cccccc;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .vim-toggle:hover {
          background: #4a4a4a;
        }

        .vim-toggle.active {
          background: #007acc;
          border-color: #007acc;
          color: white;
        }

        .save-button {
          background: #0e639c;
          border: 1px solid #0e639c;
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .save-button:hover {
          background: #1177bb;
        }

        .editor-container {
          flex: 1;
          overflow: hidden;
        }

        .vim-statusbar {
          background-color: #2d2d30;
          border-top: 1px solid #3e3e42;
          padding: 4px 12px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          color: #cccccc;
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