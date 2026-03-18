import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';

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
});

type EventFormData = z.infer<typeof eventSchema>;

export function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<EventFormData>({
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
    }
  });

  const onSubmit = async (data: EventFormData) => {
    if (!user) return;

    try {
      const tagsArray = data.tags 
        ? data.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : [];

      const eventData = {
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

      const docRef = await addDoc(collection(db, 'events'), eventData);
      
      await addDoc(collection(db, 'activity_logs'), {
        eventId: docRef.id,
        userId: user.uid,
        action: 'event_created',
        timestamp: new Date().toISOString(),
        details: `Evento "${data.title}" criado.`
      });

      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'events');
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Evento</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Título</label>
            <input
              type="text"
              {...register('title')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#ff6f0f] focus:ring-[#ff6f0f] sm:text-sm border p-2"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Data</label>
            <input
              type="date"
              {...register('date')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#ff6f0f] focus:ring-[#ff6f0f] sm:text-sm border p-2"
            />
            {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Hora</label>
            <input
              type="time"
              {...register('time')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#ff6f0f] focus:ring-[#ff6f0f] sm:text-sm border p-2"
            />
            {errors.time && <p className="mt-1 text-sm text-red-600">{errors.time.message}</p>}
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Local</label>
            <input
              type="text"
              {...register('location')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#ff6f0f] focus:ring-[#ff6f0f] sm:text-sm border p-2"
            />
            {errors.location && <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Categoria</label>
            <select
              {...register('category')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#ff6f0f] focus:ring-[#ff6f0f] sm:text-sm border p-2"
            >
              <option value="reuniao">Reunião</option>
              <option value="visita">Visita Sindical</option>
              <option value="processo">Audiência/Processo</option>
              <option value="evento">Evento Institucional</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Prioridade</label>
            <select
              {...register('priority')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#ff6f0f] focus:ring-[#ff6f0f] sm:text-sm border p-2"
            >
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Descrição</label>
            <textarea
              {...register('description')}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#ff6f0f] focus:ring-[#ff6f0f] sm:text-sm border p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">CNPJ (Opcional)</label>
            <input
              type="text"
              {...register('cnpj')}
              placeholder="00.000.000/0000-00"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#ff6f0f] focus:ring-[#ff6f0f] sm:text-sm border p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tags (separadas por vírgula)</label>
            <input
              type="text"
              {...register('tags')}
              placeholder="reunião, fiscalização"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#ff6f0f] focus:ring-[#ff6f0f] sm:text-sm border p-2"
            />
          </div>

          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  {...register('notify24h')}
                  className="focus:ring-[#ff6f0f] h-4 w-4 text-[#ff6f0f] border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label className="font-medium text-gray-700">Avisar 24h antes</label>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  {...register('notify1h')}
                  className="focus:ring-[#ff6f0f] h-4 w-4 text-[#ff6f0f] border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label className="font-medium text-gray-700">Avisar 1h antes</label>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2 space-y-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">Personalização e Repetição</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cor do Evento</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      {...register('color')}
                      className="h-8 w-16 rounded border-gray-300 cursor-pointer"
                    />
                    <span className="text-xs text-gray-500">Destaque visual no calendário</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        {...register('isRecurring')}
                        className="focus:ring-[#ff6f0f] h-4 w-4 text-[#ff6f0f] border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label className="font-medium text-gray-700">Evento Recorrente</label>
                    </div>
                  </div>

                  <Controller
                    name="recurrenceType"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        disabled={!control._formValues.isRecurring}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#ff6f0f] focus:ring-[#ff6f0f] sm:text-sm border p-2 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="none">Não repetir</option>
                        <option value="daily">Diariamente</option>
                        <option value="weekly">Semanalmente</option>
                        <option value="monthly">Mensalmente</option>
                      </select>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6f0f]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#ff6f0f] hover:bg-[#e6600c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6f0f] disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Evento'}
          </button>
        </div>
      </form>
    </div>
  );
}
