import React, { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { isBoss, isDiretoria, canSeePersonalEvents } from '../lib/permissions';
import { useNavigate } from 'react-router-dom';
import { Plus, Lock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const locales = { 'pt-BR': ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export function CalendarView() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!user) return;

    const shouldHideEvent = (data: Event): boolean => {
      if (!data.isPersonal) return false;
      if (user?.uid === data.createdBy) return false;
      if (isBoss(user?.email) || isDiretoria(user)) return false;
      if (canSeePersonalEvents(user)) return false;
      return true;
    };

    const q = query(collection(db, 'events'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const formattedEvents = snapshot.docs
        .filter(doc => !shouldHideEvent(doc.data() as Event))
        .map(doc => {
          const data = doc.data() as Event;
          const [year, month, day] = data.date.split('-').map(Number);
          const [hour, minute] = data.time.split(':').map(Number);
          const start = new Date(year, month - 1, day, hour, minute);
          const end = new Date(start.getTime() + 60 * 60 * 1000);

          const isPersonalToHide = data.isPersonal && user?.uid !== data.createdBy && !isBoss(user?.email) && !isDiretoria(user) && !canSeePersonalEvents(user);

          return {
            id: doc.id,
            title: isPersonalToHide ? '🔒 Compromisso Pessoal' : data.title,
            start,
            end,
            resource: data,
          };
        });
      setEvents(formattedEvents);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return () => unsubscribe();
  }, [user]);

  const eventStyleGetter = (event: any) => {
    const data = event.resource as Event;
    let backgroundColor = '#10B981';
    
    if (data.priority === 'alta') backgroundColor = '#EF4444';
    else if (data.priority === 'media') backgroundColor = '#F59E0B';

    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        opacity: 0.95,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: isMobile ? '11px' : '12px',
        fontWeight: 600,
        padding: isMobile ? '2px 6px' : '2px 8px',
      }
    };
  };

  return (
    <div className="space-y-4 sm:space-y-6 -mx-4 sm:mx-0 px-4 sm:px-0">
      {/* Header - Mobile Friendly */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Calendário
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {events.length} evento{events.length !== 1 ? 's' : ''} no total
          </p>
        </div>
        <Link to="/events/create" className="btn-premium inline-flex items-center gap-2 text-sm py-3 px-4 self-start sm:self-auto touch-manipulation">
          <Plus className="w-4 h-4" />
          Novo
        </Link>
      </div>

      {/* Calendar Container */}
      <div className="dark-card overflow-hidden">
        <div className={`p-2 sm:p-4 ${isMobile ? 'pb-16' : ''}`}>
          {/* Mobile: Month Navigation */}
          {isMobile && (
            <div className="flex items-center justify-between mb-3 px-2">
              <button 
                className="w-10 h-10 rounded-xl flex items-center justify-center touch-manipulation"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
                onClick={() => {
                  const cal = document.querySelector('.rbc-toolbar')?.querySelectorAll('button');
                  if (cal && cal[0]) (cal[0] as HTMLButtonElement).click();
                }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                className="w-10 h-10 rounded-xl flex items-center justify-center touch-manipulation"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
                onClick={() => {
                  const cal = document.querySelector('.rbc-toolbar')?.querySelectorAll('button');
                  if (cal && cal[2]) (cal[2] as HTMLButtonElement).click();
                }}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
          
          <div style={{ height: isMobile ? 'calc(100vh - 240px)' : 'calc(100vh - 280px)', minHeight: '400px' }}>
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%', fontSize: isMobile ? '12px' : '14px' }}
              messages={{
                next: "→",
                previous: "←",
                today: "Hoje",
                month: "Mês",
                week: "Semana",
                day: "Dia",
                agenda: "Lista",
                date: "Data",
                time: "Hora",
                event: "Evento",
                noEventsInRange: "Nenhum evento neste período"
              }}
              culture="pt-BR"
              eventPropGetter={eventStyleGetter}
              onSelectEvent={(event) => navigate(`/events/${event.id}`)}
              views={isMobile ? ['month', 'agenda'] : ['month', 'week', 'day', 'agenda']}
              popup={isMobile}
              toolbar={!isMobile}
            />
          </div>
        </div>
      </div>

      {/* Legend - Mobile Friendly */}
      <div className="dark-card p-4">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ background: '#EF4444' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Alta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ background: '#F59E0B' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Média</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ background: '#10B981' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Baixa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
