# Sistema de Notificações Push - Agenda Sind

Este documento explica como configurar e usar o sistema de notificações push do aplicativo.

## 📱 Visão Geral

O sistema de notificações permite que os usuários recebam lembretes de eventos:
- **24 horas antes** do evento
- **1 hora antes** do evento

As notificações funcionam em:
- **Mobile**: Notificações push mesmo com o app fechado
- **Desktop**: Notificações no navegador

## 🔧 Configuração Necessária

### 1. Configuração do Firebase Admin (Server-side)

Para que o servidor possa enviar notificações push, é necessário configurar o Firebase Admin:

#### Passo 1: Obter a chave de serviço do Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto `gen-lang-client-0540580910`
3. Vá em **Configurações do Projeto** → **Contas de Serviço**
4. Clique em **Gerar nova chave privada**
5. Salve o arquivo JSON gerado

#### Passo 2: Configurar a variável de ambiente

Adicione a variável `FIREBASE_SERVICE_ACCOUNT` ao seu ambiente:

**Desenvolvimento (.env):**
```bash
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

**Produção (Vercel):**
```
FIREBASE_SERVICE_ACCOUNT = {chave JSON completa}
```

### 2. Verificar o VAPID Key

A variável `VITE_FIREBASE_VAPID_KEY` já está configurada no `.env`:
```
VITE_FIREBASE_VAPID_KEY=BMbK9k7hSbnnvhOBBpKh9CQhXx870d5vZyKHblD5WfAqAprPdDousSdtCSEQNobnB-5Y_ohJIVm6FVKhJv1IWEg
```

### 3. Configurar o Cloud Messaging no Firebase Console

1. Acesse o Firebase Console
2. Vá em **Messaging** → **Criar primeira campanha** (ou Configurações)
3. Configure as credenciais web (Web Push certificates)
4. Gere um VAPID Key se ainda não tiver

## 🚀 Como Funciona

### Fluxo de Notificações

1. **Usuário faz login** → Sistema solicita permissão de notificação
2. **Permissão concedida** → FCM Token é salvo no Firestore (coleção `users`)
3. **Evento é criado** → Campos `notify24h` e `notify1h` são salvos
4. **Scheduler verifica eventos** → A cada 5 minutos, verifica eventos pendentes
5. **Notificação enviada** → Push notification é enviada via Firebase Cloud Messaging

### Client-side (Navegador/App)

O `service worker` (`firebase-messaging-sw.js`) é responsável por:
- Receber notificações em background
- Mostrar notificações quando o app está fechado
- Processar cliques nas notificações

### Server-side (Cron Jobs)

O servidor (`server.ts`) executa:
- Scheduler para notificações de 24h (a cada 5 minutos)
- Scheduler para notificações de 1h (a cada 5 minutos)
- API para teste de notificações

## 📋 API Endpoints

### GET /api/health
Retorna o status do servidor.

```json
{
  "status": "ok",
  "firebaseAdmin": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/notifications/check
Verifica quais eventos precisam de notificação.

```bash
curl -X POST http://localhost:3000/api/notifications/check
```

### POST /api/notifications/test
Envia uma notificação de teste.

```bash
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"fcmToken": "seu_token_fcm_aqui"}'
```

## 🧪 Testando Notificações

### 1. Teste Local

1. Inicie o servidor:
```bash
npm run dev
```

2. Abra o navegador e faça login no app
3. Clique no ícone de sino 🔔 no header
4. Ative as notificações
5. Crie um evento para daqui a 24h ou 1h
6. Aguarde o scheduler executar (verifique os logs do servidor)

### 2. Teste Manual

```bash
# Obtenha o FCM token do usuário (veja no console do navegador)
# Ou consulte a coleção 'users' no Firestore

# Envie uma notificação de teste
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"fcmToken": "seu_token"}'
```

## ⚙️ Estrutura de Dados

### Usuário (Firestore: users/{userId})

```typescript
interface User {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: Role;
  fcmToken?: string;      // Token FCM para push
  fcmTokenUpdatedAt?: string;
}
```

### Evento (Firestore: events/{eventId})

```typescript
interface Event {
  id: string;
  title: string;
  date: string;           // Formato: YYYY-MM-DD
  time: string;           // Formato: HH:mm
  notify24h?: boolean;    // Notificar 24h antes
  notify1h?: boolean;     // Notificar 1h antes
  createdBy: string;      // UID do criador
  creatorName: string;
  // ... outros campos
}
```

### Log de Notificação (Firestore: notification_logs)

```typescript
interface NotificationLog {
  eventId: string;
  userId: string;
  type: '24h' | '1h';
  success: boolean;
  timestamp: Timestamp;
}
```

## 🔒 Permissões

- Apenas o criador do evento recebe as notificações
- Notificações são enviados apenas para eventos com status `agendado`
- Notificações não são enviadas para eventos passados

## 🐛 Troubleshooting

### Notificações não aparecem

1. **Verifique a permissão do navegador**
   -Chrome: `chrome://settings/content/notifications`
   -Firefox: `about:preferences#privacy` → Notificações
   -Safari: Preferências → Websites → Notificações

2. **Verifique o Service Worker**
   -Abra DevTools → Application → Service Workers
   -Verifique se está registrado

3. **Verifique o FCM Token**
   -Abra DevTools → Console
   -Verifique se o token foi gerado e salvo

4. **Verifique o Firebase Admin**
   -Verifique se `FIREBASE_SERVICE_ACCOUNT` está configurado
   -Verifique os logs do servidor

### Erro "messaging/permission-blocked"

O usuário bloqueou as notificações. Instrua-o a:
1. Clicar no ícone de cadeado na barra de URL
2. Ir em "Notificações"
3. Selecionar "Allow"

## 📱 Configuração Mobile (PWA)

Para funcionar como app no celular:

1. Abra o site no Chrome mobile
2. Toque em "Instalar" ou no menu → "Adicionar à Tela Inicial"
3. O app instalado receberá notificações push

## 🔄 Atualizações

### Quando o Service Worker é atualizado

O service worker é atualizado automaticamente quando há mudanças. Para forçar atualização:

```javascript
// No código
navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
```

---

Dúvidas? Verifique os logs do console do navegador e do servidor para mais detalhes.
