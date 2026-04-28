import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, deleteDoc, updateDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, MapPin, User, Tag, FileText, Building2, Trash2, CheckCircle, AlertTriangle, ExternalLink, ArrowLeft, MessageCircle, Printer, Scale, Phone, Lock } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { invalidateFirestoreCache } from '../lib/firestoreCache';
import { isBoss, isDiretoria, canSeePersonalEvents, canUserEditEvent, canUserDeleteEvent } from '../lib/permissions';

export function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchEvent = async () => {
      try {
        const docRef = doc(db, 'events', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const eventData = { id: docSnap.id, ...docSnap.data() } as Event;
          setEvent(eventData);
          
          // Verificar permissões de edição e exclusão
          if (user) {
            const editPermission = await canUserEditEvent(user, eventData.createdBy);
            const deletePermission = await canUserDeleteEvent(user, eventData.createdBy);
            setCanEdit(editPermission);
            setCanDelete(deletePermission);
          }
        } else {
          navigate('/');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `events/${id}`);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id, navigate, user]);

  const handleDelete = async () => {
    if (!event || !id || !user) return;
    setIsDeleting(true);
    try {
      const seriesId = event.seriesId;
      
      if (seriesId) {
        // Buscar todos os eventos da mesma série
        const seriesQuery = query(
          collection(db, 'events'),
          where('seriesId', '==', seriesId)
        );
        const seriesSnapshot = await getDocs(seriesQuery);
        
        // Excluir todos os eventos da série
        const deletePromises = seriesSnapshot.docs.map(async (docSnap) => {
          await deleteDoc(doc(db, 'events', docSnap.id));
        });
        await Promise.all(deletePromises);
        
        // Log activity para a série
        await addDoc(collection(db, 'activity_logs'), {
          eventId: id, userId: user.uid, action: 'event_deleted',
          timestamp: new Date().toISOString(), details: `Série de eventos "${event.title}" excluída (${seriesSnapshot.size} eventos removidos).`
        });
      } else {
        // Evento único, excluir apenas este
        await deleteDoc(doc(db, 'events', id));
        
        await addDoc(collection(db, 'activity_logs'), {
          eventId: id, userId: user.uid, action: 'event_deleted',
          timestamp: new Date().toISOString(), details: `Evento "${event.title}" excluído.`
        });
      }
      
      invalidateFirestoreCache();
      navigate('/', { replace: true });
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir o evento. Verifique suas permissões.");
      setIsDeleting(false);
    }
  };

  const handleComplete = async () => {
    if (!event || !id) return;
    try {
      await updateDoc(doc(db, 'events', id), { status: 'concluido', updatedAt: new Date().toISOString() });
      invalidateFirestoreCache();
      setEvent({ ...event, status: 'concluido' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${id}`);
    }
  };

  // Função helper para formatar datas sem problemas de fuso horário
  const parseEventDate = (dateStr?: string, timeStr = '12:00') => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour = 12, minute = 0] = timeStr.split(':').map(Number);
    const date = new Date(year, month - 1, day, hour, minute);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const formatDateLocal = (dateStr?: string) => {
    const date = parseEventDate(dateStr);
    if (!date) return 'Sem data';
    return date.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const googleCalendarUrl = event ? (() => {
    const toGoogleLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      return `${year}${month}${day}T${hour}${minute}00`;
    };
    const startDate = parseEventDate(event.date, event.time);
    if (!startDate) return '';
    const endDate = parseEventDate(event.endDate || event.date, event.endTime || '')
      || new Date(startDate.getTime() + 60 * 60 * 1000);
    const start = toGoogleLocalDate(startDate);
    const end = toGoogleLocalDate(endDate);
    const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, details: event.description || '', location: event.location, dates: `${start}/${end}` });
    return `https://www.google.com/calendar/render?${params.toString()}`;
  })() : '';

  const googleMapsUrl = event?.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}` : '';

  const whatsappUrl = event ? (() => {
    const categoryLabelsWA: Record<string, string> = {
      reuniao: 'Reunião', visita: 'Visita Sindical', processo: 'Audiência/Processo', evento: 'Evento Institucional', outro: 'Outro'
    };
    const endDateText = event.endDate ? `\n📅 Término: ${formatDateLocal(event.endDate)}` : '';
    const endTimeText = event.endTime ? `\n⏰ Hora Término: ${event.endTime}` : '';
    
    const text = [
      `📅 *${event.title}*`,
      `🗓 Data: ${formatDateLocal(event.date)}`,
      `⏰ Hora: ${event.time}${endTimeText}${endDateText}`,
      `📍 Local: ${event.location}`,
      `📌 Categoria: ${categoryLabelsWA[event.category] || event.category}`,
      event.description ? `\n📝 ${event.description}` : '',
      `\n_Agenda Sind - SindPetShop-SP_`
    ].filter(Boolean).join('\n');
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  })() : '';

  const handlePrint = () => {
    if (!event) return;
    
    const categoryLabels: Record<string, string> = {
      reuniao: 'Reunião', visita: 'Visita Sindical', processo: 'Audiência/Processo', evento: 'Evento Institucional', outro: 'Outro'
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
        
        <div class="info">
          <div class="label">Categoria</div>
          <div class="value">${categoryLabels[event.category] || event.category}</div>
        </div>
        
        <div class="info">
          <div class="label">Data de Início</div>
          <div class="value">${formatDateLocal(event.date)}</div>
        </div>
        
        <div class="info">
          <div class="label">Hora de Início</div>
          <div class="value">${event.time}</div>
        </div>
        
        ${event.endDate ? `
        <div class="info">
          <div class="label">Data de Término</div>
          <div class="value">${formatDateLocal(event.endDate)}</div>
        </div>
        ` : ''}
        
        ${event.endTime ? `
        <div class="info">
          <div class="label">Hora de Término</div>
          <div class="value">${event.endTime}</div>
        </div>
        ` : ''}
        
        <div class="info">
          <div class="label">Local</div>
          <div class="value">${event.location}</div>
        </div>
        
        <div class="info">
          <div class="label">Prioridade</div>
          <div class="value">
            <span class="badge" style="background: ${priority.bg}; color: ${priority.color}">${priority.label}</span>
            <span class="badge" style="background: ${status.bg}; color: ${status.color}">${status.label}</span>
          </div>
        </div>
        
        ${event.cnpj ? `
        <div class="info">
          <div class="label">CNPJ</div>
          <div class="value">${event.cnpj}</div>
        </div>
        ` : ''}
        
        <div class="info">
          <div class="label">Criado por</div>
          <div class="value">${event.creatorName}</div>
        </div>
        
        ${event.description ? `
        <div class="description">
          <div class="label">Descrição</div>
          <div class="value">${event.description}</div>
        </div>
        ` : ''}
        
        ${event.tags && event.tags.length > 0 ? `
        <div class="info">
          <div class="label">Tags</div>
          <div class="value">${event.tags.join(', ')}</div>
        </div>
        ` : ''}
        
        ${event.category === 'processo' && event.processDetails ? `
        <div style="margin-top: 20px; border-top: 2px solid #ff6f0f; padding-top: 20px;">
          <h2 style="color: #ff6f0f; font-size: 16px; margin-bottom: 15px;">Dados do Processo</h2>
          
          ${event.processDetails.processoNumero ? `
          <div class="info">
            <div class="label">Proc. Nº</div>
            <div class="value">${event.processDetails.processoNumero}</div>
          </div>
          ` : ''}
          
          ${event.processDetails.forum ? `
          <div class="info">
            <div class="label">Fórum</div>
            <div class="value">${event.processDetails.forum}</div>
          </div>
          ` : ''}
          
          ${event.processDetails.localTramitacao ? `
          <div class="info">
            <div class="label">Local de Tramitação</div>
            <div class="value">${event.processDetails.localTramitacao}</div>
          </div>
          ` : ''}
          
          ${event.processDetails.dataDistribuicao ? `
          <div class="info">
            <div class="label">Data da Distribuição</div>
            <div class="value">${new Date(event.processDetails.dataDistribuicao).toLocaleDateString('pt-BR')}</div>
          </div>
          ` : ''}
          
          ${event.processDetails.autor ? `
          <div class="info">
            <div class="label">Autor</div>
            <div class="value">${event.processDetails.autor}</div>
          </div>
          ` : ''}
          
          ${event.processDetails.reu ? `
          <div class="info">
            <div class="label">Réu</div>
            <div class="value">${event.processDetails.reu}</div>
          </div>
          ` : ''}
          
          ${event.processDetails.nomePartes ? `
          <div class="info">
            <div class="label">Nome das Partes</div>
            <div class="value">${event.processDetails.nomePartes}</div>
          </div>
          ` : ''}
          
          ${event.processDetails.acao ? `
          <div class="info">
            <div class="label">Ação</div>
            <div class="value">${event.processDetails.acao}</div>
          </div>
          ` : ''}
          
          ${event.processDetails.advogadoNome ? `
          <div class="info">
            <div class="label">Advogado</div>
            <div class="value">${event.processDetails.advogadoNome}</div>
          </div>
          ` : ''}
          
          ${event.processDetails.advogadoFone ? `
          <div class="info">
            <div class="label">Telefone do Advogado</div>
            <div class="value">${event.processDetails.advogadoFone}</div>
          </div>
          ` : ''}
          
          ${event.processDetails.acompanhamento ? `
          <div class="description">
            <div class="label">Acompanhamento Processual</div>
            <div class="value">${event.processDetails.acompanhamento}</div>
          </div>
          ` : ''}
        </div>
        ` : ''}
        
        <div class="footer">
          <p>Agenda Sind - SindPetShop-SP</p>
          <p>Impresso em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!event) return null;

  // Verificar se o usuário pode ver este evento pessoal
  const canSeePersonalEvent = (): boolean => {
    if (!event.isPersonal) return true;
    // O criador sempre pode ver
    if (user?.uid === event.createdBy) return true;
    // Super admins e boss sempre veem tudo
    if (isBoss(user?.email) || isDiretoria(user)) return true;
    // Verificar se tem permissão para ver eventos pessoais
    if (canSeePersonalEvents(user)) return true;
    return false;
  };

  // Se não pode ver o evento pessoal, mostrar mensagem de acesso negado
  if (!canSeePersonalEvent()) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-fade-in pb-24 lg:pb-6">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-semibold transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'}
        >
          <ArrowLeft className="w-4 h-4" />Voltar
        </button>

        {/* Access Denied Card */}
        <div className="dark-card p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,111,15,0.15)' }}>
            <Lock className="w-8 h-8" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Compromisso Pessoal
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Este é um compromisso pessoal e não está disponível para outros usuários.
          </p>
          <button 
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

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

  const InfoRow = ({ icon: Icon, label, value, extra }: { icon: any; label: string; value: string; extra?: React.ReactNode }) => (
    <div className="flex items-start gap-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-soft)' }}>
        <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {extra}
      </div>
    </div>
  );

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-4 animate-fade-in pb-24 lg:pb-6">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-semibold transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'}
        >
          <ArrowLeft className="w-4 h-4" />Voltar
        </button>

        {/* Header Card */}
        <div className="dark-card p-4 sm:p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: event.color || 'linear-gradient(90deg,var(--accent),#ff9a0d)' }} />

          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{event.title}</h1>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: priority.bg, color: priority.color }}>{priority.label}</span>
                <span className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                <span className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{categoryLabels[event.category] || event.category}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 action-buttons">
              {canEdit && event.status !== 'concluido' && (
                <button onClick={handleComplete} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all touch-target" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <CheckCircle className="w-4 h-4" />Concluir
                </button>
              )}
              {canDelete && (
                <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all touch-target" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <Trash2 className="w-4 h-4" />Excluir
                </button>
              )}
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all touch-target" style={{ background: 'rgba(100,116,139,0.1)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)' }}>
                <Printer className="w-4 h-4" />Imprimir
              </button>
              <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all touch-target" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border-color)' }}>
                <Calendar className="w-4 h-4" />Agenda
              </a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all touch-target" style={{ background: 'rgba(37,211,102,0.1)', color: '#25d366', border: '1px solid rgba(37,211,102,0.2)' }}>
                <MessageCircle className="w-4 h-4" />WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Details Card */}
        <div className="dark-card p-4 sm:p-6 space-y-0">
          <div className="info-row">
            <InfoRow icon={Calendar} label="Data de Início" value={formatDateLocal(event.date)} />
            <InfoRow icon={Clock} label="Hora de Início" value={event.time} />
            {(event.endDate || event.endTime) && (
              <>
                {event.endDate && <InfoRow icon={Calendar} label="Data de Término" value={formatDateLocal(event.endDate)} />}
                {event.endTime && <InfoRow icon={Clock} label="Hora de Término" value={event.endTime} />}
              </>
            )}
            <InfoRow icon={MapPin} label="Local" value={event.location}
              extra={event.location ? (
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold mt-1 transition-colors" style={{ color: 'var(--accent)' }}>
                  <ExternalLink className="w-3 h-3" />Ver no Google Maps
                </a>
              ) : undefined}
            />
            <InfoRow icon={User} label="Criado por" value={event.creatorName} />
            {event.cnpj && <InfoRow icon={Building2} label="CNPJ" value={event.cnpj} />}
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div className="dark-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Descrição</p>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{event.description}</p>
          </div>
        )}

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="dark-card p-4">
            <div className="flex items-center flex-wrap gap-2">
              <Tag className="w-4 h-4 mr-1" style={{ color: 'var(--text-muted)' }} />
              {event.tags.map((tag, i) => (
                <span key={i} className="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Process Details - Only show when category is 'processo' */}
        {event.category === 'processo' && event.processDetails && (
          <div className="dark-card p-6 space-y-0">
            <div className="flex items-center gap-2 pb-4 mb-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <Scale className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Dados do Processo</p>
            </div>
            
            {event.processDetails.processoNumero && (
              <InfoRow icon={FileText} label="Proc. Nº" value={event.processDetails.processoNumero} />
            )}
            {event.processDetails.forum && (
              <InfoRow icon={MapPin} label="Fórum" value={event.processDetails.forum} />
            )}
            {event.processDetails.localTramitacao && (
              <InfoRow icon={MapPin} label="Local de Tramitação" value={event.processDetails.localTramitacao} />
            )}
            {event.processDetails.dataDistribuicao && (
              <InfoRow icon={Calendar} label="Data da Distribuição" value={formatDateLocal(event.processDetails.dataDistribuicao)} />
            )}
            {event.processDetails.autor && (
              <InfoRow icon={User} label="Autor" value={event.processDetails.autor} />
            )}
            {event.processDetails.reu && (
              <InfoRow icon={User} label="Réu" value={event.processDetails.reu} />
            )}
            {event.processDetails.nomePartes && (
              <InfoRow icon={User} label="Nome das Partes" value={event.processDetails.nomePartes} />
            )}
            {event.processDetails.acao && (
              <InfoRow icon={FileText} label="Ação" value={event.processDetails.acao} />
            )}
            {event.processDetails.advogadoNome && (
              <InfoRow icon={User} label="Advogado" value={event.processDetails.advogadoNome} />
            )}
            {event.processDetails.advogadoFone && (
              <InfoRow icon={Phone} label="Telefone do Advogado" value={event.processDetails.advogadoFone} />
            )}
          </div>
        )}

        {/* Acompanhamento Processual */}
        {event.category === 'processo' && event.processDetails?.acompanhamento && (
          <div className="dark-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Acompanhamento Processual</p>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{event.processDetails.acompanhamento}</p>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Excluir Evento</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Tem certeza que deseja excluir <strong style={{ color: 'var(--text-primary)' }}>"{event.title}"</strong>? Esta ação não pode ser revertida.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
