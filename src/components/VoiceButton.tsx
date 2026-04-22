import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';

interface VoiceButtonProps {
  isListening: boolean;
  transcript: string;
  onStartListening: () => void;
  onStopListening: () => void;
  isSupported: boolean;
  error?: string | null;
}

export function VoiceButton({
  isListening,
  transcript,
  onStartListening,
  onStopListening,
  isSupported,
  error
}: VoiceButtonProps) {
  const [showHelp, setShowHelp] = useState(false);

  // Sempre mostrar o botão, mas com estilo diferente se não suportado
  const buttonSupported = isSupported;

  return (
    <div className="relative">
      {/* Botão principal de microfone */}
      <button
        type="button"
        onClick={isListening ? onStopListening : onStartListening}
        onMouseEnter={() => setShowHelp(true)}
        onMouseLeave={() => setShowHelp(false)}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 ${
          isListening 
            ? 'animate-pulse' 
            : ''
        }`}
        style={{
          background: isListening 
            ? 'var(--danger)' 
            : 'var(--accent)',
          color: 'white',
          boxShadow: isListening 
            ? '0 0 20px rgba(239, 68, 68, 0.5)' 
            : '0 4px 12px rgba(255, 111, 15, 0.3)'
        }}
        aria-label={isListening ? 'Parar reconhecimento de voz' : 'Iniciar reconhecimento de voz'}
      >
        {isListening ? (
          <div className="relative">
            <Mic className="w-6 h-6" />
            {/* Indicador de wave visual */}
            <span className="absolute -inset-2 rounded-full bg-red-400 opacity-30 animate-ping" />
          </div>
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>

      {/* Tooltip de ajuda */}
      {showHelp && !isListening && (
        <div 
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-50 animate-fade-in"
          style={{ 
            background: 'var(--bg-input)', 
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <p className="font-medium mb-1">🎤 Criar evento por voz</p>
          <p style={{ color: 'var(--text-muted)' }}>Ex: "Reunião amanhã às 14h no fórum"</p>
        </div>
      )}

      {/* Feedback quando está ouvindo */}
      {isListening && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-50 animate-fade-in">
          <div className="flex items-center gap-2">
            <Loader className="w-3 h-3 animate-spin" style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--danger)' }}>Ouvindo...</span>
          </div>
          {transcript && (
            <p className="mt-1 max-w-48 truncate" style={{ color: 'var(--text-secondary)' }}>
              "{transcript}"
            </p>
          )}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div 
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-50"
          style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}
        >
          Erro: {error}
        </div>
      )}
    </div>
  );
}

// Componente para exibir o resultado do reconhecimento e preencher os campos
interface VoiceResultDisplayProps {
  transcript: string;
  isListening: boolean;
  onClear: () => void;
}

export function VoiceResultDisplay({ transcript, isListening, onClear }: VoiceResultDisplayProps) {
  if (!transcript || isListening) return null;

  return (
    <div 
      className="p-3 rounded-xl animate-fade-in"
      style={{ 
        background: 'var(--bg-input)',
        border: '1px solid var(--accent)'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Comando reconhecido
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs px-2 py-1 rounded transition-all active:scale-95"
          style={{ 
            background: 'rgba(255, 111, 15, 0.1)', 
            color: 'var(--accent)' 
          }}
        >
          Limpar
        </button>
      </div>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        "{transcript}"
      </p>
    </div>
  );
}