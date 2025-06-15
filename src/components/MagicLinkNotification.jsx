import React, { useState, useEffect } from 'react';

const MagicLinkNotification = ({ isVisible, onClose, magicLink }) => {
  const [copied, setCopied] = useState(false);
  
  console.log('MagicLinkNotification props:', { isVisible, magicLink }); // デバッグログ

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const openInNewTab = () => {
    window.open(magicLink, '_blank');
  };

  if (!isVisible || !magicLink) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '90vw',
        textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px'
        }}>
          🔗
        </div>
        
        <h2 style={{ 
          color: '#333', 
          marginBottom: '15px',
          fontSize: '24px'
        }}>
          Magic Link を生成しました
        </h2>
        
        <p style={{
          color: '#666',
          fontSize: '16px',
          lineHeight: '1.5',
          marginBottom: '25px'
        }}>
          本番環境ではメールが送信されますが、<br/>
          現在はテスト環境のためリンクを直接表示しています。
        </p>

        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '25px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#666',
            marginBottom: '8px'
          }}>
            Magic Link:
          </div>
          <div style={{
            fontSize: '14px',
            color: '#333',
            wordBreak: 'break-all',
            lineHeight: '1.4',
            fontFamily: 'monospace'
          }}>
            {magicLink}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <button
            onClick={openInNewTab}
            style={{
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 24px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#5a6fd8'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#667eea'}
          >
            🚀 今すぐログイン
          </button>
          
          <button
            onClick={copyToClipboard}
            style={{
              backgroundColor: copied ? '#28a745' : 'white',
              color: copied ? 'white' : '#667eea',
              border: '1px solid #667eea',
              borderRadius: '6px',
              padding: '12px 24px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            {copied ? '✅ コピー済み' : '📋 コピー'}
          </button>
        </div>

        <div style={{
          backgroundColor: '#fff3cd',
          color: '#856404',
          padding: '12px',
          borderRadius: '6px',
          fontSize: '13px',
          marginBottom: '20px',
          border: '1px solid #ffeaa7'
        }}>
          ⚠️ このリンクは10分間有効です
        </div>

        <button
          onClick={onClose}
          style={{
            backgroundColor: 'transparent',
            color: '#999',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
};

export default MagicLinkNotification;