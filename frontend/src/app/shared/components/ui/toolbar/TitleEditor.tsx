import React, { useState, useCallback } from 'react';
import { useActivityLifecycle } from '../../../../core/hooks/useEditingState';

interface TitleEditorProps {
  title: string;
  onTitleChange: (title: string) => void;
}

const TitleEditor: React.FC<TitleEditorProps> = ({
  title,
  onTitleChange
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [tempTitle, setTempTitle] = useState<string>(title);
  
  // 編集状態を追跡（タイトル編集時のみ）
  useActivityLifecycle('typing', isEditingTitle);

  const handleTitleClick = useCallback((): void => {
    setIsEditingTitle(true);
    setTempTitle(title);
  }, [title]);

  const handleTitleSave = useCallback((): void => {
    onTitleChange(tempTitle);
    setIsEditingTitle(false);
  }, [tempTitle, onTitleChange]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setTempTitle(title);
    }
  }, [handleTitleSave, title]);

  const handleTitleBlur = useCallback((): void => {
    handleTitleSave();
  }, [handleTitleSave]);

  return (
    <div className="title-section">
      {isEditingTitle ? (
        <input
          type="text"
          value={tempTitle}
          onChange={(e) => setTempTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          autoFocus
          className="title-input"
        />
      ) : (
        <h1 
          className="app-title" 
          onClick={handleTitleClick}
          title="クリックして編集"
        >
          {title}
        </h1>
      )}
    </div>
  );
};

export default TitleEditor;