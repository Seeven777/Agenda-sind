import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const { user, login, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-12 h-12 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user) {
    const from = (location.state as any)?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--bg-primary)' }}>
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,111,15,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="glass-card p-8 sm:p-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full blur-xl opacity-60" style={{ background: 'var(--accent-glow)' }} />
              <img src="/logo.png" alt="SindPetShop-SP" className="relative h-20 w-auto" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Agenda Sind</h1>
            <p className="mt-2 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Sistema de Agendamento Institucional do SindPetShop-SP</p>
          </div>

          {/* Stats bubbles */}
          <div className="flex justify-center gap-4 mb-10">
            {['Reuniões', 'Processos', 'Visitas'].map((label) => (
              <div key={label} className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={login}
            className="btn-premium w-full flex items-center justify-center gap-3 text-base"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="rgba(255,255,255,0.8)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="rgba(255,255,255,0.6)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Entrar com Google
          </button>

          <p className="mt-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Área restrita a membros autorizados do SindPetShop-SP
          </p>
        </div>
      </div>
    </div>
  );
}
