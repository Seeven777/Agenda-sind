# 📋 Guia de Permissões do Sistema Agenda-SIND

## 📧 Identificação de Usuários por Email

### Super Admins (Acesso Total)
| Email | Descrição |
|-------|-----------|
| `gustavo13470@gmail.com` | Desenvolvedor |
| `jnyce6@hotmail.com` | Proprietário |

### Proprietário (Dashboard Privado)
| Email | Descrição |
|-------|-----------|
| `jnyce6@hotmail.com` | Patão/Dono da empresa |

---

## 🎭 Cargos Disponíveis (Roles)

```
admin | diretoria | juridico | comunicacao | fiscalizacao | administrativo
```

---

## 🔐 Sistema de Permissões

### Permissões Padrão para Novos Usuários

```typescript
{
  canCreateEvents: true,           // Pode criar eventos
  canEditOthersEvents: false,      // Não pode editar eventos de outros
  canDeleteOthersEvents: false,   // Não pode excluir eventos de outros
  canSeePersonalEvents: false,    // Não pode ver eventos pessoais do patrão
  canCreateOnBlockedDays: false   // Não pode criar em dias bloqueados
}
```

---

## 👥 Níveis de Acesso

### 1. SUPER ADMIN (Desenvolvedor/Proprietário)
**Email:** `gustavo13470@gmail.com`

| Permissão | Status |
|-----------|--------|
| `canCreateEvents` | ✅ Sempre true |
| `canEditOthersEvents` | ✅ Sempre true |
| `canDeleteOthersEvents` | ✅ Sempre true |
| `canSeePersonalEvents` | ✅ Sempre true |
| `canCreateOnBlockedDays` | ✅ Sempre true |
| Acesso ao AdminPanel | ✅ Sim |
| Dashboard Privado | ✅ Sim |

### 2. PROPRIETÁRIO (Boss)
**Email:** `jnyce6@hotmail.com`

| Permissão | Status |
|-----------|--------|
| `canCreateEvents` | ✅ Sempre true |
| `canEditOthersEvents` | ✅ Sempre true |
| `canDeleteOthersEvents` | ✅ Sempre true |
| `canSeePersonalEvents` | ✅ Sempre true |
| `canCreateOnBlockedDays` | ✅ Sempre true |
| Criar Eventos Pessoais | ✅ Sim |
| Dashboard Privado | ✅ Sim |
| Ver rota no Maps | ✅ Sim |

### 3. ADMIN (Usuário com role="admin")
**Observação:** Parece não estar completamente implementado no código

| Permissão | Status |
|-----------|--------|
| `canCreateEvents` | ✅ Sempre true (se isAdmin=true) |
| `canEditOthersEvents` | ✅ Sempre true (se isAdmin=true) |
| `canDeleteOthersEvents` | ✅ Sempre true (se isAdmin=true) |
| `canSeePersonalEvents` | ✅ Sempre true (se isAdmin=true) |
| `canCreateOnBlockedDays` | ✅ Sempre true (se isAdmin=true) |

### 4. DIRETORIA
**Role:** `diretoria`

| Permissão | Padrão | Comportamento |
|-----------|--------|---------------|
| `canCreateEvents` | true | Pode criar eventos |
| `canEditOthersEvents` | false | Não pode editar de outros |
| `canDeleteOthersEvents` | false | Não pode excluir de outros |
| `canSeePersonalEvents` | false | Pode ver eventos do patrão |
| `canCreateOnBlockedDays` | false | Não pode criar em dias bloqueados |

**Configurações de Visibilidade (opcionais):**
```typescript
{
  showName: true,        // Nome visível para outros
  showEmail: true,       // Email visível para outros
  showDepartment: true,  // Departamento visível
  showProfile: true      // Aparece na lista de usuários
}
```

### 5. USUÁRIOS NORMAIS
**Roles:** `juridico`, `comunicacao`, `fiscalizacao`, `administrativo`

| Permissão | Padrão | Comportamento |
|-----------|--------|---------------|
| `canCreateEvents` | true | Pode criar eventos |
| `canEditOthersEvents` | false | Não pode editar de outros |
| `canDeleteOthersEvents` | false | Não pode excluir de outros |
| `canSeePersonalEvents` | false | Não vê eventos pessoais |
| `canCreateOnBlockedDays` | false | Não pode criar em dias bloqueados |

---

## 🔒 Lógica de Ocultação de Eventos

### shouldHideEvent()
```javascript
// Se usuário for Admin ou Super Admin → Não oculta nada
// Se usuário NÃO tiver canSeePersonalEvents → Oculta eventos do patrão

if (eventCreatorEmail === 'jnyce6@hotmail.com' && evento.isPersonal === true) {
  return true; // Oculta para usuários normais
}
```

### shouldHideEventCompletely()
Oculta eventos pessoais de forma mais restritiva:
- ✅ Se não é pessoal → mostra
- ✅ Se é pessoal e é o criador → mostra
- ✅ Se é diretoria ou admin → mostra
- ✅ Se tem `canSeePersonalEvents` → mostra
- ❌ Caso contrário → oculta

---

## 📅 Dias Bloqueados

### canCreateEventOnDate()
```javascript
// Se Admin/Super Admin → Pode criar sempre
// Se data está bloqueada → Verifica canCreateOnBlockedDays
// Caso contrário → Verifica canCreateEvents
```

---

## 👁️ Configurações de Visibilidade (Diretoria)

### shouldShowName()
- Próprio usuário → ✅ Sempre mostra
- Super Admin → ✅ Sempre mostra
- Diretoria → Conforme `visibilitySettings.showName`

### shouldShowEmail()
- Próprio usuário → ✅ Sempre mostra
- Super Admin → ✅ Sempre mostra
- Diretoria → Conforme `visibilitySettings.showEmail`

### shouldShowDepartment()
- Próprio usuário → ✅ Sempre mostra
- Super Admin → ✅ Sempre mostra
- Diretoria → Conforme `visibilitySettings.showDepartment`

### shouldShowProfile()
- Próprio usuário → ✅ Sempre mostra
- Super Admin → ✅ Sempre mostra
- Diretoria → Conforme `visibilitySettings.showProfile`

---

## 🐛 Problemas Identificados / Inconsistências

### 1. Conflito entre `isAdmin` e `isSuperAdmin`
```typescript
// Em permissions.ts:
if (user.isAdmin || isSuperAdmin(user.email)) return true;

// BOSS_EMAILS não inclui gustavo13470@gmail.com como Super Admin
// O que significa que gustavo é Super Admin mas NÃO é Boss
```

### 2. Admin Panel mostra "Proprietário" para Boss
```typescript
const isBoss = !!userItem.email && BOSS_EMAILS.includes(...);
```
- Mostra coroa laranja para `jnyce6@hotmail.com`
- Mostra "Proprietário" como badge

### 3. Permissões Admin vs Super Admin
- `isAdmin` no Firebase parece ser diferente de `isSuperAdmin()`
- Não está claro se `isAdmin` no campo do usuário é realmente usado

### 4. Cargo "admin" vs Super Admin
- No painel há opção de role="admin"
- Mas a verificação usa `user.isAdmin || isSuperAdmin()`
- Parece haver redundância/confusão

---

## 📊 Fluxograma de Decisão

```
Usuário acessa evento
        │
        ▼
┌─────────────────────────┐
│ isAdmin || isSuperAdmin │───Sim───► MOSTRA TUDO ✅
└─────────┬───────────────┘
          │ Não
          ▼
┌─────────────────────────┐
│ isDiretoria (role)     │───Sim───► MOSTRA EVENTOS ✅
└─────────┬───────────────┘
          │ Não
          ▼
┌─────────────────────────┐
│ isPersonal + isBoss    │───Sim───► OCLUI ❌
│ (criado pelo patrão)   │
└─────────┬───────────────┘
          │
          ▼
    MOSTRA EVENTOS ✅
```

---

## 🎯 Permissões Necessárias por Funcionalidade

| Funcionalidade | Permissão Necessária | Super Admin | Admin | Diretoria | Normal |
|----------------|---------------------|-------------|-------|-----------|--------|
| Ver Dashboard | - | ✅ | ✅ | ✅ | ✅ |
| Criar Evento | canCreateEvents | ✅ | ✅ | ✅ | ✅ |
| Editar próprio evento | - | ✅ | ✅ | ✅ | ✅ |
| Editar evento de outro | canEditOthersEvents | ✅ | ✅ | ❌ | ❌ |
| Excluir próprio evento | - | ✅ | ✅ | ✅ | ✅ |
| Excluir evento de outro | canDeleteOthersEvents | ✅ | ✅ | ❌ | ❌ |
| Ver eventos pessoais | canSeePersonalEvents | ✅ | ✅ | ❌ | ❌ |
| Criar em dia bloqueado | canCreateOnBlockedDays | ✅ | ✅ | ❌ | ❌ |
| Ver rota no Maps | - | ✅ | ✅ | ✅ | ✅ |
| Exportar relatório | - | ✅ | ✅ | ✅ | ✅ |
| Admin Panel | isSuperAdmin | ✅ | ❌ | ❌ | ❌ |

---

## 🔧 Como Corrigir/Revisar Permissões

1. **Verificar quem tem acesso ao que** - Consultar AdminPanel
2. **Ajustar permissões individuais** - Usar os toggles no AdminPanel
3. **Alterar cargo** - Selecionar novo role no AdminPanel
4. **Ativar/Desativar usuário** - Usar botão no AdminPanel
5. **Configurar visibilidade** - Para usuarios com role="diretoria"

---

## 📝 Notas de Implementação

- Super Admin é determinado **APENAS por email** em `SUPER_ADMINS[]`
- `isAdmin` no campo do usuário **parece não ser utilizado**
- Proprietário (Boss) é determinado **APENAS por email** em `BOSS_EMAILS[]`
- Cargos são configuráveis no AdminPanel
- Permissões individuais podem ser ativadas no AdminPanel
