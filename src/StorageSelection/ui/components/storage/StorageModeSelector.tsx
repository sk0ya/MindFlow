import { useState } from 'react';
import { StorageMode } from '../../../core/storage/types';
import './StorageModeSelector.css';

interface StorageModeSelectorProps {
  currentMode: StorageMode | null;
  onModeChange: (mode: StorageMode) => void;
}

interface ModeInfo {
  id: StorageMode;
  title: string;
  description: string;
  icon: string;
  pros: string[];
  cons: string[];
  recommended: string;
  technical: string;
}

const STORAGE_MODES: ModeInfo[] = [
  {
    id: 'local',
    title: 'ローカルストレージ',
    description: 'このデバイスにのみデータを保存',
    icon: '💾',
    pros: [
      '高速でオフライン動作',
      'プライバシー保護',
      '認証不要ですぐ利用可能',
      '外部依存なし'
    ],
    cons: [
      'デバイス間での同期不可',
      'データのバックアップなし',
      'ブラウザデータ削除で消失リスク'
    ],
    recommended: '個人利用・プライバシー重視の方におすすめ',
    technical: 'IndexedDB使用'
  },
  {
    id: 'cloud',
    title: 'クラウドストレージ',
    description: 'クラウドでデータを保存・同期',
    icon: '☁️',
    pros: [
      'デバイス間での自動同期',
      'データの自動バックアップ',
      'どこからでもアクセス可能',
      'データ永続化'
    ],
    cons: [
      'インターネット接続が必要',
      'メール認証が必要',
      'クラウドサーバーへの依存'
    ],
    recommended: '複数デバイス利用・チーム共有の方におすすめ',
    technical: 'Cloudflare Workers + IndexedDB'
  },
  {
    id: 'hybrid',
    title: 'ハイブリッドモード',
    description: 'ローカル+クラウドの両方を活用',
    icon: '🔄',
    pros: [
      'オフライン・オンライン両対応',
      'ローカルの高速性',
      'クラウドの同期・バックアップ',
      '最適なユーザー体験'
    ],
    cons: [
      '若干複雑な仕組み',
      '同期競合の可能性',
      'ストレージ使用量がやや多い'
    ],
    recommended: '最高の体験を求める上級者におすすめ',
    technical: 'デュアルレイヤーアーキテクチャ'
  }
];

export function StorageModeSelector({ currentMode, onModeChange }: StorageModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<StorageMode | null>(currentMode);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleModeSelect = (mode: StorageMode) => {
    setSelectedMode(mode);
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    if (selectedMode) {
      onModeChange(selectedMode);
    }
  };

  const handleBack = () => {
    setShowConfirmation(false);
    setSelectedMode(null);
  };

  if (showConfirmation && selectedMode) {
    const modeInfo = STORAGE_MODES.find(m => m.id === selectedMode)!;
    
    return (
      <div className="storage-mode-selector">
        <div className="confirmation-container">
          <div className="confirmation-header">
            <span className="mode-icon-large">{modeInfo.icon}</span>
            <h2>{modeInfo.title}</h2>
            <p className="confirmation-description">{modeInfo.description}</p>
          </div>
          
          <div className="confirmation-details">
            <div className="detail-section">
              <h4>✅ メリット</h4>
              <ul>
                {modeInfo.pros.map((pro, index) => (
                  <li key={index}>{pro}</li>
                ))}
              </ul>
            </div>
            
            <div className="detail-section">
              <h4>⚠️ 注意点</h4>
              <ul>
                {modeInfo.cons.map((con, index) => (
                  <li key={index}>{con}</li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="confirmation-actions">
            <button className="btn-secondary" onClick={handleBack}>
              戻る
            </button>
            <button className="btn-primary" onClick={handleConfirm}>
              {modeInfo.title}で開始
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="storage-mode-selector">
      <div className="selector-header">
        <h1>MindFlow</h1>
        <h2>ストレージモードを選択してください</h2>
        <p className="selector-subtitle">
          あなたの使用スタイルに最適なデータ保存方法を選択できます
        </p>
      </div>
      
      <div className="mode-options">
        {STORAGE_MODES.map((mode) => (
          <div
            key={mode.id}
            className={`mode-option ${selectedMode === mode.id ? 'selected' : ''}`}
            onClick={() => handleModeSelect(mode.id)}
          >
            <div className="mode-header">
              <span className="mode-icon">{mode.icon}</span>
              <h3>{mode.title}</h3>
            </div>
            
            <p className="mode-description">{mode.description}</p>
            
            <div className="mode-features">
              <div className="pros">
                {mode.pros.slice(0, 2).map((pro, index) => (
                  <div key={index} className="feature-item">
                    <span className="feature-icon">✓</span>
                    {pro}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mode-recommendation">
              {mode.recommended}
            </div>
            
            <div className="mode-technical">
              技術: {mode.technical}
            </div>
          </div>
        ))}
      </div>
      
      <div className="selector-footer">
        <p className="footer-note">
          💡 後からいつでも設定で変更できます
        </p>
      </div>
    </div>
  );
}