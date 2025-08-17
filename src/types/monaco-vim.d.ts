declare module 'monaco-vim' {
  export function initVimMode(
    editor: import('monaco-editor').editor.IStandaloneCodeEditor,
    statusBarElement?: HTMLElement | null
  ): {
    defineEx: (name: string, alias: string, callback: () => void) => void;
    dispose: () => void;
  };
}