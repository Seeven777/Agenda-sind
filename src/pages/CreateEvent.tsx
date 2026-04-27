import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { Calendar, Clock, MapPin, Tag, FileText, Bell, Repeat, Timer, Scale, Lock, AlertTriangle, ArrowLeft, Check, ChevronDown } from 'lucide-react';
import { isBoss, isDiretoria, canCreateOnBlockedDays } from '../lib/permissions';
import { useVoiceAssistant, parseVoiceCommand } from '../hooks/useVoiceAssistant';
import { VoiceButton, VoiceResultDisplay } from '../components/VoiceButton';

const processDetailsSchema = z.object({
  processoNumero: z.string().optional(),
  forum: z.string().optional(),
  autor: z.string().optional(),
  reu: z.string().optional(),
  nomePartes: z.string().optional(),
  acao: z.string().optional(),
  localTramitacao: z.string().optional(),
  dataDistribuicao: z.string().optional(),
  advogadoNome: z.string().optional(),
  advogadoFone: z.string().optional(),
  acompanhamento: z.string().optional(),
});

const eventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  date: z.string().min(1, 'Data é obrigatória'),
  time: z.string().min(1, 'Hora é obrigatória'),
  hasEndDate: z.boolean().optional(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().min(1, 'Local é obrigatório').max(200),
  category: z.enum(['reuniao', 'visita', 'processo', 'evento', 'outro']),
  priority: z.enum(['alta', 'media', 'baixa']),
  description: z.string().max(2000).optional(),
  cnpj: z.string().max(20).optional(),
  notify24h: z.boolean(),
  notify1h: z.boolean(),
  tags: z.string().optional(),
  color: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceType: z.enum(['daily', 'weekly', 'monthly', 'none']).optional(),
  recurrenceCount: z.number().min(1).max(52).optional(),
  isPersonal: z.boolean().optional(),
  processDetails: processDetailsSchema.optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

function parseLocalDate(dateStr?: string) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalDate(dateStr: string) {
  return parseLocalDate(dateStr)?.toLocaleDateString('pt-BR') || dateStr;
}

function generateRecurringDates(startDate: string, type: string, count: number): string[] {
  const dates: string[] = [];
  const baseDate = parseLocalDate(startDate);
  if (!baseDate) return dates;
  
  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate);
    if (type === 'daily') d.setDate(baseDate.getDate() + i);
    else if (type === 'weekly') d.setDate(baseDate.getDate() + i * 7);
    else if (type === 'monthly') d.setMonth(baseDate.getMonth() + i);
    dates.push(toLocalDateString(d));
  }
  return dates;
}

function generateDatesUntilEndDate(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end || start > end) return dates;
  const current = new Date(start);
  while (current <= end) {
    dates.push(toLocalDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showProcessDetails, setShowProcessDetails] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [blockedDaysWarning, setBlockedDaysWarning] = useState<string[]>([]);

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      category: 'reuniao',
      priority: 'media',
      notify24h: true,
      notify1h: true,
      color: '#ff6f0f',
      isRecurring: false,
      recurrenceType: 'none',
      recurrenceCount: 4,
      hasEndDate: false,
    }
  });

  const isRecurring = watch('isRecurring');
  const recurrenceType = watch('recurrenceType');
  const category = watch('category');
  const selectedDate = watch('date');
  const selectedEndDate = watch('endDate');

  // Hook de reconhecimento de voz
  const {
    isListening,
    transcript,
    isSupported: isVoiceSupported,
    error: voiceError,
    startListening,
    stopListening,
    clearTranscript,
  } = useVoiceAssistant();

  // Estado para controlar quando aplicar o comando de voz
  const [voiceApplied, setVoiceApplied] = useState(false);

  // Aplicar dados do comando de voz ao formulário
  const applyVoiceData = useCallback((text: string) => {
    const parsed = parseVoiceCommand(text);
    
    if (parsed.title) setValue('title', parsed.title);
    if (parsed.date) setValue('date', parsed.date);
    if (parsed.time) setValue('time', parsed.time);
    if (parsed.location) setValue('location', parsed.location);
    if (parsed.category) setValue('category', parsed.category as any);
    if (parsed.priority) setValue('priority', parsed.priority as any);
    if (parsed.description) setValue('description', parsed.description);
    
    setVoiceApplied(true);
    setTimeout(() => setVoiceApplied(false), 3000);
  }, [setValue]);

  // Effect para aplicar dados quando o reconhecimento finalizar
  useEffect(() => {
    if (transcript && !isListening && !voiceApplied) {
      applyVoiceData(transcript);
    }
  }, [transcript, isListening, voiceApplied, applyVoiceData]);

  useEffect(() => {
    const checkBlockedDays = async () => {
      if (!user) return;
      const datesToCheck: string[] = [selectedDate];
      
      if (selectedEndDate) {
        const dates = generateDatesUntilEndDate(selectedDate, selectedEndDate);
        datesToCheck.push(...dates);
      }
      
      if (isRecurring && recurrenceType && recurrenceType !== 'none') {
        const count = watch('recurrenceCount') || 4;
        const dates = generateRecurringDates(selectedDate, recurrenceType, count);
        datesToCheck.push(...dates);
      }
      
      const blockedDates: string[] = [];
      for (const date of datesToCheck) {
        if (!date) continue;
        const q = query(collection(db, 'events'), where('date', '==', date), where('isPersonal', '==', true));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.createdBy !== user.uid && !isBoss(user.email) && !isDiretoria(user) && !canCreateOnBlockedDays(user)) {
            if (!blockedDates.includes(date)) blockedDates.push(date);
          }
        });
      }
      setBlockedDaysWarning(blockedDates);
    };
    
    if (selectedDate) checkBlockedDays();
  }, [selectedDate, selectedEndDate, isRecurring, recurrenceType, user]);

  const onSubmit = async (data: EventFormData) => {
    if (!user) return;

    if (blockedDaysWarning.length > 0 && !isBoss(user.email) && !isDiretoria(user) && !canCreateOnBlockedDays(user)) {
      const formattedDates = blockedDaysWarning.map(formatLocalDate).join(', ');
      alert(`Você não pode criar eventos nos seguintes dias:\n${formattedDates}`);
      return;
    }

    try {
      const tagsArray = data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

      const eventData: Record<string, any> = {
        title: data.title,
        date: data.date,
        time: data.time,
        endDate: data.endDate || '',
        endTime: data.endTime || '',
        location: data.location,
        category: data.category,
        priority: data.priority,
        status: 'agendado',
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
        seriesUpdateAll: true,
        isPersonal: (isBoss(user.email) || isDiretoria(user)) ? (data.isPersonal || false) : false,
      };

      if (data.category === 'processo' && data.processDetails) {
        eventData.processDetails = {
          processoNumero: data.processDetails.processoNumero || '',
          forum: data.processDetails.forum || '',
          autor: data.processDetails.autor || '',
          reu: data.processDetails.reu || '',
          nomePartes: data.processDetails.nomePartes || '',
          acao: data.processDetails.acao || '',
          localTramitacao: data.processDetails.localTramitacao || '',
          dataDistribuicao: data.processDetails.dataDistribuicao || '',
          advogadoNome: data.processDetails.advogadoNome || '',
          advogadoFone: data.processDetails.advogadoFone || '',
          acompanhamento: data.processDetails.acompanhamento || '',
        };
      }

      const isReallyRecurring = data.isRecurring && data.recurrenceType && data.recurrenceType !== 'none';
      const hasEnd = Boolean(data.endDate && data.endDate !== data.date);
      const seriesId = `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (isReallyRecurring) {
        const count = data.recurrenceCount || 4;
        const dates = generateRecurringDates(data.date, data.recurrenceType!, count);
        for (const dateStr of dates) {
          const evData = { ...eventData, date: dateStr, seriesId };
          const docRef = await addDoc(collection(db, 'events'), evData);
          await addDoc(collection(db, 'activity_logs'), {
            eventId: docRef.id, userId: user.uid, action: 'event_created',
            timestamp: new Date().toISOString(),
            details: `Evento recorrente "${data.title}" criado para ${dateStr}.`,
          });
        }
      } else if (hasEnd) {
        const dates = generateDatesUntilEndDate(data.date, data.endDate!);
        for (const dateStr of dates) {
          const evData = { ...eventData, date: dateStr, seriesId };
          const docRef = await addDoc(collection(db, 'events'), evData);
          await addDoc(collection(db, 'activity_logs'), {
            eventId: docRef.id, userId: user.uid, action: 'event_created',
            timestamp: new Date().toISOString(),
            details: `Evento "${data.title}" criado para ${dateStr}.`,
          });
        }
      } else {
        const docRef = await addDoc(collection(db, 'events'), eventData);
        await addDoc(collection(db, 'activity_logs'), {
          eventId: docRef.id, userId: user.uid, action: 'event_created',
          timestamp: new Date().toISOString(),
          details: `Evento "${data.title}" criado.`,
        });
      }

      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'events');
    }
  };

  const categories = [
    { value: 'reuniao', label: 'Reunião', color: '#3b82f6' },
    { value: 'visita', label: 'Visita', color: '#10b981' },
    { value: 'processo', label: 'Processo', color: '#ef4444' },
    { value: 'evento', label: 'Evento', color: '#a855f7' },
    { value: 'outro', label: 'Outro', color: '#6b7280' },
  ];

  const priorities = [
    { value: 'alta', label: 'Alta', color: '#ef4444' },
    { value: 'media', label: 'Média', color: '#f59e0b' },
    { value: 'baixa', label: 'Baixa', color: '#10b981' },
  ];

  return (
    <div className="min-h-screen -mx-4 -my-4 px-4 py-4 sm:mx-0 sm:my-0 sm:px-0 sm:py-0">
      <div className="dark-card rounded-none sm:rounded-2xl min-h-screen sm:min-h-0">
        <div className="p-4 sm:p-6">
          {/* Header - Mobile Friendly */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 touch-manipulation"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Novo Evento</h1>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>Preencha os dados abaixo</p>
            </div>
            {/* Botão do assistente de voz - sempre visível para feedback */}
            <VoiceButton
              isListening={isListening}
              transcript={transcript}
              onStartListening={isVoiceSupported ? startListening : () => alert('Reconhecimento de voz não suportado neste navegador. Use Chrome ou Edge.')}
              onStopListening={stopListening}
              isSupported={isVoiceSupported}
              error={voiceError || (!isVoiceSupported ? 'Navegador não suporta API de voz' : null)}
            />
          </div>

          {/* Resultado do reconhecimento de voz */}
          {(transcript || voiceApplied) && (
            <div className="mb-4">
              <VoiceResultDisplay
                transcript={transcript}
                isListening={isListening}
                onClear={clearTranscript}
              />
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Título - Large touch target */}
            <div className="form-group">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Título *</label>
              <input 
                type="text" 
                {...register('title')} 
                className="dark-input text-base py-4" 
                placeholder="Ex: Reunião com diretoria" 
              />
              {errors.title && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.title.message}</p>}
            </div>

            {/* Data e Hora - Full width on mobile */}
            <div className="space-y-4">
              <div className="form-group">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar className="w-4 h-4 inline mr-1" />Data *
                </label>
                <input type="date" {...register('date')} className="dark-input text-base py-4 w-full" />
                {errors.date && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.date.message}</p>}
              </div>
              <div className="form-group">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  <Clock className="w-4 h-4 inline mr-1" />Hora *
                </label>
                <input type="time" {...register('time')} className="dark-input text-base py-4 w-full" />
                {errors.time && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.time.message}</p>}
              </div>
            </div>

            {/* Local */}
            <div className="form-group">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                <MapPin className="w-4 h-4 inline mr-1" />Local *
              </label>
              <input 
                type="text" 
                {...register('location')} 
                className="dark-input text-base py-4" 
                placeholder="Endereço ou nome do local" 
              />
              {errors.location && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.location.message}</p>}
            </div>

            {/* Categoria - Mobile friendly buttons */}
            <div className="form-group">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Categoria</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setValue('category', cat.value as any)}
                    className="py-4 px-2 rounded-xl text-sm font-medium transition-all active:scale-95 touch-manipulation choice-btn"
                    style={{
                      background: watch('category') === cat.value ? cat.color : 'var(--bg-input)',
                      color: watch('category') === cat.value ? 'white' : 'var(--text-secondary)',
                      border: watch('category') === cat.value ? 'none' : '1px solid var(--border-subtle)',
                      minHeight: '48px'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prioridade - Mobile friendly buttons */}
            <div className="form-group">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Prioridade</label>
              <div className="grid grid-cols-3 gap-3 choice-buttons">
                {priorities.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setValue('priority', p.value as any)}
                    className="py-4 rounded-xl text-sm font-semibold transition-all active:scale-95 touch-manipulation choice-btn"
                    style={{
                      background: watch('priority') === p.value ? p.color : 'var(--bg-input)',
                      color: watch('priority') === p.value ? 'white' : 'var(--text-secondary)',
                      border: watch('priority') === p.value ? 'none' : '1px solid var(--border-subtle)',
                      minHeight: '52px'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expandable Sections */}
            
            {/* Data de término do evento */}
            <div className="rounded-xl" style={{ background: 'var(--bg-input)' }}>
              <button
                type="button"
                onClick={() => setShowEndDate(!showEndDate)}
                className="w-full flex items-center justify-between p-4 touch-manipulation"
              >
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  <Timer className="w-4 h-4 inline mr-2" />Data de término do evento
                </span>
                <ChevronDown className={`w-5 h-5 transition-transform ${showEndDate ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
              </button>
              {showEndDate && (
                <div className="px-4 pb-4 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Data Final</label>
                      <input type="date" {...register('endDate')} className="dark-input text-base py-3 w-full" min={watch('date')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Hora Final</label>
                      <input type="time" {...register('endTime')} className="dark-input text-base py-3 w-full" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recorrência */}
            <div className="rounded-xl" style={{ background: 'var(--bg-input)' }}>
              <button
                type="button"
                onClick={() => setShowRecurrence(!showRecurrence)}
                className="w-full flex items-center justify-between p-4 touch-manipulation"
              >
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  <Repeat className="w-4 h-4 inline mr-2" />Recorrência
                </span>
                <ChevronDown className={`w-5 h-5 transition-transform ${showRecurrence ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
              </button>
              {showRecurrence && (
                <div className="px-4 pb-4 space-y-3 animate-fade-in">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" {...register('isRecurring')} className="w-5 h-5 rounded accent-[var(--accent)]" />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Este é um evento recorrente</span>
                  </label>
                  {watch('isRecurring') && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Repetir</label>
                        <Controller
                          name="recurrenceType"
                          control={control}
                          render={({ field }) => (
                            <select {...field} className="dark-input text-base py-3 w-full">
                              <option value="daily">Diariamente</option>
                              <option value="weekly">Semanalmente</option>
                              <option value="monthly">Mensalmente</option>
                            </select>
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Vezes</label>
                        <input
                          type="number"
                          {...register('recurrenceCount', { valueAsNumber: true })}
                          min={2}
                          max={52}
                          className="dark-input text-base py-3 w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mais Opções */}
            <div className="rounded-xl" style={{ background: 'var(--bg-input)' }}>
              <button
                type="button"
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                className="w-full flex items-center justify-between p-4 touch-manipulation"
              >
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Mais Opções
                </span>
                <ChevronDown className={`w-5 h-5 transition-transform ${showMoreOptions ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
              </button>
              {showMoreOptions && (
                <div className="px-4 pb-4 space-y-4 animate-fade-in">
                  {/* Descrição */}
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      <FileText className="w-3 h-3 inline mr-1" />Descrição
                    </label>
                    <textarea {...register('description')} rows={3} className="dark-input text-base py-3 resize-none w-full" placeholder="Detalhes adicionais..." />
                  </div>

                  {/* CNPJ e Tags */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>CNPJ</label>
                      <input type="text" {...register('cnpj')} className="dark-input text-base py-3 w-full" placeholder="00.000.000/0000-00" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                        <Tag className="w-3 h-3 inline mr-1" />Tags
                      </label>
                      <input type="text" {...register('tags')} className="dark-input text-base py-3 w-full" placeholder="tag1, tag2" />
                    </div>
                  </div>

                  {/* Notificações */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" {...register('notify24h')} className="w-5 h-5 rounded accent-[var(--accent)]" />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <Bell className="w-4 h-4 inline mr-1" />Avisar 24h antes
                      </span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" {...register('notify1h')} className="w-5 h-5 rounded accent-[var(--accent)]" />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Avisar 1h antes</span>
                    </label>
                  </div>

                  {/* Evento Pessoal */}
                  {(isBoss(user?.email) || isDiretoria(user)) && (
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,111,15,0.08)', border: '1px solid rgba(255,111,15,0.2)' }}>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" {...register('isPersonal')} className="w-5 h-5 rounded accent-[var(--accent)]" />
                        <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                          <Lock className="w-4 h-4" />Evento Pessoal
                        </span>
                      </label>
                      <p className="text-xs mt-2 ml-8" style={{ color: 'var(--text-muted)' }}>
                        Visível apenas para você
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dados do Processo */}
            {category === 'processo' && (
              <div className="rounded-xl" style={{ background: 'var(--bg-input)' }}>
                <button
                  type="button"
                  onClick={() => setShowProcessDetails(!showProcessDetails)}
                  className="w-full flex items-center justify-between p-4 touch-manipulation"
                >
                  <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                    <Scale className="w-4 h-4" />Dados do Processo
                  </span>
                  <ChevronDown className={`w-5 h-5 transition-transform ${showProcessDetails ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
                </button>
                {showProcessDetails && (
                  <div className="px-4 pb-4 space-y-3 animate-fade-in">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Proc. Nº</label>
                      <input type="text" {...register('processDetails.processoNumero')} className="dark-input text-base py-3 w-full" placeholder="0000000-00.0000.0.00.0000" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Fórum</label>
                        <input type="text" {...register('processDetails.forum')} className="dark-input text-base py-3 w-full" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Local</label>
                        <input type="text" {...register('processDetails.localTramitacao')} className="dark-input text-base py-3 w-full" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Autor</label>
                        <input type="text" {...register('processDetails.autor')} className="dark-input text-base py-3 w-full" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Réu</label>
                        <input type="text" {...register('processDetails.reu')} className="dark-input text-base py-3 w-full" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Advogado</label>
                        <input type="text" {...register('processDetails.advogadoNome')} className="dark-input text-base py-3 w-full" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Tel. Advogado</label>
                        <input type="tel" {...register('processDetails.advogadoFone')} className="dark-input text-base py-3 w-full" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Acompanhamento</label>
                      <textarea {...register('processDetails.acompanhamento')} rows={3} className="dark-input text-base py-3 resize-none w-full" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Aviso de dias bloqueados */}
            {blockedDaysWarning.length > 0 && !isBoss(user?.email) && !isDiretoria(user) && !canCreateOnBlockedDays(user) && (
              <div className="p-4 rounded-xl animate-fade-in" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <p className="text-sm" style={{ color: '#ef4444' }}>
                    {blockedDaysWarning.length} dia(s) bloqueado(s) para compromissos pessoais
                  </p>
                </div>
              </div>
            )}

            {/* Ações - Fixed bottom on mobile */}
            <div className="pt-4 pb-4 sm:pb-0">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="flex-1 py-4 rounded-xl text-sm font-medium transition-all active:scale-98 touch-manipulation"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (blockedDaysWarning.length > 0 && !isBoss(user?.email) && !isDiretoria(user) && !canCreateOnBlockedDays(user))}
                  className="flex-1 py-4 rounded-xl text-sm font-bold transition-all active:scale-98 touch-manipulation btn-premium disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : (
                    <>
                      <Check className="w-4 h-4 inline mr-2" />
                      Salvar Evento
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
