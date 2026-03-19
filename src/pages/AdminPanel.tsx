import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, UserPermissions } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { isSuperAdmin, BOSS_EMAILS, shouldShowProfile, shouldShowName, shouldShowEmail, shouldShowDepartment } from '../lib/permissions';
import { Users, Shield, Check, X, Edit2, Save, ChevronDown, ChevronUp, UserCheck, UserX, Crown, Eye, EyeOff } from 'lucide-react';

export function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(usersList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleExpand = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const handleToggleActive = async (userToUpdate: User) => {
    try {
      await updateDoc(doc(db, 'users', userToUpdate.id), {
        isActive: !userToUpdate.isActive
      });
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handlePermissionChange = async (
    userToUpdate: User, 
    permission: keyof UserPermissions, 
    value: boolean
  ) => {
    try {
      const newPermissions = {
        ...(userToUpdate.permissions || {}),
        [permission]: value
      };
      
      await updateDoc(doc(db, 'users', userToUpdate.id), {
        permissions: newPermissions
      });
    } catch (error) {
      console.error('Error updating permissions:', error);
    }
  };

  const handleRoleChange = async (userToUpdate: User, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userToUpdate.id), {
        role: newRole
      });
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" 
             style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const isCurrentUserAdmin = user && isSuperAdmin(user.email);

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Painel Admin
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Gerencie usuários e permissões do sistema
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl" 
             style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <Users className="w-5 h-5" />
          <span className="font-bold">{users.length} usuários</span>
        </div>
      </div>

      {/* Info Card */}
      <div className="dark-card p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
             style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
          <Shield className="w-5 h-5" style={{ color: '#3b82f6' }} />
        </div>
        <div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
            Permissões de Administrador
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Você e os proprietários da conta têm acesso total ao sistema.
            Gerencie aqui as permissões dos demais usuários.
          </p>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {users.map((userItem) => {
          const isExpanded = expandedUsers.has(userItem.id);
          const isUserAdmin = isSuperAdmin(userItem.email);
          const isCurrentUser = user?.id === userItem.id;
          const isBoss = !!userItem.email && BOSS_EMAILS.map(b => b.toLowerCase()).includes(userItem.email.toLowerCase());

          return (
            <div key={userItem.id} className="dark-card overflow-hidden">
              {/* User Header */}
              <div 
                className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => !isUserAdmin && toggleExpand(userItem.id)}
                style={{ 
                  borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
                  opacity: userItem.isActive === false ? 0.6 : 1
                }}
              >
                {/* Avatar */}
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-lg flex-shrink-0"
                  style={{ 
                    background: isBoss 
                      ? 'linear-gradient(135deg, #ff6f0f, #ff9a0d)'
                      : userItem.isActive === false 
                        ? '#6b7280'
                        : 'linear-gradient(135deg, #3b82f6, #60a5fa)'
                  }}
                >
                  {isBoss && <Crown className="w-5 h-5 text-white" />}
                  {!isBoss && (userItem.name?.charAt(0) || 'U')}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {userItem.name}
                    </p>
                    {isCurrentUser && (
                      <span className="text-xs px-2 py-0.5 rounded-lg" 
                            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        Você
                      </span>
                    )}
                    {isUserAdmin && !isBoss && (
                      <span className="text-xs px-2 py-0.5 rounded-lg" 
                            style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                        Admin
                      </span>
                    )}
                    {isBoss && (
                      <span className="text-xs px-2 py-0.5 rounded-lg" 
                            style={{ background: 'rgba(255, 111, 15, 0.15)', color: 'var(--accent)' }}>
                        Proprietário
                      </span>
                    )}
                  </div>
                  <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                    {userItem.email}
                  </p>
                </div>

                {/* Role Badge */}
                <div className="hidden sm:block px-3 py-1 rounded-lg text-xs font-bold uppercase"
                     style={{ 
                       background: 'var(--bg-input)',
                       color: 'var(--text-secondary)'
                     }}>
                  {userItem.role}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  {userItem.isActive === false ? (
                    <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                         style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                      <UserX className="w-3 h-3" />
                      Inativo
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                         style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                      <UserCheck className="w-3 h-3" />
                      Ativo
                    </div>
                  )}
                </div>

                {/* Expand Icon (only for non-admins) */}
                {!isUserAdmin && (
                  <div style={{ color: 'var(--text-muted)' }}>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                )}
              </div>

              {/* Expanded Permissions Panel */}
              {isExpanded && (
                <div className="px-5 py-4 bg-[var(--bg-input)] animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Role Selection */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                             style={{ color: 'var(--text-muted)' }}>
                        Cargo/Função
                      </label>
                      <select
                        value={userItem.role}
                        onChange={(e) => handleRoleChange(userItem, e.target.value)}
                        className="dark-input w-full"
                      >
                        <option value="admin">Admin</option>
                        <option value="diretoria">Diretoria</option>
                        <option value="juridico">Jurídico</option>
                        <option value="comunicacao">Comunicação</option>
                        <option value="fiscalizacao">Fiscalização</option>
                        <option value="administrativo">Administrativo</option>
                      </select>
                    </div>

                    {/* Active Toggle */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                             style={{ color: 'var(--text-muted)' }}>
                        Status da Conta
                      </label>
                      <button
                        onClick={() => handleToggleActive(userItem)}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                        style={{
                          background: userItem.isActive === false 
                            ? 'rgba(34, 197, 94, 0.15)' 
                            : 'rgba(239, 68, 68, 0.15)',
                          color: userItem.isActive === false ? '#22c55e' : '#ef4444'
                        }}
                      >
                        {userItem.isActive === false ? (
                          <>
                            <UserCheck className="w-4 h-4" />
                            Ativar Conta
                          </>
                        ) : (
                          <>
                            <UserX className="w-4 h-4" />
                            Desativar Conta
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="mt-6">
                    <h4 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                      Permissões Individuais
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PermissionToggle
                        label="Criar Eventos"
                        description="Pode criar novos eventos no calendário"
                        checked={userItem.permissions?.canCreateEvents ?? true}
                        onChange={(v) => handlePermissionChange(userItem, 'canCreateEvents', v)}
                      />
                      <PermissionToggle
                        label="Editar Eventos de Outros"
                        description="Pode editar eventos criados por outros usuários"
                        checked={userItem.permissions?.canEditOthersEvents ?? false}
                        onChange={(v) => handlePermissionChange(userItem, 'canEditOthersEvents', v)}
                      />
                      <PermissionToggle
                        label="Excluir Eventos de Outros"
                        description="Pode excluir eventos criados por outros usuários"
                        checked={userItem.permissions?.canDeleteOthersEvents ?? false}
                        onChange={(v) => handlePermissionChange(userItem, 'canDeleteOthersEvents', v)}
                      />
                      <PermissionToggle
                        label="Ver Eventos Pessoais do Patrão"
                        description="Pode visualizar eventos marcados como pessoais"
                        checked={userItem.permissions?.canSeePersonalEvents ?? false}
                        onChange={(v) => handlePermissionChange(userItem, 'canSeePersonalEvents', v)}
                      />
                      <PermissionToggle
                        label="Criar em Dias Bloqueados"
                        description="Pode criar eventos em datas reservadas pelo patrão"
                        checked={userItem.permissions?.canCreateOnBlockedDays ?? false}
                        onChange={(v) => handlePermissionChange(userItem, 'canCreateOnBlockedDays', v)}
                      />
                    </div>
                  </div>

                  {/* Visibility Settings for Diretoria */}
                  {userItem.role === 'diretoria' && (
                    <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <h4 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Eye className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                        Configurações de Visibilidade
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <VisibilityToggle
                          label="Mostrar Nome"
                          description="Pode ser visto por outros usuários"
                          checked={userItem.visibilitySettings?.showName ?? true}
                          onChange={async (v) => {
                            await updateDoc(doc(db, 'users', userItem.id), {
                              'visibilitySettings.showName': v
                            });
                          }}
                        />
                        <VisibilityToggle
                          label="Mostrar E-mail"
                          description="E-mail visível para outros"
                          checked={userItem.visibilitySettings?.showEmail ?? true}
                          onChange={async (v) => {
                            await updateDoc(doc(db, 'users', userItem.id), {
                              'visibilitySettings.showEmail': v
                            });
                          }}
                        />
                        <VisibilityToggle
                          label="Mostrar Departamento"
                          description="Departamento visível para outros"
                          checked={userItem.visibilitySettings?.showDepartment ?? true}
                          onChange={async (v) => {
                            await updateDoc(doc(db, 'users', userItem.id), {
                              'visibilitySettings.showDepartment': v
                            });
                          }}
                        />
                        <VisibilityToggle
                          label="Mostrar na Lista"
                          description="Aparece na lista de usuários"
                          checked={userItem.visibilitySettings?.showProfile ?? true}
                          onChange={async (v) => {
                            await updateDoc(doc(db, 'users', userItem.id), {
                              'visibilitySettings.showProfile': v
                            });
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Permission Toggle Component
function PermissionToggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div 
      className="p-4 rounded-xl cursor-pointer transition-all"
      style={{ 
        background: checked ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-card)',
        border: `1px solid ${checked ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-subtle)'}`
      }}
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-start gap-3">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ 
            background: checked ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-input)'
          }}
        >
          {checked ? (
            <Check className="w-5 h-5" style={{ color: '#22c55e' }} />
          ) : (
            <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

// Visibility Toggle Component for Diretoria
function VisibilityToggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onChange(!checked);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="p-4 rounded-xl cursor-pointer transition-all"
      style={{ 
        background: checked ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
        border: `1px solid ${checked ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-subtle)'}`
      }}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ 
            background: checked ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-input)'
          }}
        >
          {checked ? (
            <Eye className="w-5 h-5" style={{ color: '#3b82f6' }} />
          ) : (
            <EyeOff className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
