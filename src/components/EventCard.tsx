import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, User, Bookmark } from 'lucide-react';
import { Event } from '../types';
import { cn } from '../lib/utils';

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const priorityColors = {
    alta: 'bg-red-100 text-red-800 border-red-200',
    media: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    baixa: 'bg-green-100 text-green-800 border-green-200',
  };

  const statusColors = {
    agendado: 'bg-blue-100 text-blue-800',
    concluido: 'bg-gray-100 text-gray-800',
    cancelado: 'bg-red-100 text-red-800',
  };

  const categoryLabels = {
    reuniao: 'Reunião',
    visita: 'Visita',
    processo: 'Processo',
    evento: 'Evento',
    outro: 'Outro'
  };

  return (
    <Link to={`/events/${event.id}`} className="block group">
      <div className="relative bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 hover:shadow-md transition-all hover:-translate-y-1 overflow-hidden animate-fade-in">
        {/* Color accent bar */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-1.5" 
          style={{ backgroundColor: event.color || '#ff6f0f' }} 
        />
        
        <div className="pl-2">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
            <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 sm:line-clamp-1 group-hover:text-[#ff6f0f] transition-colors">{event.title}</h3>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border", priorityColors[event.priority])}>
                {event.priority}
              </span>
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", statusColors[event.status])}>
                {event.status}
              </span>
            </div>
          </div>
          
          <div className="space-y-2 text-sm text-gray-600">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>{new Date(event.date).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>{event.time}</span>
              </div>
            </div>
            <div className="flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="line-clamp-1">Criado por: {event.creatorName}</span>
              </div>
              <div className="flex items-center">
                <Bookmark className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="line-clamp-1">{categoryLabels[event.category] || event.category}</span>
              </div>
            </div>
          </div>

          {event.tags && event.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1">
              {event.tags.map((tag, idx) => (
                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
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
