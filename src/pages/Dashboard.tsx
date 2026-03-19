import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { EventCard } from '../components/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { isBoss, isDiretoria, canSeePersonalEvents } from '../lib/permissions';
import { Plus, Briefcase, Map, Users, Calendar as CalendarIcon, Activity, TrendingUp, X, Navigation2, Lock } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';

export function Dashboard() {
  const { user } = useAuth();
  const { searchTerm } = useOutletContext<{ searchTerm: string }>();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [allActiveEvents, setAllActiveEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeMetricLabel, setActiveMetricLabel] = useState<string | null>(null);
  const filteredSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const todayQuery = query(collection(db, 'events'), where('date', '==', todayStr), orderBy('time', 'asc'));
    const upcomingQuery = query(collection(db, 'events'), where('date', '>', todayStr), orderBy('date', 'asc'), orderBy('time', 'asc'), limit(10));
    const activeQuery = query(collection(db, 'events'), where('status', '==', 'agendado'));

    const u1 = onSnapshot(todayQuery, (s) => setTodayEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))), (e) => handleFirestoreError(e, OperationType.LIST, 'events'));
    const u2 = onSnapshot(upcomingQuery, (s) => setUpcomingEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))), (e) => handleFirestoreError(e, OperationType.LIST, 'events'));
    const u3 = onSnapshot(activeQuery, (s) => { setAllActiveEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))); setLoading(false); }, (e) => handleFirestoreError(e, OperationType.LIST, 'events'));

    return () => { u1(); u2(); u3(); };
  }, [user]);

  const reunioes = allActiveEvents.filter(e => e.category === 'reuniao').length;
  const processos = allActiveEvents.filter(e => e.category === 'processo').length;
  const visitas = allActiveEvents.filter(e => e.category === 'visita').length;
  const outros = allActiveEvents.length - reunioes - processos - visitas;
  const total = allActiveEvents.length || 1;

  const chartData = [
    { label: 'Reuniões', value: reunioes, color: '#3b82f6', icon: Users, categoryKey: 'reuniao' },
    { label: 'Processos', value: processos, color: '#ef4444', icon: Briefcase, categoryKey: 'processo' },
    { label: 'Visitas', value: visitas, color: '#22c55e', icon: Map, categoryKey: 'visita' },
    { label: 'Outros', value: outros, color: '#a855f7', icon: Activity, categoryKey: 'outro' },
  ];

  const handleMetricClick = (item: typeof chartData[0]) => {
    if (activeMetricLabel === item.label) {
      setActiveMetricLabel(null);
      setFilterCategory('all');
      return;
    }
    setActiveMetricLabel(item.label);
    setFilterCategory(item.categoryKey);
    setTimeout(() => {
      filteredSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  // Verificar se o evento deve ser ocultado completamente para o usuário atual
  const shouldHideEventCompletely = (event: Event): boolean => {
    if (!event.isPersonal) return false;
    // O criador do evento sempre pode ver
    if (user?.uid === event.createdBy) return false;
    // Super admins e boss sempre veem tudo
    if (isBoss(user?.email) || isDiretoria(user)) return false;
    // Verificar se tem permissão para ver eventos pessoais
    if (canSeePersonalEvents(user)) return false;
    // Ocultar completamente
    return true;
  };

  // Coletar dias com eventos pessoais de outros usuários (para mostrar placeholder)
  const personalEventDays = new Set(
    allActiveEvents
      .filter(e => e.isPersonal && e.createdBy !== user?.uid && user && !isBoss(user.email) && !isDiretoria(user) && !canSeePersonalEvents(user))
      .map(e => e.date)
  );

  const basicFilterFn = (e: Event) => {
    return searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase());
  };

  const fullFilterFn = (e: Event) => {
    if (shouldHideEventCompletely(e)) return false;
    const matchSearch = searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterCategory === 'all') return matchSearch;
    if (filterCategory === 'outro') return matchSearch && !['reuniao', 'processo', 'visita'].includes(e.category);
    return matchSearch && e.category === filterCategory;
  };

  const filteredAllEvents = allActiveEvents.filter(fullFilterFn);

  // Build Google Maps route URL from today's events ordered by time
  const routeUrl = (() => {
    const locations = todayEvents
      .filter(e => e.location && e.location.trim() !== '')
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(e => e.location.trim());

    if (locations.length === 0) return null;
    if (locations.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locations[0])}`;
    }
    const origin = encodeURIComponent(locations[0]);
    const destination = encodeURIComponent(locations[locations.length - 1]);
    const waypoints = locations.slice(1, -1).map(encodeURIComponent).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
  })();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const activeItem = chartData.find(c => c.label === activeMetricLabel);

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Bem-vindo, {user?.name?.split(' ')[0]}</p>
        </div>
        <Link to="/events/create" className="btn-premium hidden lg:inline-flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Novo Evento
        </Link>
      </div>

      {/* Hero Chart Card */}
      <div className="gradient-hero p-6 sm:p-8 relative z-10">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-white/70" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">Atividades Ativas</span>
          </div>
          <div className="flex items-end mb-8">
            <div>
              <p className="text-5xl font-black text-white tabular-nums">{allActiveEvents.length}</p>
              <p className="text-white/60 text-sm mt-1">eventos agendados</p>
            </div>
          </div>
          <div className="space-y-3">
            {chartData.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs font-semibold text-white/80 mb-1">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="chart-bar-track" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <div
                    className="chart-bar-fill animate-grow-x"
                    style={{ width: `${(item.value / total) * 100}%`, background: 'rgba(255,255,255,0.85)', animationDelay: `${i * 120}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {chartData.map((item, i) => {
          const Icon = item.icon;
          const isActive = activeMetricLabel === item.label;
          return (
            <button
              key={i}
              onClick={() => handleMetricClick(item)}
              className="dark-card p-4 animate-fade-in text-left w-full transition-all duration-200 cursor-pointer group"
              style={{
                animationDelay: `${i * 80}ms`,
                border: isActive ? `1.5px solid ${item.color}` : undefined,
                boxShadow: isActive ? `0 0 20px ${item.color}30` : undefined,
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ background: `${item.color}20` }}>
                <Icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
              {isActive && (
                <div className="mt-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: item.color }}>
                  Filtrando ↓
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Filtered All Events — shown when a metric is selected */}
      {activeMetricLabel && activeItem && (
        <div ref={filteredSectionRef} className="dark-card overflow-hidden animate-fade-in">
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: `${activeItem.color}10` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${activeItem.color}20` }}>
              <activeItem.icon className="w-4 h-4" style={{ color: activeItem.color }} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                Todos os eventos — {activeMetricLabel}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{filteredAllEvents.length} evento{filteredAllEvents.length !== 1 ? 's' : ''} encontrado{filteredAllEvents.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => { setActiveMetricLabel(null); setFilterCategory('all'); }}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {filteredAllEvents.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum evento ativo nesta categoria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredAllEvents.map(event => <EventCard key={event.id} event={event} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Today & Upcoming Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today */}
        <div className="dark-card overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Eventos de Hoje</h2>
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {todayEvents.filter(basicFilterFn).length}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {todayEvents.filter(basicFilterFn).length === 0 && !personalEventDays.has(new Date().toISOString().split('T')[0]) ? (
              <div className="py-10 text-center">
                <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum evento para hoje.</p>
              </div>
            ) : (
              <>
                {todayEvents.filter(basicFilterFn).map(event => <EventCard key={event.id} event={event} />)}
                {/* Placeholder para eventos pessoais de outros */}
                {personalEventDays.has(new Date().toISOString().split('T')[0]) && (
                  <div className="rounded-2xl p-4 border-2 border-dashed" style={{ background: 'var(--bg-input)', borderColor: 'var(--accent)', opacity: 0.7 }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,111,15,0.15)' }}>
                        <Lock className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Compromisso Pessoal</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Dia reservado para compromisso pessoal</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {/* Sugerir Rota Button */}
          <div className="px-4 pb-4">
            {routeUrl ? (
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: 'rgba(255,111,15,0.08)', color: 'var(--accent)', border: '1px solid var(--border-color)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,111,15,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,111,15,0.08)'; }}
              >
                <Navigation2 className="w-4 h-4" />
                Sugerir Rota do Dia
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                <Navigation2 className="w-4 h-4" />
                Nenhum local definido nos eventos de hoje
              </div>
            )}
          </div>
        </div>

        {/* Upcoming */}
        <div className="dark-card overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Próximos Eventos</h2>
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
              {upcomingEvents.filter(basicFilterFn).length}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {upcomingEvents.filter(basicFilterFn).length === 0 ? (
              <div className="py-10 text-center">
                <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum evento futuro.</p>
              </div>
            ) : (
              upcomingEvents.filter(basicFilterFn).map(event => <EventCard key={event.id} event={event} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
