# Plano de Implementação - Sistema Admin

## Administradores
- **gustavo13470@gmail.com** (Desenvolvedor/Admin)
- **gestaosindpetshop@gmail.com** (Patrão - Dono da conta)

## Estrutura de Permissões

### Super Admin (você e patrão)
- Acesso total ao sistema
- Podem gerenciar todos os usuários
- Podem definir permissões
- Veem todos os eventos
- Podem criar dashboard privado

### Usuários Comuns
- Permissões limitadas configuradas pelos admins

## Arquivos a Modificar/Criar

### 1. types.ts
- Adicionar `isPersonal` em Event
- Adicionar `isAdmin` em User
- Adicionar `permissions` em User

### 2. src/lib/permissions.ts (NOVO)
- Funções de verificação de permissões
- Lista de admins

### 3. src/pages/AdminPanel.tsx (NOVO)
- Listar usuários
- Editar permissões
- Ativar/desativar usuários

### 4. src/pages/PrivateDashboard.tsx (NOVO)
- Dashboard pessoal do patrão
- Apenas gestaosindpetshop@gmail.com acessa

### 5. src/pages/CreateEvent.tsx
- Toggle "Evento Pessoal"

### 6. src/pages/Dashboard.tsx
- Mostrar "dia bloqueado" para usuários restritos

### 7. src/pages/Calendar.tsx
- Visual de dias bloqueados

### 8. src/components/Layout.tsx
- Menu "Painel Admin"
- Menu "Agenda Pessoal" (patrão)

### 9. src/App.tsx
- Novas rotas

## Status: PRONTO PARA IMPLEMENTAÇÃO
