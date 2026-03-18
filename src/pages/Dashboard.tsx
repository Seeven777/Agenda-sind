import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { EventCard } from '../components/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { Plus, Briefcase, Map, Users, Calendar as CalendarIcon, Activity, TrendingUp } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';

export function Dashboard() {
  const { user } = useAuth();
  const { searchTerm } = useOutletContext<{ searchTerm: string }>();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [allActiveEvents, setAllActiveEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
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
  const total = allActiveEvents.length || 1; // avoid divide by zero

  const chartData = [
    { label: 'Reuniões', value: reunioes, color: '#3b82f6' },
    { label: 'Processos', value: processos, color: '#ef4444' },
    { label: 'Visitas', value: visitas, color: '#22c55e' },
    { label: 'Outros', value: allActiveEvents.length - reunioes - processos - visitas, color: '#a855f7' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
        <Link
          to="/events/create"
          className="hidden lg:inline-flex items-center justify-center px-6 py-2 border border-transparent text-sm font-bold rounded-xl shadow-lg text-white bg-gradient-to-r from-[#ff6f0f] to-[#e6600c] hover:shadow-orange-500/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6f0f] transition-all transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Evento
        </Link>
      </div>

      {/* Animated Chart Section */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-[#ff6f0f]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Resumo de Atividades</h2>
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ff6f0f] outline-none bg-gray-50 text-sm font-medium transition-all"
          >
            <option value="all">Todas Categorias</option>
            <option value="reuniao">Reunião</option>
            <option value="visita">Visita Sindical</option>
            <option value="processo">Audiência/Processo</option>
            <option value="evento">Evento Institucional</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Simple Animated SVG Bar Chart */}
          <div className="space-y-4">
            {chartData.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-sm font-bold text-gray-600">
                  <span>{item.label}</span>
                  <span>{item.value} ({Math.round((item.value / total) * 100)}%)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full animate-grow-x"
                    style={{ 
                      width: `${(item.value / total) * 100}%`, 
                      backgroundColor: item.color,
                      transitionDelay: `${index * 100}ms`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="hidden md:flex justify-center">
             <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Concentric rings or simple visualization */}
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                  {chartData.map((item, index) => {
                    let offset = 0;
                    for(let i=0; i<index; i++) offset += (chartData[i].value / total) * 100;
                    const percentage = (item.value / total) * 100;
                    return (
                      <circle 
                        key={index}
                        cx="50" cy="50" r="45" 
                        fill="none" 
                        stroke={item.color} 
                        strokeWidth="8" 
                        strokeDasharray={`${percentage} ${100-percentage}`}
                        strokeDashoffset={`-${offset}`}
                        pathLength="100"
                        className="transition-all duration-1000 ease-out"
                        style={{ strokeDasharray: loading ? '0 100' : `${percentage} ${100-percentage}` }}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-gray-900">{allActiveEvents.length}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ativos</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {chartData.map((item, index) => (
          <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md transition-shadow group">
            <div className="p-3 rounded-xl transition-colors" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
              {index === 0 && <Users className="w-6 h-6" />}
              {index === 1 && <Briefcase className="w-6 h-6" />}
              {index === 2 && <Map className="w-6 h-6" />}
              {index === 3 && <Activity className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{item.label}</p>
              <p className="text-2xl font-black text-gray-900">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Events */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6 overflow-hidden">
          <div className="bg-[#ff6f0f]/5 -mx-6 -mt-6 p-4 px-6 mb-6 border-b border-orange-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2 text-[#ff6f0f]" />
              Eventos de Hoje
            </h2>
          </div>
          {todayEvents.filter(e => 
            (searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (filterCategory === 'all' || e.category === filterCategory)
          ).length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
                <CalendarIcon className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">Nenhum evento para hoje.</p>
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
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6 overflow-hidden">
          <div className="bg-blue-50 -mx-6 -mt-6 p-4 px-6 mb-6 border-b border-blue-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2 text-blue-600" />
              Próximos Eventos
            </h2>
          </div>
          {upcomingEvents.filter(e => 
            (searchTerm === '' || e.title.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (filterCategory === 'all' || e.category === filterCategory)
          ).length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
                <CalendarIcon className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">Nenhum evento futuro.</p>
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
