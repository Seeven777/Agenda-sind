import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { EventCard } from '../components/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { isBoss, isDiretoria, canSeePersonalEvents } from '../lib/permissions';
import { Plus, Calendar, Clock, MapPin, Navigation2, Lock, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { user } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [allActiveEvents, setAllActiveEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');

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

  const shouldHideEventCompletely = (event: Event): boolean => {
    if (!event.isPersonal) return false;
    if (user?.uid === event.createdBy) return false;
    if (isBoss(user?.email) || isDiretoria(user)) return false;
    if (canSeePersonalEvents(user)) return false;
    return true;
  };

  const personalEventDays = new Set(
    allActiveEvents
      .filter(e => e.isPersonal && e.createdBy !== user?.uid && user && !isBoss(user.email) && !isDiretoria(user) && !canSeePersonalEvents(user))
      .map(e => e.date)
  );

  const basicFilterFn = (e: Event) => !shouldHideEventCompletely(e);

  const fullFilterFn = (e: Event) => {
    if (shouldHideEventCompletely(e)) return false;
    if (filterCategory === 'all') return true;
    if (filterCategory === 'outro') return !['reuniao', 'processo', 'visita', 'evento'].includes(e.category);
    return e.category === filterCategory;
  };

  const filteredAllEvents = allActiveEvents.filter(fullFilterFn);
  const todayFiltered = todayEvents.filter(basicFilterFn);
  const upcomingFiltered = upcomingEvents.filter(basicFilterFn);

  // Build Google Maps route URL from today's events
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

  const categories = [
    { key: 'all', label: 'Todos', color: 'var(--accent)' },
    { key: 'reuniao', label: 'Reuniões', color: '#3b82f6' },
    { key: 'visita', label: 'Visitas', color: '#10b981' },
    { key: 'processo', label: 'Processos', color: '#ef4444' },
    { key: 'evento', label: 'Eventos', color: '#a855f7' },
    { key: 'outro', label: 'Outros', color: '#6b7280' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Olá, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link to="/events/create" className="btn-premium inline-flex items-center gap-2 text-sm self-start">
          <Plus className="w-4 h-4" />
          Novo Evento
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,111,15,0.15)' }}>
              <Calendar className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{allActiveEvents.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Eventos Ativos</p>
        </div>
        <div className="dark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Clock className="w-4 h-4" style={{ color: '#3b82f6' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{todayFiltered.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hoje</p>
        </div>
        <div className="dark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <MapPin className="w-4 h-4" style={{ color: '#10b981' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{upcomingFiltered.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Próximos</p>
        </div>
        <div className="dark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
              <Filter className="w-4 h-4" style={{ color: '#a855f7' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{filteredAllEvents.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Filtrados</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => {
              setFilterCategory(cat.key);
              // Scroll suave para os cards filtrados
              if (cat.key !== 'all') {
                setTimeout(() => {
                  document.getElementById('filtered-events')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }
            }}
            className="px-3 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0"
            style={{
              background: filterCategory === cat.key ? cat.color : 'var(--bg-card)',
              color: filterCategory === cat.key ? 'white' : 'var(--text-secondary)',
              border: filterCategory === cat.key ? 'none' : '1px solid var(--border-subtle)'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Today's Events */}
      <div className="dark-card overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Eventos de Hoje</h2>
          <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {todayFiltered.length}
          </span>
        </div>
        <div className="p-4">
          {todayFiltered.length === 0 && !personalEventDays.has(new Date().toISOString().split('T')[0]) ? (
            <div className="empty-state py-8">
              <div className="empty-state-icon">
                <Calendar className="w-7 h-7" style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Nenhum evento para hoje</p>
              <Link to="/events/create" className="mt-3 text-sm font-medium" style={{ color: 'var(--accent)' }}>
                Criar novo evento →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {todayFiltered.map(event => <EventCard key={event.id} event={event} />)}
              {personalEventDays.has(new Date().toISOString().split('T')[0]) && (
                <div className="rounded-xl p-4 border border-dashed" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,111,15,0.2)' }}>
                      <Lock className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Compromisso Pessoal</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Dia reservado</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Route Button */}
        {routeUrl && (
          <div className="px-4 pb-4">
            <a
              href={routeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Navigation2 className="w-4 h-4" />
              Ver rota do dia no Maps
            </a>
          </div>
        )}
      </div>

      {/* Upcoming Events */}
      <div className="dark-card overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Próximos Eventos</h2>
          <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
            {upcomingFiltered.length}
          </span>
        </div>
        <div className="p-4">
          {upcomingFiltered.length === 0 ? (
            <div className="empty-state py-8">
              <div className="empty-state-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                <Calendar className="w-7 h-7" style={{ color: '#3b82f6' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Nenhum evento futuro</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingFiltered.map(event => <EventCard key={event.id} event={event} />)}
            </div>
          )}
        </div>
      </div>

      {/* All Filtered Events */}
      {filterCategory !== 'all' && (
        <div id="filtered-events" className="dark-card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFilterCategory('all')}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {categories.find(c => c.key === filterCategory)?.label}
              </h2>
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {filteredAllEvents.length} evento{filteredAllEvents.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-4">
            {filteredAllEvents.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon">
                  <Filter className="w-7 h-7" style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Nenhum evento nesta categoria</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredAllEvents.slice(0, 20).map(event => <EventCard key={event.id} event={event} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
