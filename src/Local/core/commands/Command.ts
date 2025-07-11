export interface Command {
  execute(): void | Promise<void>;
  undo(): void | Promise<void>;
  getDescription(): string;
}

export class CommandHistory {
  private history: Command[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;

  execute(command: Command): void {
    // 現在の位置より後の履歴を削除
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // 履歴サイズの制限
    if (this.history.length >= this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
    
    // コマンドを実行して履歴に追加
    command.execute();
    this.history.push(command);
    this.currentIndex++;
  }

  undo(): boolean {
    if (!this.canUndo()) return false;
    
    const command = this.history[this.currentIndex];
    command.undo();
    this.currentIndex--;
    return true;
  }

  redo(): boolean {
    if (!this.canRedo()) return false;
    
    this.currentIndex++;
    const command = this.history[this.currentIndex];
    command.execute();
    return true;
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  getUndoDescription(): string | null {
    if (!this.canUndo()) return null;
    return this.history[this.currentIndex].getDescription();
  }

  getRedoDescription(): string | null {
    if (!this.canRedo()) return null;
    return this.history[this.currentIndex + 1].getDescription();
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  getHistorySize(): number {
    return this.history.length;
  }
}