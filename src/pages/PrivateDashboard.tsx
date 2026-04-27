import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { EventCard } from '../components/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { isDiretoria } from '../lib/permissions';
import { Plus, Calendar as CalendarIcon, Lock, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PrivateDashboard() {
  const { user } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [allPersonalEvents, setAllPersonalEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const getDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!user) return;

    const todayStr = getDateString(new Date());

    // Eventos pessoais do patrão
    const personalQuery = query(
      collection(db, 'events'),
      where('isPersonal', '==', true),
      where('status', '==', 'agendado'),
      orderBy('date', 'asc')
    );

    // Eventos de hoje
    const todayPersonalQuery = query(
      collection(db, 'events'),
      where('isPersonal', '==', true),
      where('date', '==', todayStr),
      orderBy('time', 'asc')
    );

    // Próximos eventos
    const upcomingPersonalQuery = query(
      collection(db, 'events'),
      where('isPersonal', '==', true),
      where('date', '>', todayStr),
      orderBy('date', 'asc'),
      orderBy('time', 'asc'),
      limit(10)
    );
    const onEventsError = (error: unknown) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
      setLoading(false);
    };

    const u1 = onSnapshot(personalQuery, 
      (s) => { setAllPersonalEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))); setLoading(false); },
      onEventsError
    );

    const u2 = onSnapshot(todayPersonalQuery, 
      (s) => setTodayEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))),
      onEventsError
    );

    const u3 = onSnapshot(upcomingPersonalQuery, 
      (s) => setUpcomingEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))),
      onEventsError
    );

    return () => { u1(); u2(); u3(); };
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" 
             style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" 
               style={{ background: 'linear-gradient(135deg, var(--accent), #ff9a0d)' }}>
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Agenda Particular da Diretoria
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Compromissos exclusivos da diretoria
            </p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="dark-card p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" 
             style={{ background: 'rgba(255, 111, 15, 0.15)' }}>
          <Lock className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
            Agenda Exclusiva
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Estes eventos são <strong>somente seus</strong>. Os outros apenas verão que este dia está ocupado, mas não verão nenhum detalhe.



          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="dark-card p-5">
          <p className="text-3xl font-black" style={{ color: 'var(--accent)' }}>
            {allPersonalEvents.length}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Eventos pessoais agendados
          </p>
        </div>
        <div className="dark-card p-5">
          <p className="text-3xl font-black" style={{ color: '#22c55e' }}>
            {todayEvents.length}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Hoje
          </p>
        </div>
        <div className="dark-card p-5">
          <p className="text-3xl font-black" style={{ color: '#3b82f6' }}>
            {upcomingEvents.length}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Próximos eventos
          </p>
        </div>
      </div>

      {/* Today's Events */}
      <div className="dark-card overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-2" 
             style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 111, 15, 0.08)' }}>
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
            Eventos de Hoje
          </h2>
          <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold" 
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {todayEvents.length}
          </span>
        </div>
        <div className="p-4 space-y-3">
          {todayEvents.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Nenhum evento pessoal para hoje.
              </p>
              <Link to="/events/create" className="mt-3 inline-flex items-center gap-2 text-sm font-medium"
                    style={{ color: 'var(--accent)' }}>
                <Plus className="w-4 h-4" />
                Criar evento pessoal
              </Link>
            </div>
          ) : (
            todayEvents.map(event => <EventCard key={event.id} event={event} />)
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="dark-card overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-2" 
             style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
          <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
            Próximos Eventos Pessoais
          </h2>
          <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold" 
                style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            {upcomingEvents.length}
          </span>
        </div>
        <div className="p-4 space-y-3">
          {upcomingEvents.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Nenhum evento pessoal futuro.
              </p>
            </div>
          ) : (
            upcomingEvents.map(event => <EventCard key={event.id} event={event} />)
          )}
        </div>
      </div>

      {/* All Personal Events */}
      {allPersonalEvents.length > 0 && (
        <div className="dark-card overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2" 
               style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#a855f7' }} />
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              Todos os Eventos Pessoais
            </h2>
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold" 
                  style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
              {allPersonalEvents.length}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {allPersonalEvents.map(event => <EventCard key={event.id} event={event} />)}
          </div>
        </div>
      )}
    </div>
  );
}
