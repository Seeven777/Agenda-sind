import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, MapPin, Edit2, Printer, Repeat, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Event } from '../types';
import { isSuperAdmin } from '../lib/permissions';

interface EventCardProps {
  event: Event;
  onEdit?: (id: string) => void;
}

export function EventCard({ event, onEdit }: EventCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = Boolean(
    user && (
      user.uid === event.createdBy ||
      user.isAdmin ||
      isSuperAdmin(user.email) ||
      (event.creatorRole && user.role.trim().toLowerCase() === event.creatorRole.trim().toLowerCase())
    )
  );

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit(event.id);
    } else {
      navigate(`/events/${event.id}/edit`);
    }
  };

  // Função helper para formatar datas sem problemas de fuso horário
  const formatDateForPrint = (dateStr?: string) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Sem data';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    if (Number.isNaN(date.getTime())) return 'Sem data';
    return date.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
      reuniao: 'Reunião', visita: 'Visita Sindical', processo: 'Audiência/Processo', evento: 'Evento Institucional', outro: 'Outro'
    };

    const priority = priorityConfig[event.priority];
    const status = statusConfig[event.status];

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${event.title} - Agenda Sind</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #333; border-bottom: 2px solid #ff6f0f; padding-bottom: 10px; }
          .info { margin: 15px 0; }
          .label { font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase; }
          .value { font-size: 16px; color: #333; margin-top: 5px; }
          .badge { display: inline-block; padding: 5px 10px; border-radius: 20px; font-size: 12px; margin-right: 5px; }
          .description { background: #f5f5f5; padding: 15px; border-radius: 10px; margin-top: 20px; }
          .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>${event.title}</h1>
        <div class="info"><div class="label">Categoria</div><div class="value">${categoryLabels[event.category] || event.category}</div></div>
        <div class="info"><div class="label">Data</div><div class="value">${formatDateForPrint(event.date)}</div></div>
        <div class="info"><div class="label">Hora</div><div class="value">${event.time}${event.endTime ? ` - ${event.endTime}` : ''}</div></div>
        ${event.endDate ? `<div class="info"><div class="label">Data de Término</div><div class="value">${formatDateForPrint(event.endDate)}</div></div>` : ''}
        <div class="info"><div class="label">Local</div><div class="value">${event.location}</div></div>
        <div class="info"><div class="label">Prioridade</div><div class="value">
          <span class="badge" style="background: ${priority.bg}; color: ${priority.color}">${priority.label}</span>
          <span class="badge" style="background: ${status.bg}; color: ${status.color}">${status.label}</span>
        </div></div>
        ${event.description ? `<div class="description"><div class="label">Descrição</div><div class="value">${event.description}</div></div>` : ''}
        <div class="footer"><p>Agenda Sind - SindPetShop-SP</p><p>${new Date().toLocaleString('pt-BR')}</p></div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
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

  const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
    reuniao: { label: 'Reunião', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    visita: { label: 'Visita', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    processo: { label: 'Processo', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    evento: { label: 'Evento', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
    outro: { label: 'Outro', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  };

  const priority = priorityConfig[event.priority];
  const status = statusConfig[event.status];
  const category = categoryConfig[event.category] || categoryConfig.outro;

  const formatDate = (dateStr?: string) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Sem data';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    if (Number.isNaN(date.getTime())) return 'Sem data';
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  };

  // Função helper para comparar datas sem considerar fuso horário
  const getDateString = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getDateString(new Date());
  const tomorrowStr = getDateString(new Date(Date.now() + 86400000));
  
  const isToday = event.date === todayStr;
  const isTomorrow = event.date === tomorrowStr;

  const getDateLabel = () => {
    if (isToday) return 'Hoje';
    if (isTomorrow) return 'Amanhã';
    return formatDate(event.date);
  };

  return (
    <Link to={`/events/${event.id}`} className="block group event-card">
      <div
        className="dark-card overflow-hidden p-4 sm:p-5 transition-all duration-200 hover:scale-[1.01]"
      >
        {/* Top: Category badge + Date */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span 
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: category.bg, color: category.color }}
            >
              {category.label}
            </span>
            {event.isRecurring && (
              <span 
                className="px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <Repeat className="w-3 h-3" />
                Recorrente
              </span>
            )}
          </div>
          <span 
            className="text-xs font-medium px-2.5 py-1 rounded-lg flex-shrink-0"
            style={{ 
              background: isToday ? 'var(--accent-soft)' : 'var(--bg-input)', 
              color: isToday ? 'var(--accent)' : 'var(--text-muted)'
            }}
          >
            {getDateLabel()}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-base sm:text-lg mb-3 line-clamp-2 group-hover:text-[var(--accent)] transition-colors" style={{ color: 'var(--text-primary)' }}>
          {event.title}
        </h3>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{event.time}{event.endTime ? ` - ${event.endTime}` : ''}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        </div>

        {/* Bottom: Priority + Status + Actions */}
        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <span 
              className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide"
              style={{ background: priority.bg, color: priority.color }}
            >
              {priority.label}
            </span>
            <span 
              className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide"
              style={{ background: status.bg, color: status.color }}
            >
              {status.label}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2.5 rounded-xl transition-all hover:bg-white/5 touch-target"
              style={{ color: 'var(--text-muted)' }}
              title="Imprimir"
            >
              <Printer className="w-4 h-4" />
            </button>
            {canEdit && (
              <button
                onClick={handleEdit}
                className="p-2.5 rounded-xl transition-all flex items-center gap-1.5 touch-target"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
                <span className="text-xs font-medium">Editar</span>
              </button>
            )}
            <span 
              className="p-2.5 rounded-xl transition-all opacity-0 group-hover:opacity-100"
              style={{ color: 'var(--accent)' }}
            >
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {event.tags.slice(0, 3).map((tag, i) => (
              <span 
                key={i} 
                className="px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
