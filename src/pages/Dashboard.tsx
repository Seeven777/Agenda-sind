import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { EventCard } from '../components/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { Plus, Briefcase, Map, Users, Calendar as CalendarIcon, Activity, TrendingUp } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';

export function Dashboard() {
  const { user } = useAuth();
  const { searchTerm } = useOutletContext<{ searchTerm: string }>();
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

  const reunioes = allActiveEvents.filter(e => e.category === 'reuniao').length;
  const processos = allActiveEvents.filter(e => e.category === 'processo').length;
  const visitas = allActiveEvents.filter(e => e.category === 'visita').length;
  const outros = allActiveEvents.length - reunioes - processos - visitas;
  const total = allActiveEvents.length || 1;

  const chartData = [
    { label: 'Reuniões', value: reunioes, color: '#3b82f6', icon: Users },
    { label: 'Processos', value: processos, color: '#ef4444', icon: Briefcase },
    { label: 'Visitas', value: visitas, color: '#22c55e', icon: Map },
    { label: 'Outros', value: outros, color: '#a855f7', icon: Activity },
  ];

  const filterFn = (e: Event) =>
    (searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterCategory === 'all' || e.category === filterCategory);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Bem-vindo, {user?.name?.split(' ')[0]}</p>
        </div>
        <Link
          to="/events/create"
          className="btn-premium hidden lg:inline-flex items-center gap-2 text-sm"
        >
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
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-5xl font-black text-white tabular-nums">{allActiveEvents.length}</p>
              <p className="text-white/60 text-sm mt-1">eventos agendados</p>
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs font-bold rounded-xl px-3 py-2 border-none outline-none cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.2)', color: 'white', backdropFilter: 'blur(10px)' }}
            >
              <option value="all">Todas</option>
              <option value="reuniao">Reunião</option>
              <option value="visita">Visita</option>
              <option value="processo">Processo</option>
              <option value="evento">Evento</option>
              <option value="outro">Outro</option>
            </select>
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {chartData.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="dark-card p-4 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${item.color}20` }}>
                <Icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
            </div>
          );
        })}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today */}
        <div className="dark-card overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Eventos de Hoje</h2>
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{todayEvents.filter(filterFn).length}</span>
          </div>
          <div className="p-4 space-y-3">
            {todayEvents.filter(filterFn).length === 0 ? (
              <div className="py-10 text-center">
                <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum evento para hoje.</p>
              </div>
            ) : (
              todayEvents.filter(filterFn).map(event => <EventCard key={event.id} event={event} />)
            )}
          </div>
        </div>

        {/* Upcoming */}
        <div className="dark-card overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Próximos Eventos</h2>
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{upcomingEvents.filter(filterFn).length}</span>
          </div>
          <div className="p-4 space-y-3">
            {upcomingEvents.filter(filterFn).length === 0 ? (
              <div className="py-10 text-center">
                <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum evento futuro.</p>
              </div>
            ) : (
              upcomingEvents.filter(filterFn).map(event => <EventCard key={event.id} event={event} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
