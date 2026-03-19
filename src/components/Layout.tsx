import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, LayoutDashboard, LogOut, Menu, Plus, X, Bell, Search, Sun, Moon, Settings, Crown, Home, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import { requestNotificationPermission, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ProfileModal } from './ProfileModal';
import { isSuperAdmin, isBoss, isDiretoria } from '../lib/permissions';

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [localUser, setLocalUser] = useState(user);

  useEffect(() => { setLocalUser(user); }, [user]);

  useEffect(() => {
    const setupNotifications = async () => {
      if (user) {
        const token = await requestNotificationPermission();
        if (token) {
          try {
            await updateDoc(doc(db, 'users', user.id), { fcmToken: token });
          } catch (error) {
            console.error('Error updating FCM token', error);
          }
        }
      }
    };
    setupNotifications();
  }, [user]);

  // Menu base
  const baseNavigation = [
    { name: 'Início', href: '/', icon: Home },
    { name: 'Calendário', href: '/calendar', icon: Calendar },
  ];

  // Menu Admin (para super admins)
  const adminNavigation = isSuperAdmin(user?.email) ? [
    { name: 'Painel Admin', href: '/admin', icon: Settings },
  ] : [];

  // Menu Privado (para o patrão e diretoria)
  const bossNavigation = (isBoss(user?.email) || isDiretoria(user)) ? [
    { name: 'Minha Agenda', href: '/private-dashboard', icon: Crown },
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

  return (
    <>
      <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-72 flex flex-col shadow-2xl animate-slide-in" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between h-16 px-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <Link to="/" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
                  <img src="/logo.png" alt="SindPetShop-SP" className="h-8 w-auto" />
                  <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>Agenda Sind</span>
                </Link>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-1">
                {navigation.map(item => <NavLink key={item.name} item={item} onClick={() => setIsMobileMenuOpen(false)} />)}
              </nav>
              <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div 
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:opacity-80" 
                  style={{ background: 'var(--bg-card)' }} 
                  onClick={() => { setIsMobileMenuOpen(false); setShowProfile(true); }}
                >
                  <Avatar size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{localUser?.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{localUser?.role}</p>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </div>
                <button 
                  onClick={handleLogout} 
                  className="flex items-center w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-red-500/10" 
                  style={{ color: '#ef4444' }}
                >
                  <LogOut className="mr-3 w-4 h-4" />
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
            <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div 
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:opacity-80" 
                style={{ background: 'var(--bg-card)' }} 
                onClick={() => setShowProfile(true)}
              >
                <Avatar size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{localUser?.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{localUser?.role}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout} 
                className="flex items-center w-full mt-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-red-500/10" 
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
          {/* Header */}
          <header className="glass-nav sticky top-0 z-30 flex items-center h-14 px-4 gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="lg:hidden p-2 rounded-lg transition-colors" 
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 lg:hidden">
              <Link to="/" className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="h-6 w-auto" />
                <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>Agenda Sind</span>
              </Link>
            </div>
            
            <div className="flex-1" />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Avatar (desktop) */}
            <div className="hidden lg:block">
              <Avatar size="sm" onClick={() => setShowProfile(true)} />
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              <Outlet />
            </div>
          </main>

          {/* Mobile FAB */}
          <Link to="/events/create" className="fab lg:hidden fixed bottom-6 left-6 z-40">
            <Plus className="w-6 h-6 text-white" />
          </Link>
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
    </>
  );
}
