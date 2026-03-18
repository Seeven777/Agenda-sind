import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, MapPin, User, Bookmark, Repeat, Edit2 } from 'lucide-react';
import { Event } from '../types';

interface EventCardProps {
  event: Event;
  onEdit?: (id: string) => void;
}

export function EventCard({ event, onEdit }: EventCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = user?.uid === event.createdBy;
  
  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit(event.id);
    } else {
      navigate(`/events/${event.id}/edit`);
    }
  };

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
    <div className="group animate-fade-in">
      <Link 
        to={`/events/${event.id}`} 
        className="block"
      >
        <div 
          className="relative rounded-2xl p-4 transition-all duration-200 overflow-hidden" 
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
          onMouseEnter={e => {
            const card = e.currentTarget.parentElement;
            if (card) {
              card.style.borderColor = 'var(--border-color)';
              card.style.background = 'var(--bg-card-hover)';
            }
          }}
          onMouseLeave={e => {
            const card = e.currentTarget.parentElement;
            if (card) {
              card.style.borderColor = 'var(--border-subtle)';
              card.style.background = 'var(--bg-input)';
            }
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
      
      {/* Edit Button Overlay - appears on hover if owner */}
      {isOwner && (
        <button
          onClick={handleEdit}
          className="absolute top-2 right-2 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible z-10 shadow-lg hover:scale-105"
          style={{ 
            background: 'rgba(255, 111, 15, 0.95)', 
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}
          title="Editar este evento"
        >
          <Edit2 className="w-4.5 h-4.5 text-white drop-shadow-sm" />
        </button>
      )}
    </div>
  );
}
