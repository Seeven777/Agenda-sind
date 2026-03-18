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
import { useNavigate } from 'react-router-dom';

const locales = {
  'pt-BR': ptBR,
};

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
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'events'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const formattedEvents = snapshot.docs.map(doc => {
        const data = doc.data() as Event;
        // Parse date and time
        const [year, month, day] = data.date.split('-').map(Number);
        const [hour, minute] = data.time.split(':').map(Number);
        
        const start = new Date(year, month - 1, day, hour, minute);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // Assume 1 hour duration

        return {
          id: doc.id,
          title: data.title,
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
    let backgroundColor = '#10B981'; // baixa - green
    
    if (data.priority === 'alta') {
      backgroundColor = '#EF4444'; // red
    } else if (data.priority === 'media') {
      backgroundColor = '#F59E0B'; // yellow
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  return (
    <div className="h-[calc(100vh-8rem)] bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Calendário</h1>
      <div className="h-full">
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          messages={{
            next: "Próximo",
            previous: "Anterior",
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
            agenda: "Agenda",
            date: "Data",
            time: "Hora",
            event: "Evento",
            noEventsInRange: "Não há eventos neste período."
          }}
          culture="pt-BR"
          eventPropGetter={eventStyleGetter}
          onSelectEvent={(event) => navigate(`/events/${event.id}`)}
        />
      </div>
    </div>
  );
}
