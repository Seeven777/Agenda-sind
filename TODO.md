# TODO: Adicionar Edição de Cards Próprios

## Passos do Plano Aprovado

### 1. ✅ Criar TODO.md e ler arquivos dependentes (Dashboard.tsx, firestore.rules)
### 2. ✅ Editar src/components/EventCard.tsx (botão editar + hover fix)
### 3. ✅ Editar src/pages/Dashboard.tsx (useNavigate + onEdit em todos cards)
### 4. Verificar/Atualizar firestore.rules para allow update if createdBy == uid
### 5. Testar funcionalidade
### 6. Marcar como ✅ Completo e attempt_completion

**Status: ✅ Fixes aplicados - rota corrigida para /events/:id/edit + imports EditEvent.tsx. Teste novamente!**


   - Adicionar prop onEdit
   - Remover Link do container, tornar clicável só em partes
   - Adicionar botão Editar condicional (useAuth().user?.uid === event.createdBy)
### 3. Editar src/pages/Dashboard.tsx
   - Adicionar useNavigate
   - Passar onEdit={(id) => navigate(`/edit/${id}`)} para todos EventCard
### 4. Verificar/Atualizar firestore.rules para allow update if createdBy == uid
### 5. Testar funcionalidade
### 6. Marcar como ✅ Completo e attempt_completion

**Status: Iniciando edições...**

