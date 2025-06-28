import React, { useState, useEffect } from 'react';
import './TutorialOverlay.css';

const TutorialOverlay = ({ isVisible, onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const tutorialSteps = [
    {
      target: '.mindmap-canvas',
      title: 'マインドマップキャンバス',
      content: 'ここがメインのマインドマップエリアです。ノードをクリックして選択し、ダブルクリックで編集できます。',
      position: 'center'
    },
    {
      target: '.toolbar',
      title: 'ツールバー',
      content: '保存、取り消し、やり直し、レイアウト変更などの機能があります。',
      position: 'bottom'
    },
    {
      target: '.node',
      title: 'ノード操作',
      content: 'ノードを右クリックでメニューを表示。ドラッグで位置を変更できます。',
      position: 'top'
    },
    {
      target: '.keyboard-shortcuts-info',
      title: 'キーボードショートカット',
      content: 'Tab: 子ノード追加\nEnter: 兄弟ノード追加\nSpace: 編集開始\nDelete: ノード削除',
      position: 'right'
    }
  ];

  const currentStepData = tutorialSteps[currentStep];

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Cloud mode: tutorial completion stored in session
    console.log('✅ Tutorial completed (cloud mode)');
    onComplete();
  };

  const handleSkip = () => {
    // Cloud mode: tutorial skipped stored in session
    console.log('⏭️ Tutorial skipped (cloud mode)');
    onSkip();
  };

  useEffect(() => {
    if (isVisible) {
      document.body.classList.add('tutorial-active');
    } else {
      document.body.classList.remove('tutorial-active');
    }

    return () => {
      document.body.classList.remove('tutorial-active');
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-backdrop" />
      
      {/* スポットライト効果 */}
      <div className="tutorial-spotlight" />
      
      {/* チュートリアルカード */}
      <div className={`tutorial-card tutorial-card-${currentStepData.position}`}>
        <div className="tutorial-header">
          <h3>{currentStepData.title}</h3>
          <button className="tutorial-close" onClick={handleSkip}>×</button>
        </div>
        
        <div className="tutorial-content">
          <p>{currentStepData.content}</p>
        </div>
        
        <div className="tutorial-footer">
          <div className="tutorial-progress">
            <span>{currentStep + 1} / {tutorialSteps.length}</span>
            <div className="tutorial-progress-bar">
              <div 
                className="tutorial-progress-fill"
                style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
              />
            </div>
          </div>
          
          <div className="tutorial-actions">
            <button 
              className="tutorial-btn tutorial-btn-secondary"
              onClick={handleSkip}
            >
              スキップ
            </button>
            
            {currentStep > 0 && (
              <button 
                className="tutorial-btn tutorial-btn-secondary"
                onClick={handlePrevious}
              >
                戻る
              </button>
            )}
            
            <button 
              className="tutorial-btn tutorial-btn-primary"
              onClick={handleNext}
            >
              {currentStep === tutorialSteps.length - 1 ? '完了' : '次へ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;