# TODO - Correções Agenda Sind

## Status: ✅ Phase 1 Quase Completa

## Phase 1: Correções Críticas (Prioridade Alta)
- ✅ 1.1 src/types.ts - photoUrl adicionado ao User (já estava lá!)
- ✅ 1.2 src/components/ProfileModal.tsx - Removido (user as any).photoUrl → crash fix
- ✅ 1.3 src/contexts/ThemeContext.tsx - Removido body.style hacks, CSS vars limpos
- [ ] 1.4 **Testar:** Profile edit + theme toggle (npm run dev)

## Phase 2: Notificações Multi-dispositivo ⭐ PRIORIDADE
- ✅ 2.1 src/lib/firebase.ts - onMessage + Layout setupForegroundNotifications

- ✅ 2.2 server.ts - Cloud Function simulada onEventCreated

- [ ] 2.3 firebase deploy --only functions  
- [ ] 2.4 Testar multi-device

## Phase 3: Melhorias
- [ ] Recurrence tooltip/confirmação
- [ ] Busca global eventos
- [ ] Reminders 24h/1h Cloud Function

**Próximo:** Teste Phase 1 → Phase 2 notificações
**Comando:** npm run dev
