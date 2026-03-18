import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, LayoutDashboard, LogOut, Menu, Plus, X, Bell, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { requestNotificationPermission, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const setupNotifications = async () => {
      if (user) {
        const token = await requestNotificationPermission();
        if (token) {
          try {
            await updateDoc(doc(db, 'users', user.id), {
              fcmToken: token
            });
          } catch (error) {
            console.error('Error updating FCM token', error);
          }
        }
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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile menu */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", isMobileMenuOpen ? "block" : "hidden")}>
        <div className="fixed inset-0 bg-gray-900/80" onClick={() => setIsMobileMenuOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <Link to="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
              <img src="/logo.png" alt="SindPetShop-SP" className="h-8 w-auto" />
              <span className="text-xl font-bold text-[#ff6f0f]">Agenda Sind</span>
            </Link>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md text-sm font-medium",
                    isActive ? "bg-[#ff6f0f]/10 text-[#ff6f0f]" : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon className={cn("mr-3 w-5 h-5", isActive ? "text-[#ff6f0f]" : "text-gray-400")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-[#ff6f0f] text-white flex items-center justify-center font-bold">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50"
            >
              <LogOut className="mr-3 w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 border-r border-gray-200 bg-white shadow-sm z-20">
          <Link to="/" className="flex items-center justify-center h-16 border-b border-gray-200 gap-2 hover:bg-gray-50 transition-colors">
            <img src="/logo.png" alt="SindPetShop-SP" className="h-8 w-auto" />
            <span className="text-2xl font-bold text-[#ff6f0f]">Agenda Sind</span>
          </Link>
          <div className="flex flex-col flex-1 overflow-y-auto">
            <nav className="flex-1 px-4 py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive ? "bg-[#ff6f0f]/10 text-[#ff6f0f]" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className={cn("mr-3 w-5 h-5", isActive ? "text-[#ff6f0f]" : "text-gray-400")} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-[#ff6f0f] text-white flex items-center justify-center font-bold shadow-sm">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest truncate">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              <LogOut className="mr-3 w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <div className="relative z-10 flex flex-shrink-0 h-16 bg-white border-b border-gray-200 shadow-sm glass-nav">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="px-4 text-gray-500 border-r border-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#ff6f0f] lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center justify-between flex-1 px-4">
            <div className="flex items-center gap-2 lg:hidden">
              <Link to="/" className="flex items-center gap-2">
                <img src="/logo.png" alt="SindPetShop-SP" className="h-8 w-auto" />
                <span className="text-xl font-bold text-[#ff6f0f]">Agenda Sind</span>
              </Link>
            </div>
            <div className="hidden lg:block">
              {/* Spacer */}
            </div>
            <div className="flex items-center gap-2">
              {/* Search Button & Input */}
              <div className={cn(
                "flex items-center transition-all duration-300 overflow-hidden rounded-full bg-gray-100",
                isSearchExpanded ? "w-48 sm:w-64 px-3 py-1 mr-2" : "w-10 h-10 justify-center mr-2"
              )}>
                <button 
                  onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                  className={cn("p-1 text-gray-400 hover:text-[#ff6f0f] transition-colors", isSearchExpanded ? "mr-1" : "")}
                >
                  <Search className="w-5 h-5" />
                </button>
                {isSearchExpanded && (
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar..."
                    className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onBlur={() => !searchTerm && setIsSearchExpanded(false)}
                  />
                )}
              </div>
              
              <button className="p-2 text-gray-400 hover:text-[#ff6f0f] transition-colors bg-gray-100 rounded-full">
                <Bell className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none bg-gray-50">
          <div className="py-6 sm:py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet context={{ searchTerm }} />
            </div>
          </div>
        </main>

        {/* Mobile Floating Action Button (FAB) - Bottom Left */}
        <Link
          to="/events/create"
          className="lg:hidden fixed bottom-6 left-6 w-14 h-14 bg-[#ff6f0f] text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-[#e6600c] transition-all transform hover:scale-110 z-40"
        >
          <Plus className="w-8 h-8" />
        </Link>
      </div>
    </div>
  );
}
