import { User, UserPermissions } from '../types';

// Emails dos Super Admins / Proprietários
export const SUPER_ADMINS = [
  'gustavo13470@gmail.com',   // Desenvolvedor
  'jnyce6@hotmail.com'        // Proprietário
];

// Emails dos proprietários (para dashboard privado)
export const BOSS_EMAILS = [
  'jnyce6@hotmail.com'
];

// Email do patrão principal (para dashboard privado)
export const BOSS_EMAIL = 'jnyce6@hotmail.com';

// Verificar se é super admin
export function isSuperAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMINS.includes(email.toLowerCase());
}

// Verificar se é um dos proprietários (para dashboard privado)
export function isBoss(email: string | undefined): boolean {
  if (!email) return false;
  return BOSS_EMAILS.map(b => b.toLowerCase()).includes(email.toLowerCase());
}

// Permissões padrão para novos usuários
export const DEFAULT_PERMISSIONS: UserPermissions = {
  canCreateEvents: true,
  canEditOthersEvents: false,
  canDeleteOthersEvents: false,
  canSeePersonalEvents: false,
  canCreateOnBlockedDays: false,
};

// Verificar se usuário pode criar eventos
export function canCreateEvents(user: User | null): boolean {
  if (!user) return false;
  if (user.isAdmin || isSuperAdmin(user.email)) return true;
  return user.permissions?.canCreateEvents ?? DEFAULT_PERMISSIONS.canCreateEvents;
}

// Verificar se usuário pode editar eventos de outros
export function canEditOthersEvents(user: User | null): boolean {
  if (!user) return false;
  if (user.isAdmin || isSuperAdmin(user.email)) return true;
  return user.permissions?.canEditOthersEvents ?? DEFAULT_PERMISSIONS.canEditOthersEvents;
}

// Verificar se usuário pode excluir eventos de outros
export function canDeleteOthersEvents(user: User | null): boolean {
  if (!user) return false;
  if (user.isAdmin || isSuperAdmin(user.email)) return true;
  return user.permissions?.canDeleteOthersEvents ?? DEFAULT_PERMISSIONS.canDeleteOthersEvents;
}

// Verificar se usuário pode ver eventos pessoais do patrão
export function canSeePersonalEvents(user: User | null): boolean {
  if (!user) return false;
  if (user.isAdmin || isSuperAdmin(user.email)) return true;
  return user.permissions?.canSeePersonalEvents ?? DEFAULT_PERMISSIONS.canSeePersonalEvents;
}

// Verificar se usuário pode criar eventos em dias bloqueados
export function canCreateOnBlockedDays(user: User | null): boolean {
  if (!user) return false;
  if (user.isAdmin || isSuperAdmin(user.email)) return true;
  return user.permissions?.canCreateOnBlockedDays ?? DEFAULT_PERMISSIONS.canCreateOnBlockedDays;
}

// Verificar se evento deve ser oculto para o usuário
export function shouldHideEvent(user: User | null, eventCreatorEmail?: string): boolean {
  if (!user) return true;
  
  // Super admins veem tudo
  if (user.isAdmin || isSuperAdmin(user.email)) return false;
  
  // Se não tem permissão para ver eventos pessoais, oculta
  if (!canSeePersonalEvents(user)) {
    // Verificar se o criador é o patrão e o evento é pessoal
    if (eventCreatorEmail && isBoss(eventCreatorEmail)) {
      // Outros usuários não veem eventos pessoais do patrão
      return true;
    }
  }
  
  return false;
}

// Verificar se usuário pode criar evento em uma data específica
export function canCreateEventOnDate(
  user: User | null, 
  date: string, 
  blockedDates: string[]
): boolean {
  if (!user) return false;
  
  // Super admins podem sempre criar
  if (user.isAdmin || isSuperAdmin(user.email)) return true;
  
  // Verificar se a data está bloqueada
  if (blockedDates.includes(date)) {
    return canCreateOnBlockedDays(user);
  }
  
  return canCreateEvents(user);
}

// Verificar se o usuário é da diretoria
export function isDiretoria(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'diretoria' || isSuperAdmin(user.email);
}

// Verificar se deve mostrar o nome do usuário para outros
export function shouldShowName(viewerUser: User | null, targetUser: User): boolean {
  // Se é o próprio usuário, mostra
  if (viewerUser?.id === targetUser.id) return true;
  
  // Super admins sempre veem tudo
  if (viewerUser && isSuperAdmin(viewerUser.email)) return true;
  
  // Se o usuário alvo é da diretoria
  if (targetUser.role === 'diretoria' || isSuperAdmin(targetUser.email)) {
    // Verifica a configuração de visibilidade do alvo
    return targetUser.visibilitySettings?.showName ?? true;
  }
  
  return true;
}

// Verificar se deve mostrar o email do usuário para outros
export function shouldShowEmail(viewerUser: User | null, targetUser: User): boolean {
  if (viewerUser?.id === targetUser.id) return true;
  if (viewerUser && isSuperAdmin(viewerUser.email)) return true;
  
  if (targetUser.role === 'diretoria' || isSuperAdmin(targetUser.email)) {
    return targetUser.visibilitySettings?.showEmail ?? true;
  }
  
  return true;
}

// Verificar se deve mostrar o departamento do usuário para outros
export function shouldShowDepartment(viewerUser: User | null, targetUser: User): boolean {
  if (viewerUser?.id === targetUser.id) return true;
  if (viewerUser && isSuperAdmin(viewerUser.email)) return true;
  
  if (targetUser.role === 'diretoria' || isSuperAdmin(targetUser.email)) {
    return targetUser.visibilitySettings?.showDepartment ?? true;
  }
  
  return true;
}

// Verificar se deve mostrar o perfil do usuário na lista
export function shouldShowProfile(viewerUser: User | null, targetUser: User): boolean {
  if (viewerUser?.id === targetUser.id) return true;
  if (viewerUser && isSuperAdmin(viewerUser.email)) return true;
  
  if (targetUser.role === 'diretoria' || isSuperAdmin(targetUser.email)) {
    return targetUser.visibilitySettings?.showProfile ?? true;
  }
  
  return true;
}
