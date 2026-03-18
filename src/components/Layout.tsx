import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, LayoutDashboard, LogOut, Menu, Plus, X, Bell, Search, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import { requestNotificationPermission, db, setupForegroundNotifications } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ProfileModal } from './ProfileModal';

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  const [localUser, setLocalUser] = useState(user);

  const searchInputRef = useRef<HTMLInputElement>(null);

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
        // Setup foreground notifications
        setupForegroundNotifications();
      }
    };
    setupNotifications();
  }, [user]);

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Calendário', href: '/calendar', icon: Calendar },
    { name: 'Novo Evento', href: '/events/create', icon: Plus },
  ];

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const handleProfileUpdate = (updates: any) => {
    setLocalUser(prev => prev ? { ...prev, ...updates } : prev);
  };

  const Avatar = ({ size = 'md', onClick }: { size?: 'sm' | 'md' | 'lg'; onClick?: () => void }) => {
    const sizes = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-12 h-12 text-xl' };
    const photoUrl = (localUser as any)?.photoUrl;
    return (
      <button
        onClick={onClick}
        className={cn("rounded-full flex items-center justify-center font-black text-white flex-shrink-0 overflow-hidden transition-all hover:ring-2 hover:ring-[var(--accent)] hover:ring-offset-2 hover:ring-offset-[var(--bg-secondary)]", sizes[size])}
        style={{ background: photoUrl ? 'transparent' : 'linear-gradient(135deg,var(--accent),#ff9a0d)' }}
        title="Editar perfil"
      >
        {photoUrl
          ? <img src={photoUrl} alt="avatar" className="w-full h-full object-cover" />
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
        className={cn(
          "flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all group",
          isActive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
        )}
      >
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center mr-3 transition-all",
          isActive ? "bg-[var(--accent)] shadow-[0_4px_14px_var(--accent-glow)]" : "bg-white/5 group-hover:bg-white/10"
        )}>
          <Icon className={cn("w-4 h-4", isActive ? "text-white" : "")} />
        </div>
        {item.name}
        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
      </Link>
    );
  };

  return (
    <>
      <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-72 flex flex-col shadow-2xl" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between h-16 px-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <Link to="/" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
                  <img src="/logo.png" alt="SindPetShop-SP" className="h-8 w-auto" />
                  <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>Agenda Sind</span>
                </Link>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-1">
                {navigation.map(item => <NavLink key={item.name} item={item} onClick={() => setIsMobileMenuOpen(false)} />)}
              </nav>
              <div className="p-4 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:opacity-80 transition-opacity" style={{ background: 'var(--bg-card)' }} onClick={() => { setIsMobileMenuOpen(false); setShowProfile(true); }}>
                  <Avatar size="md" />
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{localUser?.name}</p>
                    <p className="text-xs uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>{localUser?.role}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="flex items-center w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-red-500/10" style={{ color: '#ef4444' }}>
                  <LogOut className="mr-3 w-4 h-4" />Sair
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex flex-col w-72 h-screen sticky top-0" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}>
            <Link to="/" className="flex items-center gap-3 h-20 px-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <img src="/logo.png" alt="SindPetShop-SP" className="h-9 w-auto" />
              <div>
                <span className="block text-lg font-extrabold tracking-tight" style={{ color: 'var(--accent)' }}>Agenda Sind</span>
                <span className="block text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>SindPetShop-SP</span>
              </div>
            </Link>
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
              {navigation.map(item => <NavLink key={item.name} item={item} />)}
            </div>
            <div className="p-4 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:opacity-80 transition-opacity" style={{ background: 'var(--bg-card)' }} onClick={() => setShowProfile(true)}>
                <Avatar size="md" />
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{localUser?.name}</p>
                  <p className="text-xs uppercase tracking-widest truncate" style={{ color: 'var(--text-muted)' }}>{localUser?.role}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Editar</span>
              </div>
              <button onClick={handleLogout} className="flex items-center w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-red-500/10" style={{ color: '#ef4444' }}>
                <LogOut className="mr-3 w-4 h-4" />Sair
              </button>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <header className="glass-nav sticky top-0 z-30 flex items-center h-16 px-4 gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-xl transition-colors" style={{ color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <Link to="/" className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="h-7 w-auto" />
                <span className="font-bold" style={{ color: 'var(--accent)' }}>Agenda Sind</span>
              </Link>
            </div>
            <div className="flex-1" />

            {/* Search */}
            <div
              className={cn("flex items-center rounded-xl transition-all duration-300 overflow-hidden", isSearchExpanded ? "w-56 sm:w-72 px-3" : "w-10 h-10 justify-center")}
              style={{ background: 'var(--bg-card)', border: isSearchExpanded ? '1px solid var(--accent)' : '1px solid var(--border-subtle)' }}
            >
              <button onClick={() => setIsSearchExpanded(!isSearchExpanded)} className={cn("p-1 transition-colors flex-shrink-0", isSearchExpanded ? "mr-2" : "")} style={{ color: isSearchExpanded ? 'var(--accent)' : 'var(--text-muted)' }}>
                <Search className="w-4 h-4" />
              </button>
              {isSearchExpanded && (
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar evento..."
                  className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onBlur={() => !searchTerm && setIsSearchExpanded(false)}
                />
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Bell */}
            <button className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              <Bell className="w-4 h-4" />
            </button>

            {/* Avatar (desktop header) */}
            <div className="hidden lg:block">
              <Avatar size="sm" onClick={() => setShowProfile(true)} />
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              <Outlet context={{ searchTerm }} />
            </div>
          </main>

          {/* Mobile FAB */}
          <Link to="/events/create" className="fab lg:hidden fixed bottom-6 left-6 z-40">
            <Plus className="w-7 h-7 text-white" />
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
