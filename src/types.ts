export type Role = 'admin' | 'diretoria' | 'juridico' | 'comunicacao' | 'fiscalizacao' | 'administrativo';
export type Priority = 'alta' | 'media' | 'baixa';
export type Status = 'agendado' | 'concluido' | 'cancelado';
export type EventCategory = 'reuniao' | 'visita' | 'processo' | 'evento' | 'outro';

export interface User {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  fcmToken?: string;
  createdAt?: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string;
  priority: Priority;
  status: Status;
  category: EventCategory;
  cnpj?: string;
  createdBy: string;
  creatorName: string;
  notify24h?: boolean;
  notify1h?: boolean;
  tags?: string[];
  attachments?: string[];
  color?: string;
  isRecurring?: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'monthly' | 'none';
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  eventId: string;
  userId: string;
  action: 'event_created' | 'event_updated' | 'event_deleted' | 'status_changed';
  timestamp: string;
  details?: string;
}
