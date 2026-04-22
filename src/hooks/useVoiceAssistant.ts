import { useState, useCallback, useEffect } from 'react';

interface VoiceCommand {
  transcript: string;
  isFinal: boolean;
}

interface ParsedEventData {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  category?: string;
  priority?: string;
  description?: string;
}

// Mapeamento de palavras em português para categorias
const categoryMap: Record<string, string> = {
  'reunião': 'reuniao',
  'reuniao': 'reuniao',
  'visita': 'visita',
  'processo': 'processo',
  'evento': 'evento',
  'outro': 'outro',
};

// Mapeamento de palavras em português para prioridades
const priorityMap: Record<string, string> = {
  'alta': 'alta',
  'urgente': 'alta',
  'importante': 'alta',
  'média': 'media',
  'media': 'media',
  'normal': 'media',
  'baixa': 'baixa',
};

// Converter texto de-data em português para formato YYYY-MM-DD
function parseDate(text: string): string | undefined {
  const today = new Date();
  const lowerText = text.toLowerCase();
  
  // Padrão: "hoje"
  if (lowerText.includes('hoje')) {
    return today.toISOString().split('T')[0];
  }
  
  // Padrão: "amanhã" ou "amanha"
  if (lowerText.includes('amanhã') || lowerText.includes('amanha')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Padrão: "dia [número]"
  const diaMatch = lowerText.match(/dia\s+(\d{1,2})/);
  if (diaMatch) {
    const day = parseInt(diaMatch[1], 10);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    if (day >= 1 && day <= 31) {
      // Assume o mês atual ou próximo se dia já passou
      const date = new Date(currentYear, currentMonth, day);
      if (date < today) {
        date.setMonth(currentMonth + 1);
      }
      return date.toISOString().split('T')[0];
    }
  }
  
  // Padrão: "[número] de [mês]"
  const months: Record<string, number> = {
    'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
    'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
  };
  
  for (const [monthName, monthIndex] of Object.entries(months)) {
    if (lowerText.includes(monthName)) {
      const match = lowerText.match(/(\d{1,2})\s+de\s+.*monthName/);
      if (match) {
        const day = parseInt(match[1], 10);
        const year = monthIndex < today.getMonth() ? today.getFullYear() + 1 : today.getFullYear();
        return new Date(year, monthIndex, day).toISOString().split('T')[0];
      }
    }
  }
  
  return undefined;
}

// Converter texto de hora em formato HH:mm
function parseTime(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  // Padrão: "às [hora]" ou "as [hora]"
  let match = lowerText.match(/(?:às|as)\s+(\d{1,2})(?::(\d{2}))?/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    
    // Ajustar hora (ex: "14h" = 14:00)
    if (lowerText.includes('h') && !match[2]) {
      hour = hour; // já está correto
    }
    
    // Usar 24h se não especificado AM/PM
    if (hour >= 0 && hour <= 23) {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  }
  
  // Padrão: "[hora]:[minuto]"
  match = lowerText.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  }
  
  return undefined;
}

// Extrair localização do texto
function parseLocation(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  // Padrão: "no local [local]" ou "em [local]"
  const noMatch = lowerText.match(/(?:no|em)\s+([^,\.]+)/);
  if (noMatch) {
    return noMatch[1].trim();
  }
  
  // Padrão: "local [local]"
  const localMatch = lowerText.match(/local\s+([^,\.]+)/);
  if (localMatch) {
    return localMatch[1].trim();
  }
  
  return undefined;
}

// Extrair categoria do texto
function parseCategory(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  for (const [key, value] of Object.entries(categoryMap)) {
    if (lowerText.includes(key)) {
      return value;
    }
  }
  
  return undefined;
}

// Extrair prioridade do texto
function parsePriority(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  for (const [key, value] of Object.entries(priorityMap)) {
    if (lowerText.includes(key)) {
      return value;
    }
  }
  
  return undefined;
}

// Parsear o comando de voz e extrair dados do evento
export function parseVoiceCommand(text: string): ParsedEventData {
  const result: ParsedEventData = {};
  
  // Tentar extrair cada campo
  result.date = parseDate(text);
  result.time = parseTime(text);
  result.location = parseLocation(text);
  result.category = parseCategory(text);
  result.priority = parsePriority(text);
  
  // O título geralmente é a primeira parte do comando
  // Remover palavras comunes de comando
  let title = text;
  const removePhrases = [
    'criar', 'crie', 'agendar', 'agende', 'nova', 'novo', 'evento', 'reunião', 'reuniao',
    'visita', 'processo', 'amanhã', 'amanha', 'hoje', 'amanhã', 'as', 'às', 'dia',
    'no', 'em', 'local', 'sobre', 'para', 'com'
  ];
  
  for (const phrase of removePhrases) {
    title = title.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), '');
  }
  
  // Limpar espaços extras
  title = title.replace(/\s+/g, ' ').trim();
  
  // Remover números de-data e hora que possam estar no início
  title = title.replace(/^\d{1,2}[\/:]\d{2}\s*/, '');
  title = title.replace(/^\d{1,2}\s+(de\s+)?\w+\s*/, '');
  
  //Limitar tamanho do título
  if (title.length > 0 && title.length < 100) {
    result.title = title;
  } else if (title.length >= 100) {
    result.title = title.substring(0, 100);
  }
  
  // Descrição é o texto restantes se houver muito conteúdo
  if (text.length > 50 && !result.description) {
    result.description = text;
  }
  
  return result;
}

// Hook principal
export function useVoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // Verificar se o navegador suporta reconhecimento de voz
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Reconhecimento de voz não suporteado neste navegador');
      return;
    }

    setError(null);
    setTranscript('');

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognizer = new SpeechRecognition();

    // Configurar para português do Brasil
    recognizer.lang = 'pt-BR';
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;

    recognizer.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);
    };

    recognizer.onerror = (event: any) => {
      console.error('Erro no reconhecimento de voz:', event.error);
      setError(event.error);
      setIsListening(false);
    };

    recognizer.onend = () => {
      setIsListening(false);
    };

    recognizer.start();
    setRecognition(recognizer);
    setIsListening(true);
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setRecognition(null);
    }
    setIsListening(false);
  }, [recognition]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Função para limpar o transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    parseVoiceCommand,
  };
}
