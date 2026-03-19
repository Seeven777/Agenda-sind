import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { Calendar, Clock, MapPin, Tag, FileText, Briefcase, Bell, Repeat, Palette, Timer, Scale, User, Phone, MapPinIcon, Lock, AlertTriangle } from 'lucide-react';
import { isBoss, isDiretoria, canCreateOnBlockedDays } from '../lib/permissions';

// Schema para detalhes do processo
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

type ProcessDetailsFormData = z.infer<typeof processDetailsSchema>;

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
  isPersonal: z.boolean().optional(), // Evento pessoal do patrão
  // Campos de processo
  processDetails: processDetailsSchema.optional(),
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

// Generate dates until end date (for events that span multiple days)
function generateDatesUntilEndDate(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [blockedDaysWarning, setBlockedDaysWarning] = useState<string[]>([]);

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<EventFormData>({
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
      hasEndDate: false,
    }
  });

  const isRecurring = watch('isRecurring');
  const recurrenceType = watch('recurrenceType');
  const hasEndDate = watch('hasEndDate');
  const category = watch('category');
  const selectedDate = watch('date');
  const selectedEndDate = watch('endDate');

  // Verificar se as datas selecionadas estão bloqueadas
  useEffect(() => {
    const checkBlockedDays = async () => {
      if (!user) return;
      
      const datesToCheck: string[] = [selectedDate];
      
      // Se tem data de término, incluir todas as datas até lá
      if (hasEndDate && selectedEndDate) {
        const dates = generateDatesUntilEndDate(selectedDate, selectedEndDate);
        datesToCheck.push(...dates);
      }
      
      // Se é recorrente, incluir as datas
      if (isRecurring && recurrenceType && recurrenceType !== 'none') {
        const count = watch('recurrenceCount') || 4;
        const dates = generateRecurringDates(selectedDate, recurrenceType, count);
        datesToCheck.push(...dates);
      }
      
      // Buscar eventos pessoais de outros usuários
      const blockedDates: string[] = [];
      for (const date of datesToCheck) {
        if (!date) continue;
        const q = query(
          collection(db, 'events'),
          where('date', '==', date),
          where('isPersonal', '==', true)
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          // Se o evento pessoal não é do usuário atual e o usuário não tem permissão
          if (data.createdBy !== user.uid && !isBoss(user.email) && !isDiretoria(user) && !canCreateOnBlockedDays(user)) {
            if (!blockedDates.includes(date)) {
              blockedDates.push(date);
            }
          }
        });
      }
      
      setBlockedDaysWarning(blockedDates);
    };
    
    if (selectedDate) {
      checkBlockedDays();
    }
  }, [selectedDate, selectedEndDate, hasEndDate, isRecurring, recurrenceType, user]);

  const handleHasEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowEndDate(e.target.checked);
    setValue('hasEndDate', e.target.checked);
    if (!e.target.checked) {
      setValue('endDate', '');
      setValue('endTime', '');
    }
  };

  const onSubmit = async (data: EventFormData) => {
    if (!user) return;

    // Verificar se há dias bloqueados
    if (blockedDaysWarning.length > 0 && !isBoss(user.email) && !isDiretoria(user) && !canCreateOnBlockedDays(user)) {
      const formattedDates = blockedDaysWarning.map(d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')).join(', ');
      alert(`Você não pode criar eventos nos seguintes dias que estão reservados para compromissos pessoais:\n${formattedDates}`);
      return;
    }

    try {
      const tagsArray = data.tags
        ? data.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : [];

      // Preparar dados do processo se a categoria for 'processo'
      const eventData: Record<string, any> = {
        title: data.title,
        date: data.date,
        time: data.time,
        endDate: data.endDate || '',
        endTime: data.endTime || '',
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
        seriesUpdateAll: true, // Por padrão, atualizações se aplicam a toda a série
        // Campo de evento pessoal - apenas super admins e diretoria podem marcar
        isPersonal: (isBoss(user.email) || isDiretoria(user)) ? (data.isPersonal || false) : false,
      };

      // Apenas adicionar processDetails se for categoria 'processo'
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
      
      // Verifica se tem data de término e gera eventos para cada dia
      const hasEnd = data.hasEndDate && data.endDate;
      
      // Gerar um ID único para agrupar eventos da mesma série
      const seriesId = `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (isReallyRecurring) {
        const count = data.recurrenceCount || 4;
        const dates = generateRecurringDates(data.date, data.recurrenceType!, count);
        for (const dateStr of dates) {
          const evData = { ...eventData, date: dateStr, seriesId };
          const docRef = await addDoc(collection(db, 'events'), evData);
          await addDoc(collection(db, 'activity_logs'), {
            eventId: docRef.id,
            userId: user.uid,
            action: 'event_created',
            timestamp: new Date().toISOString(),
            details: `Evento recorrente "${data.title}" criado para ${dateStr}.`,
          });
        }
      } else if (hasEnd) {
        // Gera um evento para cada dia até a data de término
        const dates = generateDatesUntilEndDate(data.date, data.endDate!);
        for (const dateStr of dates) {
          const evData = { ...eventData, date: dateStr, seriesId };
          const docRef = await addDoc(collection(db, 'events'), evData);
          await addDoc(collection(db, 'activity_logs'), {
            eventId: docRef.id,
            userId: user.uid,
            action: 'event_created',
            timestamp: new Date().toISOString(),
            details: `Evento "${data.title}" criado para ${dateStr} (até ${data.endDate}).`,
          });
        }
      } else {
        const docRef = await addDoc(collection(db, 'events'), eventData);
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

          {/* Date & Time - Início */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Data de Início *</span>
              </label>
              <input type="date" {...register('date')} className="dark-input" />
              {errors.date && <p className={errorClass} style={{ color: 'var(--danger)' }}>{errors.date.message}</p>}
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Hora de Início *</span>
              </label>
              <input type="time" {...register('time')} className="dark-input" />
              {errors.time && <p className={errorClass} style={{ color: 'var(--danger)' }}>{errors.time.message}</p>}
            </div>
          </div>

          {/* Evento com término - Checkbox */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="hasEndDate"
                {...register('hasEndDate')}
                className="w-4 h-4 rounded accent-orange-500"
                onChange={handleHasEndDateChange}
              />
              <label htmlFor="hasEndDate" className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Timer className="w-4 h-4" style={{ color: 'var(--accent)' }} />Evento com data de término
              </label>
            </div>
            <p className="text-xs mt-2 ml-7" style={{ color: 'var(--text-muted)' }}>
              Marque esta opção se o evento acontece em múltiplos dias. Será criado um card para cada dia.
            </p>

            {/* Date & Time - Fim (only shown when checkbox is checked) */}
            {showEndDate && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 animate-fade-in">
                <div>
                  <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Data de Término</span>
                  </label>
                  <input 
                    type="date" 
                    {...register('endDate')} 
                    className="dark-input" 
                    min={watch('date')}
                  />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Hora de Término</span>
                  </label>
                  <input type="time" {...register('endTime')} className="dark-input" />
                </div>
              </div>
            )}
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

          {/* Processo Details - Only show when category is 'processo' */}
          {category === 'processo' && (
            <div className="rounded-xl p-5 space-y-5 animate-fade-in" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <Scale className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                  Dados do Processo
                </h3>
              </div>

              {/* Número do Processo */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" />Proc. Nº</span>
                </label>
                <input 
                  type="text" 
                  {...register('processDetails.processoNumero')} 
                  className="dark-input" 
                  placeholder="0000000-00.0000.0.00.0000"
                />
              </div>

              {/* Foro */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Fórum</span>
                </label>
                <input 
                  type="text" 
                  {...register('processDetails.forum')} 
                  className="dark-input" 
                  placeholder="Nome do Fórum"
                />
              </div>

              {/* Local de Tramitação */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><MapPinIcon className="w-3 h-3" />Local de Tramitação</span>
                </label>
                <input 
                  type="text" 
                  {...register('processDetails.localTramitacao')} 
                  className="dark-input" 
                  placeholder="Cidade/Estado"
                />
              </div>

              {/* Data de Distribuição */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Data da Distribuição</span>
                </label>
                <input 
                  type="date" 
                  {...register('processDetails.dataDistribuicao')} 
                  className="dark-input" 
                />
              </div>

              {/* Autor e Réu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />Autor</span>
                  </label>
                  <input 
                    type="text" 
                    {...register('processDetails.autor')} 
                    className="dark-input" 
                    placeholder="Nome do autor"
                  />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />Réu</span>
                  </label>
                  <input 
                    type="text" 
                    {...register('processDetails.reu')} 
                    className="dark-input" 
                    placeholder="Nome do réu"
                  />
                </div>
              </div>

              {/* Nome das Partes */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />Nome das Partes</span>
                </label>
                <input 
                  type="text" 
                  {...register('processDetails.nomePartes')} 
                  className="dark-input" 
                  placeholder="Nomes completos das partes envolvidas"
                />
              </div>

              {/* Tipo de Ação */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" />Ação</span>
                </label>
                <input 
                  type="text" 
                  {...register('processDetails.acao')} 
                  className="dark-input" 
                  placeholder="Tipo de ação (Ex: Trabalhista, Civil)"
                />
              </div>

              {/* Advogado - Nome e Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />Nome do Advogado</span>
                  </label>
                  <input 
                    type="text" 
                    {...register('processDetails.advogadoNome')} 
                    className="dark-input" 
                    placeholder="Nome completo do advogado"
                  />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />Telefone do Advogado</span>
                  </label>
                  <input 
                    type="tel" 
                    {...register('processDetails.advogadoFone')} 
                    className="dark-input" 
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              {/* Acompanhamento Processual */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" />Acompanhamento Processual</span>
                </label>
                <textarea 
                  {...register('processDetails.acompanhamento')} 
                  rows={4} 
                  className="dark-input resize-none" 
                  placeholder="Observações sobre o andamento do processo, próximos passos, decisões, etc."
                />
              </div>
            </div>
          )}

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

          {/* Evento Pessoal - Para diretoria e super admins */}
          {(isBoss(user?.email) || isDiretoria(user)) && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255, 111, 15, 0.08)', border: '1px solid rgba(255, 111, 15, 0.2)' }}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPersonal"
                  {...register('isPersonal')}
                  className="w-4 h-4 rounded accent-orange-500"
                />
                <label htmlFor="isPersonal" className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                  <Lock className="w-4 h-4" />
                  Evento Pessoal
                </label>
              </div>
              <p className="text-xs mt-2 ml-7" style={{ color: 'var(--text-muted)' }}>
                Marque esta opção para tornar o evento visível apenas para você. Outros usuários verão que o dia está reservado, mas sem detalhes.
              </p>
            </div>
          )}

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

          {/* Aviso de dias bloqueados */}
          {blockedDaysWarning.length > 0 && !isBoss(user?.email) && !isDiretoria(user) && !canCreateOnBlockedDays(user) && (
            <div className="rounded-xl p-4 animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: '#ef4444' }}>
                    Dias bloqueados
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Os seguintes dias estão reservados para compromissos pessoais e você não pode criar eventos neles:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {blockedDaysWarning.slice(0, 5).map((date, i) => (
                      <li key={i} className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        • {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </li>
                    ))}
                    {blockedDaysWarning.length > 5 && (
                      <li className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        ...e mais {blockedDaysWarning.length - 5} dia(s)
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

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
              disabled={isSubmitting || (blockedDaysWarning.length > 0 && !isBoss(user?.email) && !isDiretoria(user) && !canCreateOnBlockedDays(user))}
              className="btn-premium w-full sm:w-auto px-6 py-2.5 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : (hasEndDate && watch('endDate') ? `Criar múltiplos eventos` : (isRecurring && recurrenceType !== 'none' ? `Criar ${watch('recurrenceCount') || 4} eventos` : 'Salvar Evento'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
