import React, { Component, ErrorInfo, ReactNode } from 'react';

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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-red-100">
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Ops! Algo deu errado.
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Ocorreu um erro inesperado no sistema.
              </p>
            </div>
            
            {errorDetails ? (
              <div className="mt-4 bg-red-50 p-4 rounded-md border border-red-200 text-sm text-red-800 overflow-auto">
                <p className="font-bold mb-2">Erro de Permissão (Firestore)</p>
                <p><strong>Operação:</strong> {errorDetails.operationType}</p>
                <p><strong>Caminho:</strong> {errorDetails.path}</p>
                <p className="mt-2 text-xs font-mono">{errorDetails.error}</p>
              </div>
            ) : (
              <div className="mt-4 bg-red-50 p-4 rounded-md border border-red-200 text-sm text-red-800 overflow-auto">
                <p className="font-mono text-xs">{this.state.error?.message || 'Erro desconhecido'}</p>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => window.location.reload()}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#ff6f0f] hover:bg-[#e6600c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6f0f]"
              >
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
