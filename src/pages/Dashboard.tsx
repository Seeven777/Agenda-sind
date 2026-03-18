import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { EventCard } from '../components/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { Plus, Briefcase, Map, Users, Calendar as CalendarIcon, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { user } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [allActiveEvents, setAllActiveEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    if (!user) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Query for today's events
    const todayQuery = query(
      collection(db, 'events'),
      where('date', '==', todayStr),
      orderBy('time', 'asc')
    );

    // Query for upcoming events (next 7 days)
    const upcomingQuery = query(
      collection(db, 'events'),
      where('date', '>', todayStr),
      orderBy('date', 'asc'),
      orderBy('time', 'asc'),
      limit(10)
    );

    // Query for all active events to calculate metrics
    const activeQuery = query(
      collection(db, 'events'),
      where('status', '==', 'agendado')
    );

    const unsubscribeToday = onSnapshot(todayQuery, (snapshot) => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      setTodayEvents(events);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    const unsubscribeUpcoming = onSnapshot(upcomingQuery, (snapshot) => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      setUpcomingEvents(events);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    const unsubscribeActive = onSnapshot(activeQuery, (snapshot) => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      setAllActiveEvents(events);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return () => {
      unsubscribeToday();
      unsubscribeUpcoming();
      unsubscribeActive();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6f0f]"></div>
      </div>
    );
  }

  // Calculate metrics
  const reunioes = allActiveEvents.filter(e => e.category === 'reuniao').length;
  const processos = allActiveEvents.filter(e => e.category === 'processo').length;
  const visitas = allActiveEvents.filter(e => e.category === 'visita').length;
  const outros = allActiveEvents.length - reunioes - processos - visitas;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/events/create"
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#ff6f0f] hover:bg-[#e6600c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6f0f] w-full sm:w-auto transition-all transform hover:scale-105"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Evento
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar eventos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff6f0f] focus:border-transparent outline-none transition-all"
          />
          <Plus className="w-5 h-5 absolute left-3 top-2.5 text-gray-400 rotate-45" />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff6f0f] outline-none bg-white min-w-[150px]"
        >
          <option value="all">Todas Categorias</option>
          <option value="reuniao">Reunião</option>
          <option value="visita">Visita Sindical</option>
          <option value="processo">Audiência/Processo</option>
          <option value="evento">Evento Institucional</option>
          <option value="outro">Outro</option>
        </select>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Reuniões</p>
            <p className="text-2xl font-bold text-gray-900">{reunioes}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Processos</p>
            <p className="text-2xl font-bold text-gray-900">{processos}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg">
            <Map className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Visitas</p>
            <p className="text-2xl font-bold text-gray-900">{visitas}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Outros</p>
            <p className="text-2xl font-bold text-gray-900">{outros}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Events */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2 text-[#ff6f0f]" />
            Eventos de Hoje
          </h2>
          {todayEvents.filter(e => 
            (searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (filterCategory === 'all' || e.category === filterCategory)
          ).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">Nenhum evento encontrado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {todayEvents.filter(e => 
                (searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase())) &&
                (filterCategory === 'all' || e.category === filterCategory)
              ).map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2 text-[#ff6f0f]" />
            Próximos Eventos
          </h2>
          {upcomingEvents.filter(e => 
            (searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (filterCategory === 'all' || e.category === filterCategory)
          ).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">Nenhum evento encontrado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingEvents.filter(e => 
                (searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase())) &&
                (filterCategory === 'all' || e.category === filterCategory)
              ).map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
