import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, deleteDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, MapPin, User, Tag, FileText, Building2, Trash2, CheckCircle, Bookmark, AlertTriangle, ExternalLink } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { cn } from '../lib/utils';

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
          console.error("Documento não encontrado:", id);
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
    if (!event || !id || !user) {
      console.error("Dados insuficientes para exclusão:", { event: !!event, id: !!id, user: !!user });
      return;
    }
    
    setIsDeleting(true);
    try {
      // Registrar log antes de excluir (enquanto o evento ainda existe para referência)
      try {
        await addDoc(collection(db, 'activity_logs'), {
          eventId: id,
          userId: user.uid,
          action: 'event_deleted',
          timestamp: new Date().toISOString(),
          details: `Evento "${event.title}" excluído.`
        });
      } catch (logError) {
        console.warn("Erro ao registrar log de exclusão:", logError);
      }

      await deleteDoc(doc(db, 'events', id));
      setShowDeleteModal(false);
      
      // Feedback visual antes de navegar
      navigate('/', { replace: true });
    } catch (error) {
      console.error("Erro ao excluir documento:", error);
      alert("Erro ao excluir o evento. Verifique suas permissões.");
      setIsDeleting(false);
    }
  };

  const handleComplete = async () => {
    if (!event || !id || !user) return;

    try {
      await updateDoc(doc(db, 'events', id), {
        status: 'concluido',
        updatedAt: new Date().toISOString()
      });
      setEvent({ ...event, status: 'concluido' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${id}`);
    }
  };

  const googleCalendarUrl = event ? (() => {
    const start = event.date.replace(/-/g, '') + 'T' + event.time.replace(/:/g, '') + '00';
    const endDate = new Date(new Date(`${event.date}T${event.time}`).getTime() + 60 * 60 * 1000);
    const end = endDate.toISOString().replace(/-|:|\.\d\d\d/g, '').split('Z')[0];
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      details: event.description || '',
      location: event.location,
      dates: `${start}/${end}`,
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;
  })() : '';

  const googleMapsUrl = event?.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}` : '';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6f0f]"></div>
      </div>
    );
  }

  if (!event) return null;

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
    visita: 'Visita Sindical',
    processo: 'Audiência/Processo',
    evento: 'Evento Institucional',
    outro: 'Outro'
  };

  const canEdit = user?.role === 'admin' || user?.uid === event.createdBy;

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 bg-gradient-to-r from-gray-50 to-white">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">{event.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border", priorityColors[event.priority])}>
                  {event.priority}
                </span>
                <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider", statusColors[event.status])}>
                  {event.status}
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <>
                  {event.status !== 'concluido' && (
                    <button
                      onClick={handleComplete}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-xl text-white bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg transition-all"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Concluir
                    </button>
                  )}
                  <button
                    onClick={() => {
                      console.log("Abrindo modal de exclusão");
                      setShowDeleteModal(true);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-xl text-white bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </button>
                </>
              )}
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 shadow-sm hover:shadow-md transition-all hover:border-[#ff6f0f] hover:text-[#ff6f0f]"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Google Calendar
              </a>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start group">
                <div className="p-2 bg-orange-50 rounded-lg mr-4 group-hover:bg-orange-100 transition-colors">
                  <Calendar className="w-5 h-5 text-[#ff6f0f]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Data</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {new Date(event.date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="flex items-start group">
                <div className="p-2 bg-orange-50 rounded-lg mr-4 group-hover:bg-orange-100 transition-colors">
                  <Clock className="w-5 h-5 text-[#ff6f0f]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hora</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{event.time}</p>
                </div>
              </div>

              <div className="flex items-start group">
                <div className="p-2 bg-orange-50 rounded-lg mr-4 group-hover:bg-orange-100 transition-colors">
                  <MapPin className="w-5 h-5 text-[#ff6f0f]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Local</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900 leading-tight">{event.location}</p>
                  {event.location && (
                    <a 
                      href={googleMapsUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-sm text-[#ff6f0f] hover:underline font-medium"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Ver no Google Maps
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-start group">
                <div className="p-2 bg-blue-50 rounded-lg mr-4 group-hover:bg-blue-100 transition-colors">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Criado por</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{event.creatorName}</p>
                </div>
              </div>
              
              <div className="flex items-start group">
                <div className="p-2 bg-purple-50 rounded-lg mr-4 group-hover:bg-purple-100 transition-colors">
                  <Bookmark className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Categoria</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{categoryLabels[event.category] || event.category}</p>
                </div>
              </div>

              {event.cnpj && (
                <div className="flex items-start group">
                  <div className="p-2 bg-emerald-50 rounded-lg mr-4 group-hover:bg-emerald-100 transition-colors">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">CNPJ</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{event.cnpj}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {event.description && (
            <div className="px-4 sm:px-6 py-8 border-t border-gray-100 bg-gray-50/30">
              <div className="flex items-start mb-4">
                <div className="p-2 bg-white rounded-lg shadow-sm mr-4">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pt-2">Descrição</p>
              </div>
              <div className="pl-14">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          )}

          {event.tags && event.tags.length > 0 && (
            <div className="px-4 sm:px-6 py-6 border-t border-gray-100">
              <div className="flex items-center flex-wrap gap-2">
                <Tag className="w-4 h-4 text-gray-400 mr-2" />
                {event.tags.map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500/80 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setShowDeleteModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-white/20">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-xl font-bold text-gray-900" id="modal-title">
                      Excluir Evento
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 font-medium leading-relaxed">
                        Tem certeza que deseja excluir o evento "{event.title}"? Esta ação é definitiva e não pode ser revertida.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-4 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-lg shadow-red-500/20 px-6 py-2 bg-red-600 text-base font-bold text-white hover:bg-red-700 transition-all sm:w-auto sm:text-sm disabled:opacity-50"
                  onClick={(e) => {
                    console.log("Confirmando exclusão...");
                    handleDelete();
                  }}
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-6 py-2 bg-white text-base font-bold text-gray-700 hover:bg-gray-50 transition-all sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
