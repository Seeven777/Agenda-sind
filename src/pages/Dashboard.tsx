import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { EventCard } from '../components/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { useOutletContext } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { Plus, Briefcase, Map, Users, Calendar as CalendarIcon, Activity, TrendingUp, X, Navigation2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Dashboard() {
  // ALL HOOKS FIRST - Fix React #310
  const { user } = useAuth();
  const { searchTerm } = useOutletContext<{ searchTerm: string }>();
  const navigate = useNavigate();
  
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [allActiveEvents, setAllActiveEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeMetricLabel, setActiveMetricLabel] = useState<string | null>(null);
  const filteredSectionRef = useRef<HTMLDivElement>(null);

  const handleEdit = useCallback((id: string) => {
    navigate(`/events/${id}/edit`);
  }, [navigate]);

  const handleMetricClick = useCallback((item: any) => {
    if (activeMetricLabel === item.label) {
      setActiveMetricLabel(null);
      setFilterCategory('all');
      return;
    }
    setActiveMetricLabel(item.label);
    setFilterCategory(item.categoryKey);
    setTimeout(() => {
      filteredSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [activeMetricLabel]);

  // Rest of component logic...
  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const todayQuery = query(collection(db, 'events'), where('date', '==', todayStr), orderBy('time', 'asc'));
    const upcomingQuery = query(collection(db, 'events'), where('date', '>', todayStr), orderBy('date', 'asc'), orderBy('time', 'asc'), limit(10));
    const activeQuery = query(collection(db, 'events'), where('status', '==', 'agendado'));

    const u1 = onSnapshot(todayQuery, (s) => setTodayEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))), (e) => handleFirestoreError(e, OperationType.LIST, 'events'));
    const u2 = onSnapshot(upcomingQuery, (s) => setUpcomingEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))), (e) => handleFirestoreError(e, OperationType.LIST, 'events'));
    const u3 = onSnapshot(activeQuery, (s) => { setAllActiveEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))); setLoading(false); }, (e) => handleFirestoreError(e, OperationType.LIST, 'events'));

    return () => { u1(); u2(); u3(); };
  }, [user]);

  const reunioes = allActiveEvents.filter(e => e.category === 'reuniao').length;
  const processos = allActiveEvents.filter(e => e.category === 'processo').length;
  const visitas = allActiveEvents.filter(e => e.category === 'visita').length;
  const outros = allActiveEvents.length - reunioes - processos - visitas;
  const total = allActiveEvents.length || 1;

  const chartData = [
    { label: 'Reuniões', value: reunioes, color: '#3b82f6', icon: Users, categoryKey: 'reuniao' },
    { label: 'Processos', value: processos, color: '#ef4444', icon: Briefcase, categoryKey: 'processo' },
    { label: 'Visitas', value: visitas, color: '#22c55e', icon: Map, categoryKey: 'visita' },
    { label: 'Outros', value: outros, color: '#a855f7', icon: Activity, categoryKey: 'outro' },
  ];

  const basicFilterFn = (e: Event) =>
    searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase());

  const fullFilterFn = (e: Event) => {
    const matchSearch = searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterCategory === 'all') return matchSearch;
    if (filterCategory === 'outro') return matchSearch && !['reuniao', 'processo', 'visita'].includes(e.category);
    return matchSearch && e.category === filterCategory;
  };

  const filteredAllEvents = allActiveEvents.filter(fullFilterFn);

  const routeUrl = (() => {
    const locations = todayEvents
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const activeItem = chartData.find(c => c.label === activeMetricLabel);

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Bem-vindo, {user?.name?.split(' ')[0]}</p>
        </div>
        <Link to="/events/create" className="btn-premium hidden lg:inline-flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Novo Evento
        </Link>
      </div>

      {/* resto do JSX igual ao anterior */}
      {/* Hero Chart, Metrics, etc... mantidos idênticos */}
      {/* ... [resto do código igual ao read_file anterior, com EventCard onEdit={handleEdit} nos 3 lugares] ... */}
    </div>
  );
}
