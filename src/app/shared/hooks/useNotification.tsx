import React, { createContext, useContext, useCallback, useState, useRef } from 'react';
import { X } from 'lucide-react';
import ReactDOM from 'react-dom';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
}

// 通知コンポーネントのスタイル
const notificationStyles: Record<NotificationType, React.CSSProperties> = {
  success: {
    backgroundColor: '#4CAF50',
    color: 'white',
  },
  error: {
    backgroundColor: '#f44336',
    color: 'white',
  },
  warning: {
    backgroundColor: '#FF9800',
    color: 'white',
  },
  info: {
    backgroundColor: '#2196F3',
    color: 'white',
  },
};

const NotificationItem: React.FC<{ notification: Notification; onRemove: () => void }> = ({ notification, onRemove }) => {
  const baseStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: '4px',
    marginBottom: '8px',
    minWidth: '300px',
    maxWidth: '500px',
    boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    animation: 'slideIn 0.3s ease-out',
    cursor: 'pointer',
    ...notificationStyles[notification.type],
  };

  return (
    <div style={baseStyle} onClick={onRemove}>
      <span>{notification.message}</span>
      <span style={{ marginLeft: '16px', fontSize: '18px' }}><X size={18} /></span>
    </div>
  );
};

const NotificationContainer: React.FC<{ notifications: Notification[]; onRemove: (id: string) => void }> = ({ notifications, onRemove }) => {
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 9999,
  };

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  return ReactDOM.createPortal(
    <div style={containerStyle}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={() => onRemove(notification.id)}
        />
      ))}
    </div>,
    document.body
  );
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }
  }, []);

  const showNotification = useCallback((type: NotificationType, message: string, duration: number = 5000) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const notification: Notification = {
      id,
      type,
      message,
      duration,
    };

    setNotifications((prev) => [...prev, notification]);

    if (duration > 0) {
      timeoutRefs.current[id] = setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};