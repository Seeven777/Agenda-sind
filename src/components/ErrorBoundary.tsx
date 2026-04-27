import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorDetails = null;
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.operationType) {
            errorDetails = parsed;
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="login-shell min-h-screen flex items-center justify-center py-10 px-4">
          <div className="login-card w-full max-w-xl rounded-[24px] p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Algo saiu do fluxo
                </h1>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  O app encontrou uma falha inesperada. Você pode recarregar a página ou voltar para o início.
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-2xl max-h-56 overflow-auto" style={{ background: 'var(--bg-input)', border: '1px solid rgba(239,68,68,0.22)' }}>
              {errorDetails ? (
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p className="font-black mb-2" style={{ color: '#ef4444' }}>Erro de permissão no Firebase</p>
                  <p><strong>Operação:</strong> {errorDetails.operationType}</p>
                  <p><strong>Caminho:</strong> {errorDetails.path}</p>
                  <p className="mt-3 text-xs font-mono break-words" style={{ color: 'var(--text-muted)' }}>{errorDetails.error}</p>
                </div>
              ) : (
                <p className="text-xs font-mono break-words" style={{ color: 'var(--text-muted)' }}>
                  {this.state.error?.message || 'Erro desconhecido'}
                </p>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => window.location.reload()}
                className="btn-premium min-h-[52px]"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="min-h-[52px] rounded-xl font-bold flex items-center justify-center gap-2"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                <Home className="w-4 h-4" />
                Ir para início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
