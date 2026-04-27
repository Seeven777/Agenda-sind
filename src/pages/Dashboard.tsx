import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { EventCard } from '../components/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { isBoss, isDiretoria, canSeePersonalEvents } from '../lib/permissions';
import { Plus, Calendar, Clock, MapPin, Navigation2, Lock, Filter, X, FileText, Download, TrendingUp, BarChart3, ChevronDown, Eye, CheckCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import jsPDF from 'jspdf';

export function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [allActiveEvents, setAllActiveEvents] = useState<Event[]>([]);
  const [monthlyEvents, setMonthlyEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportData, setReportData] = useState<{
    total: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    byStatus: Record<string, number>;
    events: Event[];
  } | null>(null);

  // Função helper para obter string de data sem problemas de fuso
  const getDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Função para verificar se uma data está no mês atual
  const isInCurrentMonth = (dateStr: string) => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return isWithinInterval(date, { start, end });
  };

  useEffect(() => {
    if (!user) return;
    
    const todayStr = getDateString(new Date());

    const todayQuery = query(collection(db, 'events'), where('date', '==', todayStr), orderBy('time', 'asc'));
    const upcomingQuery = query(collection(db, 'events'), where('date', '>', todayStr), orderBy('date', 'asc'), orderBy('time', 'asc'), limit(10));
    const activeQuery = query(collection(db, 'events'), where('status', '==', 'agendado'));
    const onEventsError = (error: unknown) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
      setLoading(false);
    };

    const u1 = onSnapshot(todayQuery, (s) => setTodayEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))), onEventsError);
    const u2 = onSnapshot(upcomingQuery, (s) => setUpcomingEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))), onEventsError);
    const u3 = onSnapshot(activeQuery, (s) => { 
      const events = s.docs.map(d => ({ id: d.id, ...d.data() } as Event));
      setAllActiveEvents(events);
      // Filtrar apenas eventos do mês atual
      const monthEvents = events.filter(e => isInCurrentMonth(e.date));
      setMonthlyEvents(monthEvents);
      setLoading(false);
    }, onEventsError);

    return () => { u1(); u2(); u3(); };
  }, [user]);

  const shouldHideEventCompletely = (event: Event): boolean => {
    if (!event.isPersonal) return false;
    if (user?.uid === event.createdBy) return false;
    if (isBoss(user?.email) || isDiretoria(user)) return false;
    if (canSeePersonalEvents(user)) return false;
    return true;
  };

  const personalEventDays = new Set(
    allActiveEvents
      .filter(e => e.isPersonal && e.createdBy !== user?.uid && user && !isBoss(user.email) && !isDiretoria(user) && !canSeePersonalEvents(user))
      .map(e => e.date)
  );

  const todayStr = getDateString(new Date());

  const basicFilterFn = (e: Event) => !shouldHideEventCompletely(e);

  const fullFilterFn = (e: Event) => {
    if (shouldHideEventCompletely(e)) return false;
    if (filterCategory === 'all') return true;
    if (filterCategory === 'outro') return !['reuniao', 'processo', 'visita', 'evento'].includes(e.category);
    return e.category === filterCategory;
  };

  // Filtrar eventos visíveis do mês atual
  const visibleMonthlyEvents = monthlyEvents.filter(basicFilterFn);
  const filteredAllEvents = allActiveEvents.filter(fullFilterFn);
  const todayFiltered = todayEvents.filter(basicFilterFn);
  const upcomingFiltered = upcomingEvents.filter(basicFilterFn);

  // Build Google Maps route URL from today's events
  const routeUrl = (() => {
    const locations = todayFiltered
      .filter(e => e.location && e.location.trim() !== '')
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(e => e.location.trim());

    if (locations.length === 0) return null;
    if (locations.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locations[0])}`;
    }
    const origin = encodeURIComponent(locations[0]);
    const destination = encodeURIComponent(locations[locations.length - 1]);
    const waypoints = locations.slice(1, -1).map(encodeURIComponent).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
  })();

  // Gerar relatório do mês
  const generateReport = async (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const startStr = getDateString(startDate);
    const endStr = getDateString(endDate);
    
    const q = query(
      collection(db, 'events'),
      where('date', '>=', startStr),
      where('date', '<=', endStr)
    );
    
    const snapshot = await getDocs(q);
    const events = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as Event))
      .filter(e => !shouldHideEventCompletely(e))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    
    // Contadores
    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    
    events.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
      byPriority[e.priority] = (byPriority[e.priority] || 0) + 1;
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    });
    
    setReportData({
      total: events.length,
      byCategory,
      byPriority,
      byStatus,
      events
    });
  };

  // Exportar relatório como PDF
  const exportReport = () => {
    if (!reportData) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;
    
    // Título
    doc.setFontSize(20);
    doc.setTextColor(255, 111, 15);
    doc.text('RELATÓRIO MENSAL DE EVENTOS', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    
    // Mês
    const monthName = format(new Date(reportMonth + '-01'), 'MMMM yyyy', { locale: ptBR });
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(`Mês: ${monthName}`, margin, yPos);
    yPos += 7;
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, yPos);
    yPos += 15;
    
    // Linha separadora
    doc.setDrawColor(200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;
    
    // Resumo Geral
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO GERAL', margin, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`Total de eventos: ${reportData.total}`, margin, yPos);
    yPos += 10;
    
    // Por Categoria
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('POR CATEGORIA', margin, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    Object.entries(reportData.byCategory).forEach(([cat, count]) => {
      const catName = categoryNames[cat] || cat;
      doc.text(`  • ${catName}: ${count}`, margin, yPos);
      yPos += 6;
    });
    yPos += 5;
    
    // Por Prioridade
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('POR PRIORIDADE', margin, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    Object.entries(reportData.byPriority).forEach(([pri, count]) => {
      const priName = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }[pri] || pri;
      doc.text(`  • ${priName}: ${count}`, margin, yPos);
      yPos += 6;
    });
    yPos += 5;
    
    // Por Status
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('POR STATUS', margin, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    Object.entries(reportData.byStatus).forEach(([status, count]) => {
      const statusName = { agendado: 'Agendado', concluido: 'Concluído', cancelado: 'Cancelado' }[status] || status;
      doc.text(`  • ${statusName}: ${count}`, margin, yPos);
      yPos += 6;
    });
    yPos += 10;
    
    // Lista de Eventos
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`LISTA DE EVENTOS (${reportData.events.length})`, margin, yPos);
    yPos += 10;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    reportData.events.forEach((e, i) => {
      // Verificar se precisa de nova página
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      const dateFormatted = format(new Date(e.date + 'T00:00:00'), 'dd/MM/yyyy');
      
      // Número e título
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}. ${e.title}`, margin, yPos);
      yPos += 5;
      
      // Detalhes
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`   Data: ${dateFormatted} às ${e.time}`, margin, yPos);
      yPos += 4;
      doc.text(`   Local: ${e.location}`, margin, yPos);
      yPos += 4;
      doc.text(`   Categoria: ${categoryNames[e.category] || e.category} | Prioridade: ${e.priority} | Status: ${e.status}`, margin, yPos);
      yPos += 6;
      
      doc.setTextColor(0);
    });
    
    // Salvar PDF
    doc.save(`relatorio-${reportMonth}.pdf`);
  };

  // Abrir modal de relatório e gerar dados
  const handleShowReport = async () => {
    setShowReportModal(true);
    await generateReport(reportMonth);
  };

  // Atualizar relatório quando mudar o mês
  useEffect(() => {
    if (showReportModal) {
      generateReport(reportMonth);
    }
  }, [reportMonth, showReportModal]);

  // Listener para abrir relatório via evento do header mobile
  useEffect(() => {
    const handleOpenReport = () => {
      setShowReportModal(true);
      generateReport(reportMonth);
    };
    window.addEventListener('open-report', handleOpenReport);
    return () => window.removeEventListener('open-report', handleOpenReport);
  }, [reportMonth]);

  useEffect(() => {
    if ((location.state as { openReport?: boolean } | null)?.openReport) {
      setShowReportModal(true);
      generateReport(reportMonth);
      navigate('/', { replace: true, state: null });
    }
  }, [location.state, navigate, reportMonth]);

  const categories = [
    { key: 'all', label: 'Todos', color: 'var(--accent)' },
    { key: 'reuniao', label: 'Reuniões', color: '#3b82f6' },
    { key: 'visita', label: 'Visitas', color: '#10b981' },
    { key: 'processo', label: 'Processos', color: '#ef4444' },
    { key: 'evento', label: 'Eventos', color: '#a855f7' },
    { key: 'outro', label: 'Outros', color: '#6b7280' },
  ];

  const categoryNames: Record<string, string> = {
    reuniao: 'Reuniões',
    visita: 'Visitas',
    processo: 'Processos',
    evento: 'Eventos',
    outro: 'Outros'
  };

  const priorityColors: Record<string, string> = {
    alta: '#ef4444',
    media: '#f59e0b',
    baixa: '#10b981'
  };

  const statusColors: Record<string, string> = {
    agendado: '#3b82f6',
    concluido: '#10b981',
    cancelado: '#6b7280'
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight page-header" style={{ color: 'var(--text-primary)' }}>
            Olá, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {/* Novo Evento - Desktop - localização mais intuitiva */}
        <Link 
          to="/events/create" 
          className="hidden lg:inline-flex items-center gap-3 px-5 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, var(--accent), #ff9a0d)', color: 'white', boxShadow: '0 4px 16px rgba(255,111,15,0.3)' }}
        >
          <Plus className="w-5 h-5" />
          Novo Evento
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,111,15,0.15)' }}>
              <Calendar className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{visibleMonthlyEvents.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Eventos Ativos (Mês)</p>
        </div>
        <div className="dark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Clock className="w-4 h-4" style={{ color: '#3b82f6' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{todayFiltered.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hoje</p>
        </div>
        <div className="dark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <MapPin className="w-4 h-4" style={{ color: '#10b981' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{upcomingFiltered.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Próximos</p>
        </div>
        <div className="dark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
              <Filter className="w-4 h-4" style={{ color: '#a855f7' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{filteredAllEvents.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Filtrados</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => {
              setFilterCategory(cat.key);
              if (cat.key !== 'all') {
                setTimeout(() => {
                  document.getElementById('filtered-events')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }
            }}
            className="px-3 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0"
            style={{
              background: filterCategory === cat.key ? cat.color : 'var(--bg-card)',
              color: filterCategory === cat.key ? 'white' : 'var(--text-secondary)',
              border: filterCategory === cat.key ? 'none' : '1px solid var(--border-subtle)'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Events Section - Shows filtered when filtering, or today's events when not */}
      <div className="dark-card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between lg:flex" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="hidden lg:flex items-center gap-3">
            {filterCategory !== 'all' ? (
              <>
                <button
                  onClick={() => setFilterCategory('all')}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <X className="w-4 h-4" />
                </button>
                <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {categories.find(c => c.key === filterCategory)?.label}
                </h2>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Eventos de Hoje</h2>
              </>
            )}
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {filterCategory !== 'all' ? filteredAllEvents.length : todayFiltered.length}
          </span>
        </div>
        <div className="p-4">
          {/* When filtering, show filtered events from all time */}
          {filterCategory !== 'all' ? (
            filteredAllEvents.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon">
                  <Filter className="w-7 h-7" style={{ color: 'var(--accent)' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Nenhum evento nesta categoria</p>
                <button onClick={() => setFilterCategory('all')} className="mt-3 text-sm font-medium" style={{ color: 'var(--accent)' }}>
                  Ver todos os eventos →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAllEvents.slice(0, 20).map(event => <EventCard key={event.id} event={event} />)}
                {filteredAllEvents.length > 20 && (
                  <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    Mostrando 20 de {filteredAllEvents.length} eventos
                  </p>
                )}
              </div>
            )
          ) : (
            /* When not filtering, show today's events */
            todayFiltered.length === 0 && !personalEventDays.has(todayStr) ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon">
                  <Calendar className="w-7 h-7" style={{ color: 'var(--accent)' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Nenhum evento para hoje</p>
                <Link to="/events/create" className="mt-3 text-sm font-medium" style={{ color: 'var(--accent)' }}>
                  Criar novo evento →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {todayFiltered.map(event => <EventCard key={event.id} event={event} />)}
                {personalEventDays.has(todayStr) && (
                  <div className="rounded-xl p-4 border border-dashed" style={{ background: 'rgba(239,68,68,0.1)', borderColor: '#ef4444' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)' }}>
                        <Lock className="w-5 h-5" style={{ color: '#ef4444' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>Dia Reservado</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Compromisso pessoal - indisponível</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
        {/* Show route button only when not filtering and has events with location */}
        {!filterCategory.includes('all') || (filterCategory === 'all' && routeUrl) ? (
          routeUrl && filterCategory === 'all' && (
            <div className="px-4 pb-4">
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <Navigation2 className="w-4 h-4" />
                Ver rota do dia no Maps
              </a>
            </div>
          )
        ) : null}
      </div>

      {/* Upcoming Events - Only show when NOT filtering and on lg screens */}
      {filterCategory === 'all' && (
        <div className="hidden lg:block dark-card overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Próximos Eventos</h2>
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
              {upcomingFiltered.length}
            </span>
          </div>
          <div className="p-4">
            {upcomingFiltered.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <Calendar className="w-7 h-7" style={{ color: '#3b82f6' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Nenhum evento futuro</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingFiltered.map(event => <EventCard key={event.id} event={event} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="dark-card w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
                  <BarChart3 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Relatório Mensal</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Estatísticas e lista de eventos</p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Month Selector */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Selecionar Mês:</label>
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="dark-input text-sm"
              />
            </div>

            {/* Report Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {reportData ? (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                      <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>{reportData.total}</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Total de Eventos</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                      <p className="text-3xl font-bold" style={{ color: '#10b981' }}>
                        {reportData.events.filter(e => e.status === 'concluido').length}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Concluídos</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                      <p className="text-3xl font-bold" style={{ color: '#3b82f6' }}>
                        {reportData.events.filter(e => e.status === 'agendado').length}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Agendados</p>
                    </div>
                  </div>

                  {/* By Category */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Por Categoria</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(reportData.byCategory).map(([cat, count]) => (
                        <div
                          key={cat}
                          className="px-4 py-2 rounded-xl flex items-center gap-2"
                          style={{ background: 'var(--bg-input)' }}
                        >
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {categoryNames[cat] || cat}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: 'var(--accent)', color: 'white' }}
                          >
                            {count}
                          </span>
                        </div>
                      ))}
                      {Object.keys(reportData.byCategory).length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum evento</p>
                      )}
                    </div>
                  </div>

                  {/* By Priority */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Por Prioridade</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(reportData.byPriority).map(([pri, count]) => (
                        <div
                          key={pri}
                          className="px-4 py-2 rounded-xl flex items-center gap-2"
                          style={{ background: 'var(--bg-input)' }}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ background: priorityColors[pri] }} />
                          <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                            {pri}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: priorityColors[pri], color: 'white' }}
                          >
                            {count}
                          </span>
                        </div>
                      ))}
                      {Object.keys(reportData.byPriority).length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum evento</p>
                      )}
                    </div>
                  </div>

                  {/* By Status */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Por Status</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(reportData.byStatus).map(([status, count]) => (
                        <div
                          key={status}
                          className="px-4 py-2 rounded-xl flex items-center gap-2"
                          style={{ background: 'var(--bg-input)' }}
                        >
                          {status === 'concluido' && <CheckCircle className="w-4 h-4" style={{ color: statusColors[status] }} />}
                          {status === 'agendado' && <Clock className="w-4 h-4" style={{ color: statusColors[status] }} />}
                          {status === 'cancelado' && <X className="w-4 h-4" style={{ color: statusColors[status] }} />}
                          <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                            {status}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: statusColors[status], color: 'white' }}
                          >
                            {count}
                          </span>
                        </div>
                      ))}
                      {Object.keys(reportData.byStatus).length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum evento</p>
                      )}
                    </div>
                  </div>

                  {/* Events List */}
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                      Lista de Eventos ({reportData.events.length})
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {reportData.events.map((event, index) => (
                        <Link
                          key={event.id}
                          to={`/events/${event.id}`}
                          className="block p-3 rounded-xl transition-colors"
                          style={{ background: 'var(--bg-input)' }}
                          onClick={() => setShowReportModal(false)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--accent)', color: 'white' }}>
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {event.title}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {format(new Date(event.date + 'T00:00:00'), 'dd/MM/yyyy')} às {event.time}
                                {event.location && ` • ${event.location}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ background: priorityColors[event.priority], color: 'white' }}
                              >
                                {event.priority}
                              </span>
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ background: statusColors[event.status], color: 'white' }}
                              >
                                {event.status}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                      {reportData.events.length === 0 && (
                        <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Nenhum evento neste mês</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
              >
                Fechar
              </button>
                <button
                  onClick={exportReport}
                  disabled={!reportData || reportData.events.length === 0}
                  className="btn-premium inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
