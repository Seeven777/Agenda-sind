export type Role = 'admin' | 'diretoria' | 'juridico' | 'comunicacao' | 'fiscalizacao' | 'administrativo';
export type Priority = 'alta' | 'media' | 'baixa';
export type Status = 'agendado' | 'concluido' | 'cancelado';
export type EventCategory = 'reuniao' | 'visita' | 'processo' | 'evento' | 'outro';

// Permissões de usuário
export interface UserPermissions {
  canCreateEvents: boolean;       // Pode criar eventos
  canEditOthersEvents: boolean;    // Pode editar eventos de outros usuários
  canDeleteOthersEvents: boolean; // Pode excluir eventos de outros usuários
  canSeePersonalEvents: boolean;  // Pode ver eventos pessoais do patrão
  canCreateOnBlockedDays: boolean; // Pode criar eventos em dias bloqueados
}

export interface User {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  fcmToken?: string;
  createdAt?: string;
  isAdmin?: boolean;             // É super admin (gustavo ou patrão)
  isActive?: boolean;            // Usuário ativo ou desativado
  permissions?: UserPermissions;  // Permissões individuais
  // Configurações de visibilidade para diretoria
  visibilitySettings?: {
    showName?: boolean;           // Mostrar nome para outros
    showEmail?: boolean;          // Mostrar email para outros
    showDepartment?: boolean;     // Mostrar departamento para outros
    showPersonalEvents?: boolean; // Mostrar eventos pessoais
    showProfile?: boolean;        // Mostrar perfil na lista de usuários
  };
}

export interface ProcessDetails {
  processoNumero?: string;
  forum?: string;
  autor?: string;
  reu?: string;
  nomePartes?: string;
  acao?: string;
  localTramitacao?: string;
  dataDistribuicao?: string;
  advogadoNome?: string;
  advogadoFone?: string;
  acompanhamento?: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  endDate?: string;
  endTime?: string;
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
  // Campos específicos de processo
  processDetails?: ProcessDetails;
  // Campos para eventos em série (múltiplos dias)
  seriesId?: string; // ID que agrupa eventos da mesma série
  seriesUpdateAll?: boolean; // Se true, edições afetam toda a série
  // Campos para eventos pessoais do patrão
  isPersonal?: boolean; // Evento pessoal do patrão (não visível para outros)
}

export interface ActivityLog {
  id: string;
  eventId: string;
  userId: string;
  action: 'event_created' | 'event_updated' | 'event_deleted' | 'status_changed';
  timestamp: string;
  details?: string;
}
