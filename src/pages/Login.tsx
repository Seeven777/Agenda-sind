import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar as CalendarIcon } from 'lucide-react';

export function Login() {
  const { user, login, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6f0f]"></div>
      </div>
    );
  }

  if (user) {
    const from = (location.state as any)?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex flex-col items-center">
          <img src="/logo.png" alt="SindPetShop-SP Logo" className="h-24 w-auto mb-4" />
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            Agenda Sind
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sistema de Agendamento Institucional do SindPetShop-SP
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <button
            onClick={login}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-[#ff6f0f] hover:bg-[#e6600c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6f0f] transition-all shadow-md hover:shadow-lg"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    </div>
  );
}
