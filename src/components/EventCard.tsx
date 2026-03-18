import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, User, Bookmark, Repeat } from 'lucide-react';
import { Event } from '../types';

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const priorityConfig = {
    alta: { label: 'Alta', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    media: { label: 'Média', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    baixa: { label: 'Baixa', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  };

  const statusConfig = {
    agendado: { label: 'Agendado', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    concluido: { label: 'Concluído', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
    cancelado: { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  };

  const categoryLabels: Record<string, string> = {
    reuniao: 'Reunião', visita: 'Visita', processo: 'Processo', evento: 'Evento', outro: 'Outro'
  };

  const priority = priorityConfig[event.priority];
  const status = statusConfig[event.status];

  return (
    <Link to={`/events/${event.id}`} className="block group animate-fade-in">
      <div className="relative rounded-2xl p-4 transition-all duration-200 overflow-hidden" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)';
          (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card-hover)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)';
          (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-input)';
        }}
      >
        {/* Color accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: event.color || 'var(--accent)' }} />

        <div className="pl-3">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-bold text-sm leading-tight line-clamp-1 group-hover:text-[var(--accent)] transition-colors" style={{ color: 'var(--text-primary)' }}>
              {event.title}
            </h3>
            <div className="flex gap-1.5 flex-shrink-0">
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider" style={{ background: priority.bg, color: priority.color }}>{priority.label}</span>
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider" style={{ background: status.bg, color: status.color }}>{status.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span>{new Date(event.date).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>{event.time}</span>
            </div>
            <div className="flex items-center gap-1.5 col-span-2">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bookmark className="w-3 h-3 flex-shrink-0" />
              <span>{categoryLabels[event.category] || event.category}</span>
            </div>
            {event.isRecurring && (
              <div className="flex items-center gap-1.5">
                <Repeat className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--accent)' }}>Recorrente</span>
              </div>
            )}
          </div>

          {event.tags && event.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {event.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-semibold" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
