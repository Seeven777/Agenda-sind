import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { BarChart3, CalendarCheck, ClipboardCheck, ShieldCheck } from 'lucide-react';
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
    const from = (location.state as any)?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  const pillars = [
    { icon: CalendarCheck, label: 'Agenda', value: 'Compromissos e rotas' },
    { icon: ClipboardCheck, label: 'Aprovação', value: 'Publicações e revisões' },
    { icon: BarChart3, label: 'Gestão', value: 'Relatórios para diretoria' },
  ];

  return (
    <div className="login-shell min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl animate-fade-in">
        <div className="login-card rounded-[24px] overflow-hidden grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="login-side-panel p-7 sm:p-10 lg:p-12 flex flex-col justify-between gap-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-6" style={{ background: 'rgba(255,111,15,0.14)', color: 'var(--accent)' }}>
                <ShieldCheck className="w-4 h-4" />
                Ambiente institucional
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>
                Agenda Sind
              </h1>
              <p className="mt-4 text-base sm:text-lg max-w-xl leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Um centro de comando para agenda, comunicação e acompanhamento das entregas do SindPetShop-SP.
              </p>
            </div>

            <div className="grid gap-3">
              {pillars.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-4 p-4 rounded-2xl metric-tile">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="p-7 sm:p-10 lg:p-12 flex items-center">
            <div className="w-full max-w-md mx-auto">
              <div className="flex flex-col items-center text-center mb-9">
                <img src="/logo.png" alt="SindPetShop-SP" className="h-20 w-auto mb-6" />
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Acesse sua operação
                </h2>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Use sua conta autorizada para continuar.
                </p>
              </div>

              <button
                onClick={login}
                className="btn-premium w-full flex items-center justify-center gap-3 text-base min-h-[56px]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="rgba(255,255,255,0.8)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="rgba(255,255,255,0.6)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
              </button>

              <div className="mt-6 p-4 rounded-2xl text-center" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Acesso restrito a membros autorizados. As informações exibidas são organizadas por perfil e permissão.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
