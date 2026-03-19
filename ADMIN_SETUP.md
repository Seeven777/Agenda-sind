# 🚀 Sistema Admin - Guia de Configuração

## ✅ Implementação Concluída

### Arquivos Criados:
1. **src/lib/permissions.ts** - Lógica de permissões
2. **src/pages/AdminPanel.tsx** - Painel de administração
3. **src/pages/PrivateDashboard.tsx** - Dashboard privado do(s) proprietário(s)

### Arquivos Modificados:
1. **src/types.ts** - Novos campos (isAdmin, permissions, isPersonal)
2. **src/App.tsx** - Novas rotas
3. **src/components/Layout.tsx** - Menus condicionais
4. **src/pages/CreateEvent.tsx** - Toggle de evento pessoal

---

## 👥 Administradores e Proprietários Definidos

| Email | Nome | Papel |
|-------|------|-------|
| gustavo13470@gmail.com | Você | Super Admin |
| gestaosindpetshop@gmail.com | Patrão | Super Admin + Proprietário |
| jnyce6@hotmail.com | Segundo Proprietário | Super Admin + Proprietário |

---

## 🎯 Como Funciona

### Para VOCÊ (gustavo13470@gmail.com):
- ✅ Acesso completo ao Painel Admin em `/admin`
- ✅ Pode gerenciar permissões de todos os usuários
- ✅ Ve todos os eventos (pessoais e normais)
- ✅ Pode criar/editar/excluir qualquer evento

### Para o PATRÃO (gestaosindpetshop@gmail.com):
- ✅ Acesso ao Painel Admin em `/admin`
- ✅ Acesso ao Dashboard Privado em `/private-dashboard` (Minha Agenda)
- ✅ Pode criar eventos pessoais (apenas ele vê os detalhes)
- ✅ Ao criar evento pessoal, outros usuários veem apenas "dia bloqueado"
- ✅ Pode bloquear dias sem outros conseguirem criar eventos nele

### Para OUTROS USUÁRIOS:
- Veem apenas eventos normais
- NÃO veem detalhes de eventos pessoais do patrão
- Veem apenas que o dia está "bloqueado"
- Precisam de permissão especial para criar em dias bloqueados

---

## 🔧 Próximos Passos (Manualmente no Firebase)

### 1. Acessar o Firebase Console
Acesse: https://console.firebase.google.com

### 2. Ir para Firestore Database
- Coleção: `users`

### 3. Adicionar campo `isAdmin: true` aos documentos dos proprietários:
- gestaosindpetshop@gmail.com
- jnyce6@hotmail.com
- gustavo13470@gmail.com (opcional)

```json
{
  "isAdmin": true
}
```

---

## 📱 Como Usar

### Patrão criando evento pessoal:
1. Vá para "Novo Evento"
2. Marque a opção **"Evento Pessoal"** (será a primeira opção visível)
3. Preencha os dados normalmente
4. O evento só será visível para ele (e para você/admin)

### Você gerenciando permissões:
1. Vá para "Painel Admin"
2. Clique em um usuário para expandir
3. Ative/desative as permissões desejadas:
   - ✅ Criar Eventos
   - ✅ Editar Eventos de Outros
   - ✅ Excluir Eventos de Outros
   - ✅ Ver Eventos Pessoais do Patrão
   - ✅ Criar em Dias Bloqueados

---

## 🔐 Sistema de Permissões

### Permissão: canCreateOnBlockedDays
- Se **FALSE** (padrão): usuário NÃO pode criar eventos em dias marcados como pessoais pelo patrão
- Se **TRUE**: usuário PODE criar eventos em qualquer dia, mesmo os reservados pelo patrão

### Permissão: canSeePersonalEvents
- Se **FALSE** (padrão): usuário NÃO vê detalhes de eventos pessoais do patrão
- Se **TRUE**: usuário vê todos os eventos (inclusive pessoais do patrão)

---

## 📝 Notas Importantes

1. **O campo `isPersonal` nos eventos** é definido automaticamente quando o patrão cria um evento pessoal
2. **O campo `createdBy`** identifica quem criou o evento
3. **Você e o patrão** sempre têm acesso total, independente das permissões

---

## 🎨 Interface

### Menu do Patrão:
- Dashboard normal
- Calendário
- Novo Evento
- **Minha Agenda** (Dashboard Privado) ⭐
- **Painel Admin**

### Menu de Usuário Comum:
- Dashboard normal
- Calendário
- Novo Evento

### Menu do Admin (você):
- Dashboard normal
- Calendário
- Novo Evento
- **Painel Admin** ⭐

---

**Qualquer dúvida, consulte o arquivo IMPLEMENTATION_PLAN.md**
