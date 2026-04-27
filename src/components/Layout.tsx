import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, LogOut, Plus, X, Bell, Sun, Moon, Settings, Crown, Home, ChevronRight, User, BarChart3, ClipboardCheck, AlertTriangle, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import { ProfileModal } from './ProfileModal';
import { NotificationSettings } from './NotificationSettings';
import { isSuperAdmin, isBoss, isDiretoria } from '../lib/permissions';
import { saveFCMToken } from '../lib/notifications';
import UpdatePopup from './UpdatePopup';

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [localUser, setLocalUser] = useState(user);
  const [firestoreNotice, setFirestoreNotice] = useState<string | null>(null);

  useEffect(() => { setLocalUser(user); }, [user]);

  // Listen for event to open notification settings
  useEffect(() => {
    const handleOpenNotifications = () => setShowNotifications(true);
    window.addEventListener('openNotificationSettings', handleOpenNotifications);
    return () => window.removeEventListener('openNotificationSettings', handleOpenNotifications);
  }, []);

  useEffect(() => {
    let noticeTimeout: number | undefined;
    const handleFirestoreNotice = () => {
      if (noticeTimeout) window.clearTimeout(noticeTimeout);
      setFirestoreNotice('Alguns dados não puderam ser carregados. Verifique as regras do Firebase e tente novamente.');
      noticeTimeout = window.setTimeout(() => setFirestoreNotice(null), 7000);
    };
    window.addEventListener('firestore-error', handleFirestoreNotice);
    return () => {
      if (noticeTimeout) window.clearTimeout(noticeTimeout);
      window.removeEventListener('firestore-error', handleFirestoreNotice);
    };
  }, []);

  useEffect(() => {
    const setupNotifications = async () => {
      if (user) {
        await saveFCMToken(user.id);
      }
    };
    setupNotifications();
  }, [user]);

  // Menu base
  const baseNavigation = [
    { name: 'Início', href: '/', icon: Home },
    { name: 'Calendário', href: '/calendar', icon: Calendar },
    { name: 'Publicações', href: '/publications', icon: ClipboardCheck },
  ];

  // Menu Admin (para super admins)
  const adminNavigation = isSuperAdmin(user?.email) ? [
    { name: 'Painel Admin', href: '/admin', icon: Settings },
  ] : [];

  // Menu Privado (para o patrão e diretoria)
  const bossNavigation = (isBoss(user?.email) || isDiretoria(user)) ? [
    { name: 'Agenda Particular da Diretoria', href: '/private-dashboard', icon: Crown },
  ] : [];

  // Menu completo
  const navigation = [...baseNavigation, ...bossNavigation, ...adminNavigation];

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const handleProfileUpdate = (updates: any) => {
    setLocalUser(prev => prev ? { ...prev, ...updates } : prev);
  };

  const Avatar = ({ size = 'md', onClick }: { size?: 'sm' | 'md' | 'lg'; onClick?: () => void }) => {
    const sizes = { sm: 'w-9 h-9 text-sm', md: 'w-10 h-10 text-base', lg: 'w-12 h-12 text-xl' };
    const photoUrl = (localUser as any)?.photoUrl;
    return (
      <button
        onClick={onClick}
        className={cn(
          "rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 transition-all hover:scale-105 active:scale-95",
          sizes[size]
        )}
        style={{ background: photoUrl ? 'transparent' : 'linear-gradient(135deg,var(--accent),#ff9a0d)' }}
        title="Meu perfil"
      >
        {photoUrl
          ? <img src={photoUrl} alt="avatar" className="w-full h-full object-cover rounded-xl" />
          : (localUser?.name?.charAt(0) || 'U')
        }
      </button>
    );
  };

  const NavLink = ({ item, onClick }: { item: typeof navigation[0]; onClick?: () => void }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.href;
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={cn("nav-item", isActive && "active")}
      >
        <div className="nav-icon">
          <Icon className="w-4 h-4" />
        </div>
        {item.name}
      </Link>
    );
  };

  // Helper para obter badge de cargo
  const getRoleBadge = () => {
    if (isSuperAdmin(user?.email)) return { label: 'Admin', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' };
    if (isBoss(user?.email)) return { label: 'Proprietário', color: 'var(--accent)', bg: 'rgba(255,111,15,0.15)' };
    if (isDiretoria(user)) return { label: 'Diretoria', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' };
    const roleLabels: Record<string, string> = {
      juridico: 'Jurídico',
      comunicacao: 'Comunicação',
      fiscalizacao: 'Fiscalização',
      administrativo: 'Administrativo',
    };
    return { label: roleLabels[user?.role || ''] || user?.role || 'Usuário', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' };
  };

  const roleBadge = getRoleBadge();
  const canViewReports = isSuperAdmin(user?.email) || isBoss(user?.email) || isDiretoria(user);
  const openReport = () => {
    if (location.pathname === '/') {
      window.dispatchEvent(new CustomEvent('open-report'));
      return;
    }

    navigate('/', { state: { openReport: true } });
  };

  return (
    <>
      <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {firestoreNotice && (
          <div
            className="fixed top-4 left-4 right-4 lg:left-auto lg:right-6 lg:max-w-md z-[70] p-4 rounded-xl shadow-2xl flex items-start gap-3"
            style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.28)', color: 'var(--text-secondary)' }}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <p className="text-sm font-medium">{firestoreNotice}</p>
          </div>
        )}

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] flex flex-col shadow-2xl animate-slide-in" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}>
              {/* Header com logo */}
              <div className="flex items-center justify-between h-16 px-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <Link to="/" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
                  <img src="/logo.png" alt="SindPetShop-SP" className="h-8 w-auto" />
                  <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>Agenda Sind</span>
                </Link>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Menu de navegação */}
              <nav className="flex-1 px-4 py-6 space-y-1">
                {navigation.map(item => <NavLink key={item.name} item={item} onClick={() => setIsMobileMenuOpen(false)} />)}
              </nav>

              {/* Seção do usuário */}
              <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {/* Card do usuário */}
                <div
                  className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all hover:opacity-80 active:scale-[0.98]"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                  onClick={() => { setIsMobileMenuOpen(false); setShowProfile(true); }}
                >
                  <Avatar size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{localUser?.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                        style={{ background: roleBadge.bg, color: roleBadge.color }}
                      >
                        {roleBadge.label}
                      </span>
                    </div>
                    <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{localUser?.email}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                </div>

                {/* Botão de logout */}
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-red-500/10"
                  style={{ color: '#ef4444' }}
                >
                  <LogOut className="mr-3 w-5 h-5" />
                  Sair da conta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex flex-col w-64 h-screen sticky top-0" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}>
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 h-16 px-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <img src="/logo.png" alt="SindPetShop-SP" className="h-8 w-auto" />
              <div>
                <span className="block text-base font-bold tracking-tight" style={{ color: 'var(--accent)' }}>Agenda Sind</span>
                <span className="block text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>SindPetShop-SP</span>
              </div>
            </Link>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <div className="mb-2 px-3">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Menu</span>
              </div>
              {navigation.map(item => <NavLink key={item.name} item={item} />)}
            </div>

            {/* User Section */}
            <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {/* Botão Relatório - visível apenas para Admin/Diretoria */}
              {canViewReports && (
                <button
                  onClick={openReport}
                  className="flex items-center w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <BarChart3 className="mr-2 w-4 h-4" />
                  Relatório
                </button>
              )}

              <div
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:opacity-80"
                style={{ background: 'var(--bg-card)' }}
                onClick={() => setShowProfile(true)}
              >
                <Avatar size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{localUser?.name}</p>
                  <span
                    className="text-xs font-medium"
                    style={{ color: roleBadge.color }}
                  >
                    {roleBadge.label}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-red-500/10"
                style={{ color: '#ef4444' }}
              >
                <LogOut className="mr-2 w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Mobile Header - Melhorado */}
          <header className="glass-nav sticky top-0 z-30 flex items-center h-16 px-2 gap-2 lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              title="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 flex-shrink-0"
            >
              <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
              <span className="text-base font-bold" style={{ color: 'var(--accent)' }}>Agenda</span>
            </Link>

            {/* Spacer */}
            <div className="flex-1" />

            {canViewReports && (
              <button
                onClick={openReport}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--accent)' }}
                title="Relatório"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 flex-shrink-0"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </header>

          {/* Desktop Header */}
          <header className="hidden lg:flex items-center h-14 px-6 gap-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <div className="flex-1" />

            {/* Notification Settings Button */}
            <button
              onClick={() => setShowNotifications(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 relative"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--accent)' }}
              title="Configurações de Notificação"
            >
              <Bell className="w-4 h-4" />
            </button>

            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Avatar size="sm" onClick={() => setShowProfile(true)} />
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              <Outlet />
            </div>
          </main>

          {/* Mobile Bottom Navigation with Create Button */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-2 pb-2 safe-area-bottom" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between py-2 px-1">
              {/* Início */}
              <Link
                to="/"
                className={cn(
                  "mobile-tab flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all min-w-[60px] min-h-[60px] touch-target",
                  location.pathname === '/' ? "active text-[var(--accent)]" : "text-[var(--text-muted)]"
                )}
              >
                <Home className="w-6 h-6" />
                <span className="text-[10px] font-medium">Início</span>
              </Link>

              {/* Calendário */}
              <Link
                to="/calendar"
                className={cn(
                  "mobile-tab flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all min-w-[60px] min-h-[60px] touch-target",
                  location.pathname === '/calendar' ? "active text-[var(--accent)]" : "text-[var(--text-muted)]"
                )}
              >
                <Calendar className="w-6 h-6" />
                <span className="text-[10px] font-medium">Calendário</span>
              </Link>

              {/* Botão Central de Criar Evento - Maior e mais visível */}
              <Link
                to="/events/create"
                className="flex flex-col items-center justify-center w-16 h-16 -mt-8 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 mobile-create-btn"
                style={{ background: 'linear-gradient(135deg, var(--accent), #ff9a0d)', boxShadow: '0 4px 24px rgba(255,111,15,0.5)' }}
              >
                <Plus className="w-8 h-8 text-white" strokeWidth={2.5} />
              </Link>

              {/* Publicações */}
              <Link
                to="/publications"
                className={cn(
                  "mobile-tab flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all min-w-[60px] min-h-[60px] touch-target",
                  location.pathname === '/publications' ? "active text-[var(--accent)]" : "text-[var(--text-muted)]"
                )}
              >
                <ClipboardCheck className="w-6 h-6" />
                <span className="text-[10px] font-medium">Public.</span>
              </Link>

              {/* Perfil */}
              <button
                onClick={() => setShowProfile(true)}
                className="mobile-tab flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all min-w-[60px] min-h-[60px] touch-target"
              >
                <User className="w-6 h-6" />
                <span className="text-[10px] font-medium text-[var(--text-muted)]">Perfil</span>
              </button>
            </div>
          </nav>

          {/* Spacer for mobile bottom nav */}
          <div className="lg:hidden h-16" />
        </div>
      </div>

      {/* Profile Modal */}
      {showProfile && localUser && (
        <ProfileModal
          user={localUser}
          onClose={() => setShowProfile(false)}
          onUpdate={handleProfileUpdate}
        />
      )}

      {/* Notification Settings Modal */}
      <NotificationSettings
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {/* Pop-up de Novas Atualizações */}
      <UpdatePopup />
    </>
  );
}
