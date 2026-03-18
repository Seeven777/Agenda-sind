import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, deleteDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, MapPin, User, Tag, FileText, Building2, Trash2, CheckCircle, Bookmark, AlertTriangle, ExternalLink, ArrowLeft } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';

export function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchEvent = async () => {
      try {
        const docRef = doc(db, 'events', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setEvent({ id: docSnap.id, ...docSnap.data() } as Event);
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
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!event || !id || !user) return;
    setIsDeleting(true);
    try {
      try {
        await addDoc(collection(db, 'activity_logs'), {
          eventId: id, userId: user.uid, action: 'event_deleted',
          timestamp: new Date().toISOString(), details: `Evento "${event.title}" excluído.`
        });
      } catch {}
      await deleteDoc(doc(db, 'events', id));
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
      setEvent({ ...event, status: 'concluido' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${id}`);
    }
  };

  const googleCalendarUrl = event ? (() => {
    const start = event.date.replace(/-/g, '') + 'T' + event.time.replace(/:/g, '') + '00';
    const endDate = new Date(new Date(`${event.date}T${event.time}`).getTime() + 60 * 60 * 1000);
    const end = endDate.toISOString().replace(/-|:|\.\d\d\d/g, '').split('Z')[0];
    const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, details: event.description || '', location: event.location, dates: `${start}/${end}` });
    return `https://www.google.com/calendar/render?${params.toString()}`;
  })() : '';

  const googleMapsUrl = event?.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}` : '';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!event) return null;

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

  const canEdit = user?.role === 'admin' || user?.uid === event.createdBy;
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
        <div className="dark-card p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: event.color || 'linear-gradient(90deg,var(--accent),#ff9a0d)' }} />

          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{event.title}</h1>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: priority.bg, color: priority.color }}>{priority.label}</span>
                <span className="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                <span className="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{categoryLabels[event.category] || event.category}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && event.status !== 'concluido' && (
                <button onClick={handleComplete} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <CheckCircle className="w-4 h-4" />Concluir
                </button>
              )}
              {canEdit && (
                <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <Trash2 className="w-4 h-4" />Excluir
                </button>
              )}
              <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border-color)' }}>
                <Calendar className="w-4 h-4" />Google Calendar
              </a>
            </div>
          </div>
        </div>

        {/* Details Card */}
        <div className="dark-card p-6 space-y-0">
          <InfoRow icon={Calendar} label="Data" value={new Date(event.date).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
          <InfoRow icon={Clock} label="Hora" value={event.time} />
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
