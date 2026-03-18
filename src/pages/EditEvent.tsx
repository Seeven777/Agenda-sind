import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { Calendar, Clock, MapPin, Tag, FileText, Briefcase, Bell, Repeat, Palette, ArrowLeft } from 'lucide-react';

const eventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  date: z.string().min(1, 'Data é obrigatória'),
  time: z.string().min(1, 'Hora é obrigatória'),
  location: z.string().min(1, 'Local é obrigatório').max(200),
  category: z.enum(['reuniao', 'visita', 'processo', 'evento', 'outro']),
  priority: z.enum(['alta', 'media', 'baixa']),
  status: z.enum(['agendado', 'concluido', 'cancelado']),
  description: z.string().max(2000).optional(),
  cnpj: z.string().max(20).optional(),
  notify24h: z.boolean(),
  notify1h: z.boolean(),
  tags: z.string().optional(),
  color: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema> & { isRecurring?: boolean };

export function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<EventFormData | null>(null);
  const [showRecurrence, setShowRecurrence] = useState(false);

  const { register, handleSubmit, control, watch, reset, formState: { errors, isSubmitting } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });


  useEffect(() => {
    if (!id || !user) return;

    const fetchEvent = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'events', id));
        if (docSnap.exists()) {
          const data = docSnap.data() as EventFormData;
          setInitialData(data);
          reset(data);
          setShowRecurrence(data.isRecurring || false);
        } else {
          navigate('/');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id, user, navigate, reset]);

  const onSubmit = async (data: EventFormData) => {
    if (!id || !user || !initialData) return;

    try {
      const tagsArray = data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

      const updateData = {
        title: data.title,
        date: data.date,
        time: data.time,
        location: data.location,
        category: data.category,
        priority: data.priority,
        status: data.status,
        description: data.description || '',
        cnpj: data.cnpj || '',
        notify24h: data.notify24h,
        notify1h: data.notify1h,
        tags: tagsArray,
        color: data.color || '#ff6f0f',
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'events', id), updateData);

      // Log activity
      await addDoc(collection(db, 'activity_logs'), {
        eventId: id,
        userId: user.uid,
        action: 'event_updated',
        timestamp: new Date().toISOString(),
        details: `Evento "${data.title}" atualizado.`,
      });

      navigate(`/events/${id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'events');
    }
  };

  if (loading || !initialData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const labelClass = "block text-xs font-bold uppercase tracking-wider mb-2";
  const errorClass = "mt-1 text-xs font-medium";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="dark-card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-8" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
            <Calendar className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Editar Evento</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Atualize os dados do evento</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>Título *</label>
            <input type="text" {...register('title')} className="dark-input" />
            {errors.title && <p className={errorClass} style={{ color: 'var(--danger)' }}>{errors.title.message}</p>}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Data *</span>
              </label>
              <input type="date" {...register('date')} className="dark-input" />
              {errors.date && <p className={errorClass} style={{ color: 'var(--danger)' }}>{errors.date.message}</p>}
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Hora *</span>
              </label>
              <input type="time" {...register('time')} className="dark-input" />
              {errors.time && <p className={errorClass} style={{ color: 'var(--danger)' }}>{errors.time.message}</p>}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Local *</span>
            </label>
            <input type="text" {...register('location')} className="dark-input" />
            {errors.location && <p className={errorClass} style={{ color: 'var(--danger)' }}>{errors.location.message}</p>}
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />Categoria</span>
              </label>
              <select {...register('category')} className="dark-input">
                <option value="reuniao">Reunião</option>
                <option value="visita">Visita Sindical</option>
                <option value="processo">Audiência/Processo</option>
                <option value="evento">Evento Institucional</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>Prioridade</label>
              <select {...register('priority')} className="dark-input">
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Média</option>
                <option value="baixa">🟢 Baixa</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><FileText className="w-3 h-3" />Descrição</span>
            </label>
            <textarea {...register('description')} rows={3} className="dark-input resize-none" />
          </div>

          {/* CNPJ & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>CNPJ (Opcional)</label>
              <input type="text" {...register('cnpj')} className="dark-input" />
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Tag className="w-3 h-3" />Tags</span>
              </label>
              <input type="text" {...register('tags')} placeholder="reunião, fiscalização" className="dark-input" />
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
            <label className={`${labelClass} flex items-center gap-1`} style={{ color: 'var(--text-muted)' }}>
              <Bell className="w-3 h-3" />Notificações
            </label>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="notify24h" {...register('notify24h')} className="w-4 h-4 rounded accent-orange-500" />
              <label htmlFor="notify24h" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Avisar 24h antes</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="notify1h" {...register('notify1h')} className="w-4 h-4 rounded accent-orange-500" />
              <label htmlFor="notify1h" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Avisar 1h antes</label>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><Palette className="w-3 h-3" />Cor</span>
            </label>
            <div className="flex items-center gap-3">
              <input type="color" {...register('color')} className="h-9 w-14 rounded-lg border-none cursor-pointer" />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cor de destaque</span>
            </div>
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => navigate(`/events/${id}`)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              <ArrowLeft className="inline w-4 h-4 mr-1 -ml-1" />Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-premium w-full sm:w-auto px-6 py-2.5 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Atualizar Evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

