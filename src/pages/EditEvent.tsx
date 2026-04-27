import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { Calendar, Clock, MapPin, Tag, FileText, Briefcase, Bell, Palette, ArrowLeft, Scale, User, Phone, MapPinIcon } from 'lucide-react';
import { canUserEditEvent } from '../lib/permissions';

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

const eventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  date: z.string().min(1, 'Data é obrigatória'),
  time: z.string().min(1, 'Hora é obrigatória'),
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
  recurrenceCount: z.number().optional(),
  processDetails: processDetailsSchema.optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

export function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<EventFormData | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });

  const category = watch('category');

  useEffect(() => {
    if (!id || !user) return;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        const docSnap = await getDoc(doc(db, 'events', id));
        if (docSnap.exists()) {
          const eventData = docSnap.data();
          const eventCreatorId = eventData.createdBy;
          
          // Verificar se o usuário pode editar este evento
          const canUserEdit = await canUserEditEvent(user, eventCreatorId);
          if (canUserEdit) {
            const data = eventData as EventFormData;
            setInitialData(data);
            reset(data);
            setAccessDenied(false);
          } else {
            setAccessDenied(true);
          }
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

      const updateData: Record<string, any> = {
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
        updatedAt: new Date().toISOString(),
      };

      // Campos que NÃO devem ser propagados para toda a série (cada evento tem seu próprio date)
      // Apenas adicionar processDetails se for categoria 'processo'
      if (data.category === 'processo' && data.processDetails) {
        updateData.processDetails = {
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
      } else {
        updateData.processDetails = deleteField();
      }

      // Buscar o evento original para verificar se tem seriesId
      const originalEvent = await getDoc(doc(db, 'events', id));
      const originalData = originalEvent.data();
      const seriesId = originalData?.seriesId;

      if (seriesId) {
        // Buscar todos os eventos da mesma série
        const seriesQuery = query(
          collection(db, 'events'),
          where('seriesId', '==', seriesId)
        );
        const seriesSnapshot = await getDocs(seriesQuery);

        // Atualizar cada evento da série, mantendo a data original de cada um
        const updatePromises = seriesSnapshot.docs.map(async (docSnap) => {
          const evData = { ...updateData };
          // Manter a data original do evento na série
          evData.date = docSnap.data().date;
          evData.endDate = docSnap.data().endDate || '';
          await updateDoc(doc(db, 'events', docSnap.id), evData);
        });

        await Promise.all(updatePromises);

        // Log activity para a série
        await addDoc(collection(db, 'activity_logs'), {
          eventId: id,
          userId: user.uid,
          action: 'event_updated',
          timestamp: new Date().toISOString(),
          details: `Evento da série "${data.title}" atualizado (${seriesSnapshot.size} eventos afetados).`,
        });
      } else {
        // Evento único, atualizar apenas este
        await updateDoc(doc(db, 'events', id), updateData);

        // Log activity
        await addDoc(collection(db, 'activity_logs'), {
          eventId: id,
          userId: user.uid,
          action: 'event_updated',
          timestamp: new Date().toISOString(),
          details: `Evento "${data.title}" atualizado.`,
        });
      }

      navigate(`/events/${id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'events');
    }
  };

  const labelClass = "block text-xs font-bold uppercase tracking-wider mb-2";
  const errorClass = "mt-1 text-xs font-medium";

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!initialData) {
    return (
      <div className="dark-card p-6 text-center">
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {accessDenied ? 'Sem permissão para editar' : 'Evento não encontrado'}
        </h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {accessDenied ? 'Você não tem permissão para alterar este evento.' : 'Não foi possível carregar os dados deste evento.'}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="dark-card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-8" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
            <Calendar className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Editar Evento</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Atualize os dados</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>Título *</label>
            <input type="text" {...register('title')} className="dark-input" />
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

          {/* Date & Time - Fim */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Data de Término</span>
              </label>
              <input type="date" {...register('endDate')} className="dark-input" placeholder="Opcional" />
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Hora de Término</span>
              </label>
              <input type="time" {...register('endTime')} className="dark-input" placeholder="Opcional" />
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

          {/* Processo Details - Only show when category is 'processo' */}
          {category === 'processo' && (
            <div className="rounded-xl p-5 space-y-5" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
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
              <input type="text" {...register('tags')} className="dark-input" placeholder="separar por vírgula" />
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
            <label className={`${labelClass} flex items-center gap-1`} style={{ color: 'var(--text-muted)' }}>
              <Bell className="w-3 h-3" />Notificações
            </label>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="notify24h" {...register('notify24h')} className="w-4 h-4 rounded accent-orange-500" />
              <label htmlFor="notify24h" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>24h antes</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="notify1h" {...register('notify1h')} className="w-4 h-4 rounded accent-orange-500" />
              <label htmlFor="notify1h" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>1h antes</label>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><Palette className="w-3 h-3" />Cor</span>
            </label>
            <div className="flex items-center gap-3">
              <input type="color" {...register('color')} className="h-9 w-14 rounded-lg border-none cursor-pointer" />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cor destaque</span>
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
