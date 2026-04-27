import React, { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { isBoss, isDiretoria, canSeePersonalEvents } from '../lib/permissions';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Grid3X3, List, LayoutGrid } from 'lucide-react';

const locales = { 'pt-BR': ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

// Função helper para obter string de data
const getDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDateTime = (dateStr?: string, timeStr = '12:00') => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour = 12, minute = 0] = timeStr.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export function CalendarView() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [allPersonalDays, setAllPersonalDays] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarView>('month');
  const navigate = useNavigate();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'events'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Coletar TODOS os dias com eventos pessoais (de todos os usuários)
      const personalDays = new Set<string>();
      
      const formattedEvents = snapshot.docs.flatMap(doc => {
        const data = doc.data() as Event;
        
        // Coleta TODOS os dias com eventos pessoais (para mostrar vermelho)
        if (data.isPersonal && data.date) {
          personalDays.add(data.date);
        }
        
        // Verificar se o evento deve ser oculto do calendário
        const shouldHideDetails = (): boolean => {
          if (!data.isPersonal) return false;
          // Se é o criador do evento, pode ver
          if (user?.uid === data.createdBy) return false;
          // Se é boss ou diretoria, pode ver
          if (isBoss(user?.email) || isDiretoria(user)) return false;
          // Se tem permissão específica, pode ver
          if (canSeePersonalEvents(user)) return false;
          return true;
        };
        
        // Usar parsing explícito para evitar problemas de fuso horário
        const start = parseLocalDateTime(data.date, data.time);
        if (!start) return [];
        const end = parseLocalDateTime(data.endDate || data.date, data.endTime || '')
          || new Date(start.getTime() + 60 * 60 * 1000);

        return [{
          id: doc.id,
          title: shouldHideDetails() ? '🔒 Compromisso Pessoal' : data.title,
          start,
          end,
          resource: data,
          // Marcar se deve ser oculto
          isHidden: shouldHideDetails(),
        }];
      });
      
      setAllPersonalDays(personalDays);
      // Mostrar apenas eventos não ocultos
      setEvents(formattedEvents.filter(e => !e.isHidden));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return () => unsubscribe();
  }, [user]);

  const eventStyleGetter = (event: any) => {
    const data = event.resource as Event;
    let backgroundColor = '#10B981'; // Verde - aberto (prioridade baixa padrão)
    
    // Prioridade
    if (data.priority === 'alta') backgroundColor = '#EF4444'; // Vermelho - alta
    else if (data.priority === 'media') backgroundColor = '#F59E0B'; // Amarelo - média
    // Verde = baixa (padrão)

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 1,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: isMobile ? '10px' : '11px',
        fontWeight: 700,
        padding: isMobile ? '2px 4px' : '2px 6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        marginBottom: '1px',
      }
    };
  };

  // Personalizar o estilo do dia no calendário
  const dayPropGetter = (date: Date) => {
    const dateStr = getDateString(date);
    const isPersonalDay = allPersonalDays.has(dateStr);
    
    if (isPersonalDay) {
      return {
        style: {
          backgroundColor: 'rgba(239, 68, 68, 0.15)', // Vermelho claro para dias reservados
          borderRadius: '8px',
        }
      };
    }
    return {};
  };

  const handlePreviousMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleViewChange = (view: CalendarView) => {
    setCurrentView(view);
  };

  const viewOptions = [
    { key: 'month', label: 'Mês', icon: Grid3X3 },
    { key: 'week', label: 'Semana', icon: LayoutGrid },
    { key: 'day', label: 'Dia', icon: Calendar },
    { key: 'agenda', label: 'Lista', icon: List },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
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
      </div>

      {/* View Selector Cards */}
      <div className="flex flex-wrap gap-2">
        {viewOptions.map(view => {
          const Icon = view.icon;
          const isActive = currentView === view.key;
          const isDisabled = isMobile && (view.key === 'week' || view.key === 'day');
          
          return (
            <button
              key={view.key}
              onClick={() => !isDisabled && handleViewChange(view.key as CalendarView)}
              disabled={isDisabled}
              className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 flex-shrink-0"
              style={{
                background: isActive ? 'var(--accent)' : 'var(--bg-card)',
                color: isActive ? 'white' : isDisabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border-subtle)',
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer'
              }}
            >
              <Icon className="w-4 h-4" />
              {view.label}
            </button>
          );
        })}
      </div>

      {/* Calendar Container */}
      <div className="dark-card overflow-hidden">
        <div className={`p-2 sm:p-4 ${isMobile ? 'pb-16' : ''}`}>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3 px-2">
            <button 
              className="w-10 h-10 rounded-xl flex items-center justify-center touch-manipulation transition-all"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
              onClick={handlePreviousMonth}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base sm:text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h3>
            <button 
              className="w-10 h-10 rounded-xl flex items-center justify-center touch-manipulation transition-all"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
              onClick={handleNextMonth}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div style={{ height: isMobile ? 'calc(100vh - 320px)' : 'calc(100vh - 360px)', minHeight: '400px' }}>
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%', fontSize: isMobile ? '12px' : '14px' }}
              date={currentDate}
              onNavigate={setCurrentDate}
              view={currentView}
              onView={(view) => setCurrentView(view as CalendarView)}
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
              dayPropGetter={dayPropGetter}
              onSelectEvent={(event) => navigate(`/events/${event.id}`)}
              views={isMobile ? ['month', 'agenda'] : ['month', 'week', 'day', 'agenda']}
              popup={isMobile}
              toolbar={false}
            />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="dark-card p-4">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {/* Prioridades dos Eventos */}
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
          
          {/* Separador */}
          <div className="hidden sm:block w-px h-4" style={{ background: 'var(--border-subtle)' }} />
          
          {/* Dias Reservados */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ background: 'rgba(239, 68, 68, 0.3)' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Dia Reservado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
