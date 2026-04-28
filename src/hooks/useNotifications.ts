import { useState, useEffect, useCallback } from 'react';
import { saveFCMToken, onForegroundMessage, isNotificationSupported, getNotificationPermission } from '../lib/notifications';
import { useAuth } from '../contexts/AuthContext';

interface UseNotificationsReturn {
  permission: NotificationPermission | 'unsupported' | 'loading';
  token: string | null;
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  showForegroundNotification: (title: string, options?: NotificationOptions) => void;
}

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | 'loading'>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSupported = isNotificationSupported();

  // Check initial permission status
  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      setIsLoading(false);
      return;
    }

    const currentPermission = getNotificationPermission();
    setPermission(currentPermission);
  }, [isSupported]);

  // Request permission and get token when user logs in
  useEffect(() => {
    const initNotifications = async () => {
      if (!user || !isSupported) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const currentPermission = Notification.permission;
        
        if (currentPermission === 'granted') {
          const fcmToken = await saveFCMToken(user.uid);
          setToken(fcmToken);
          setPermission('granted');
        } else if (currentPermission === 'denied') {
          setPermission('denied');
          setToken(null);
        } else {
          setPermission('default');
          setToken(null);
        }
      } catch (err) {
        console.error('Error initializing notifications:', err);
        setError('Erro ao inicializar notificações');
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initNotifications();
  }, [user, isSupported]);

  // Listen for foreground messages
  useEffect(() => {
    if (!isSupported) return;

    const unsubscribe = onForegroundMessage((payload) => {
      // Show notification in foreground
      if (Notification.permission === 'granted') {
        const { title, body, data } = payload.notification || {};
        if (title) {
          new Notification(title, {
            body,
            icon: '/logo.png',
            badge: '/logo.png',
            data
          });
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user) return false;

    try {
      setIsLoading(true);
      setError(null);

      const fcmToken = await saveFCMToken(user.uid, { force: true });
      
      if (fcmToken) {
        setToken(fcmToken);
        setPermission('granted');
        return true;
      }
      
      setPermission(Notification.permission);
      return false;
    } catch (err) {
      console.error('Error requesting permission:', err);
      setError('Erro ao solicitar permissão');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported]);

  const showForegroundNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/logo.png',
        badge: '/logo.png',
        ...options
      });
    }
  }, []);

  return {
    permission,
    token,
    isSupported,
    isLoading,
    error,
    requestPermission,
    showForegroundNotification
  };
}
