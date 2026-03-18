import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { Calendar, Clock, MapPin, Tag, FileText, Briefcase, Bell, Repeat, Palette } from 'lucide-react';

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
  isRecurring: z.boolean().optional(),
  recurrenceType: z.enum(['daily', 'weekly', 'monthly', 'none']).optional(),
  recurrenceCount: z.number().min(1).max(52).optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

// Generate dates for recurring events
function generateRecurringDates(startDate: string, type: string, count: number): string[] {
  const dates: string[] = [];
  const date = new Date(startDate + 'T00:00:00');

  for (let i = 0; i < count; i++) {
    const d = new Date(date);
    if (type === 'daily') d.setDate(date.getDate() + i);
    else if (type === 'weekly') d.setDate(date.getDate() + i * 7);
    else if (type === 'monthly') d.setMonth(date.getMonth() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showRecurrence, setShowRecurrence] = useState(false);

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      category: 'reuniao',
      priority: 'media',
      status: 'agendado',
      notify24h: true,
      notify1h: true,
      color: '#ff6f0f',
      isRecurring: false,
      recurrenceType: 'none',
      recurrenceCount: 4,
    }
  });

  const isRecurring = watch('isRecurring');
  const recurrenceType = watch('recurrenceType');

  const onSubmit = async (data: EventFormData) => {
    if (!user) return;

    try {
      const tagsArray = data.tags
        ? data.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : [];

      const baseEventData = {
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
        isRecurring: data.isRecurring || false,
        recurrenceType: data.recurrenceType || 'none',
        createdBy: user.uid,
        creatorName: user.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const isReallyRecurring = data.isRecurring && data.recurrenceType && data.recurrenceType !== 'none';

      if (isReallyRecurring) {
        const count = data.recurrenceCount || 4;
        const dates = generateRecurringDates(data.date, data.recurrenceType!, count);
        for (const dateStr of dates) {
          const evData = { ...baseEventData, date: dateStr };
          const docRef = await addDoc(collection(db, 'events'), evData);
          await addDoc(collection(db, 'activity_logs'), {
            eventId: docRef.id,
            userId: user.uid,
            action: 'event_created',
            timestamp: new Date().toISOString(),
            details: `Evento recorrente "${data.title}" criado para ${dateStr}.`,
          });
        }
      } else {
        const docRef = await addDoc(collection(db, 'events'), baseEventData);
        await addDoc(collection(db, 'activity_logs'), {
          eventId: docRef.id,
          userId: user.uid,
          action: 'event_created',
          timestamp: new Date().toISOString(),
          details: `Evento "${data.title}" criado.`,
        });
      }

      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'events');
    }
  };

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
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Novo Evento</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Preencha os dados do evento</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>Título *</label>
            <input type="text" {...register('title')} className="dark-input" placeholder="Nome do evento ou reunião" />
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
            <input type="text" {...register('location')} className="dark-input" placeholder="Endereço ou nome do local" />
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
            <textarea {...register('description')} rows={3} className="dark-input resize-none" placeholder="Detalhes adicionais sobre o evento..." />
          </div>

          {/* CNPJ & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>CNPJ (Opcional)</label>
              <input type="text" {...register('cnpj')} placeholder="00.000.000/0000-00" className="dark-input" />
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

          {/* Color & Recurrence */}
          <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
            <label className={`${labelClass} flex items-center gap-1`} style={{ color: 'var(--text-muted)' }}>
              <Palette className="w-3 h-3" />Personalização
            </label>

            {/* Color */}
            <div className="flex items-center gap-3">
              <input type="color" {...register('color')} className="h-9 w-14 rounded-lg border-none cursor-pointer" />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cor de destaque do evento</span>
            </div>

            {/* Recurring toggle */}
            <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="isRecurring"
                  {...register('isRecurring')}
                  className="w-4 h-4 rounded accent-orange-500"
                  onChange={e => setShowRecurrence(e.target.checked)}
                />
                <label htmlFor="isRecurring" className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Repeat className="w-4 h-4" style={{ color: 'var(--accent)' }} />Evento Recorrente
                </label>
              </div>

              {(isRecurring || showRecurrence) && (
                <div className="grid grid-cols-2 gap-3 mt-3 animate-fade-in">
                  <div>
                    <label className={labelClass} style={{ color: 'var(--text-muted)' }}>Repetir</label>
                    <Controller
                      name="recurrenceType"
                      control={control}
                      render={({ field }) => (
                        <select {...field} className="dark-input">
                          <option value="none">Não repetir</option>
                          <option value="daily">Diariamente</option>
                          <option value="weekly">Semanalmente</option>
                          <option value="monthly">Mensalmente</option>
                        </select>
                      )}
                    />
                  </div>
                  {recurrenceType && recurrenceType !== 'none' && (
                    <div>
                      <label className={labelClass} style={{ color: 'var(--text-muted)' }}>Quantas vezes</label>
                      <input
                        type="number"
                        {...register('recurrenceCount', { valueAsNumber: true })}
                        min={2}
                        max={52}
                        className="dark-input"
                        placeholder="Ex: 4"
                      />
                    </div>
                  )}
                  {recurrenceType && recurrenceType !== 'none' && (
                    <div className="col-span-2">
                      <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        ✅ Serão criados <strong>{watch('recurrenceCount') || 4}</strong> eventos separados, um para cada ocorrência.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-premium w-full sm:w-auto px-6 py-2.5 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : (isRecurring && recurrenceType !== 'none' ? `Criar ${watch('recurrenceCount') || 4} eventos` : 'Salvar Evento')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
