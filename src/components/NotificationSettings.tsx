import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X, Check, Settings, Smartphone, Monitor } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../contexts/AuthContext';

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationSettings({ isOpen, onClose }: NotificationSettingsProps) {
  const { user } = useAuth();
  const { 
    permission, 
    token, 
    isSupported, 
    isLoading, 
    error, 
    requestPermission 
  } = useNotifications();
  
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (permission === 'granted' && !showSuccess) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [permission, showSuccess]);

  if (!isOpen) return null;

  const handleEnableNotifications = async () => {
    const success = await requestPermission();
    if (success) {
      setShowSuccess(true);
    }
  };

  const getStatusDisplay = () => {
    if (!isSupported) {
      return {
        icon: <BellOff className="w-8 h-8 text-gray-400" />,
        title: 'Notificações não suportadas',
        description: 'Seu navegador não suporta notificações push.',
        color: 'gray'
      };
    }
    
    switch (permission) {
      case 'granted':
        return {
          icon: <Bell className="w-8 h-8 text-green-500" />,
          title: 'Notificações ativadas',
          description: token 
            ? 'Você receberá lembretes 24h e 1h antes dos eventos.' 
            : 'Token não disponível. Tente novamente.',
          color: 'green'
        };
      case 'denied':
        return {
          icon: <BellOff className="w-8 h-8 text-red-500" />,
          title: 'Notificações bloqueadas',
          description: 'Desbloqueie as notificações nas configurações do navegador para receber lembretes.',
          color: 'red'
        };
      case 'default':
        return {
          icon: <Bell className="w-8 h-8 text-yellow-500" />,
          title: 'Notificações não ativadas',
          description: 'Clique abaixo para permitir notificações e receber lembretes dos eventos.',
          color: 'yellow'
        };
      case 'loading':
        return {
          icon: <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />,
          title: 'Verificando...',
          description: 'Aguarde um momento.',
          color: 'orange'
        };
      default:
        return {
          icon: <BellOff className="w-8 h-8 text-gray-400" />,
          title: 'Status desconhecido',
          description: 'Não foi possível verificar o status das notificações.',
          color: 'gray'
        };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Configurações de Notificação
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-6">
          {/* Status Icon */}
          <div className="flex justify-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center bg-${status.color}-100 dark:bg-${status.color}-900/20`}>
              {status.icon}
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {status.title}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {status.description}
            </p>
          </div>

          {/* Success Message */}
          {showSuccess && permission === 'granted' && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-100 dark:bg-green-900/30">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Notificações ativadas com sucesso!
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-100 dark:bg-red-900/30">
              <X className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                {error}
              </span>
            </div>
          )}

          {/* How it works */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
            <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">
              Como funciona:
            </h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>No celular, você recebe notificações push mesmo com o app fechado</span>
              </li>
              <li className="flex items-start gap-2">
                <Monitor className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>No computador, as notificações aparecem mesmo com o navegador aberto</span>
              </li>
              <li className="flex items-start gap-2">
                <Bell className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Você é notificado 24h e 1h antes dos eventos criados</span>
              </li>
            </ul>
          </div>

          {/* Action Button */}
          {permission !== 'granted' && permission !== 'denied' && (
            <button
              onClick={handleEnableNotifications}
              disabled={isLoading || !isSupported}
              className="w-full py-4 rounded-xl font-semibold transition-all active:scale-98 btn-premium disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Ativando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Bell className="w-5 h-5" />
                  Ativar Notificações
                </span>
              )}
            </button>
          )}

          {permission === 'denied' && (
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Para desbloquear, vá em:
              </p>
              <p className="text-xs mt-1 font-mono text-gray-500 dark:text-gray-400">
                Configurações do Site → Notificações → Permitir
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Component to show notification status in the app
export function NotificationStatusBadge() {
  const { permission, isSupported } = useNotifications();
  
  if (!isSupported || permission === 'denied' || permission === 'granted') {
    return null;
  }

  if (permission === 'default' || permission === 'loading') {
    return (
      <div 
        className="fixed bottom-20 right-4 z-40 p-4 rounded-xl shadow-lg cursor-pointer animate-pulse"
        style={{ 
          background: 'var(--accent)',
          color: 'white',
          maxWidth: '300px'
        }}
        onClick={() => {
          // Dispatch event to open notification settings
          window.dispatchEvent(new CustomEvent('openNotificationSettings'));
        }}
      >
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Ative as notificações para não perder nenhum evento!
          </p>
        </div>
      </div>
    );
  }

  return null;
}
