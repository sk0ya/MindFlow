/**
 * 共通モーダルスタイル定数
 */

// モーダルオーバーレイ
export const modalOverlay = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

// モーダルコンテナ
export const modalContainer = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '32px',
  maxWidth: '400px',
  width: '90%',
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

// ヘッダー関連
export const modalHeader = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: '24px',
};

export const modalIcon = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  backgroundColor: '#f3f4f6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: '12px',
};

export const modalTitle = {
  margin: 0,
  fontSize: '20px',
  fontWeight: '600',
  color: '#1f2937',
};

export const modalCloseButton = {
  position: 'absolute' as const,
  top: '16px',
  right: '16px',
  background: 'none',
  border: 'none',
  fontSize: '24px',
  cursor: 'pointer',
  color: '#6b7280',
  lineHeight: 1,
};

// フォーム関連
export const formGroup = {
  marginBottom: '16px',
};

export const formLabel = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '14px',
  fontWeight: '500',
  color: '#374151',
};

export const formInput = {
  width: '100%',
  padding: '12px',
  border: '2px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s',
};

export const formInputFocus = {
  borderColor: '#3b82f6',
};

export const inputWithIcon = {
  position: 'relative' as const,
};

export const inputIcon = {
  position: 'absolute' as const,
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '16px',
  color: '#6b7280',
};

// ボタン関連
export const buttonGroup = {
  display: 'flex',
  gap: '12px',
  marginBottom: '16px',
};

export const primaryButton = {
  flex: 1,
  padding: '12px 24px',
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
};

export const primaryButtonHover = {
  backgroundColor: '#2563eb',
};

export const primaryButtonDisabled = {
  backgroundColor: '#9ca3af',
  cursor: 'not-allowed',
};

export const secondaryButton = {
  flex: 1,
  padding: '12px 24px',
  backgroundColor: 'white',
  color: '#374151',
  border: '2px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'border-color 0.2s, background-color 0.2s',
};

export const secondaryButtonHover = {
  backgroundColor: '#f9fafb',
  borderColor: '#9ca3af',
};

// リンクボタン
export const linkButton = {
  background: 'none',
  border: 'none',
  color: '#3b82f6',
  textDecoration: 'underline',
  cursor: 'pointer',
  fontSize: '14px',
};

// メッセージ表示
export const errorMessage = {
  color: '#ef4444',
  fontSize: '14px',
  textAlign: 'center' as const,
  marginTop: '8px',
};

export const successMessage = {
  color: '#10b981',
  fontSize: '14px',
  textAlign: 'center' as const,
  marginTop: '8px',
};

// ユーティリティ
export const textCenter = {
  textAlign: 'center' as const,
};

export const flexCenter = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};