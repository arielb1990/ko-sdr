# KO-SDR — SDR Autónomo con IA

Plataforma de prospección B2B automatizada para Known Online. Descubre leads en Apollo.io, los investiga con Claude, los califica, obtiene aprobación del CCO, y envía emails personalizados via ICOMM. Las respuestas se clasifican automáticamente y los leads interesados se sincronizan con HubSpot.

## Stack

- Next.js 16 + React 19 + Tailwind CSS 4
- Prisma v7 + PostgreSQL 16
- Redis 7 + BullMQ (8 workers)
- Anthropic SDK (Claude Sonnet 4 / Haiku)
- Apollo.io, ICOMM (SMTP), HubSpot

## Pipeline

```
Apollo Discovery → AI Research → AI Scoring → Cola de Aprobación
    → AI Copywriter → Email Outreach (ICOMM) → AI Clasificación de respuestas
    → HubSpot Sync (Contact + Deal)
```

## Setup local

### 1. Clonar y dependencias

```bash
git clone <repo-url> ko-sdr
cd ko-sdr
npm install
```

### 2. Levantar infraestructura

```bash
docker compose up -d  # PostgreSQL (5441) + Redis (6383)
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con las API keys reales
```

### 4. Base de datos

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

### 5. Ejecutar

```bash
# Terminal 1: app
npm run dev

# Terminal 2: workers
npm run worker
```

### 6. Acceder

- App: http://localhost:3000
- Login: `admin@knownonline.com` / `admin123`

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `AUTH_SECRET` | Secret para Auth.js (generar random) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `APOLLO_API_KEY` | Apollo.io API key |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app token |
| `ANTHROPIC_API_KEY` | Claude API key |

Las API keys y tokens también se configuran desde la UI en `/settings`.

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia Next.js en desarrollo |
| `npm run worker` | Inicia los 9 workers de BullMQ (incluye Gmail poller) |
| `npm run build` | Build de producción |
| `npm run db:migrate` | Corre migraciones de Prisma |
| `npm run db:seed` | Seed de datos iniciales |
| `npm run db:studio` | Abre Prisma Studio |
| `npm test` | Corre tests (vitest) |
| `npm run test:watch` | Tests en modo watch |

## Deploy (Dokploy)

1. Crear proyecto en Dokploy → Docker Compose
2. Usar `docker-compose.prod.yml`
3. Cargar variables de entorno en el panel
4. Asignar dominio + SSL
5. Deploy

El compose de producción levanta 4 servicios: app, workers, db, redis.

## Configuración de Outreach (Gmail + LinkedIn)

### Gmail (envío de emails)

Los emails se envían directamente desde cuentas de Gmail / Google Workspace. Se ven naturales, aparecen en la bandeja de enviados, y las respuestas se detectan automáticamente.

**Setup:**

1. Tener un proyecto en Google Cloud Console con las APIs de Gmail habilitadas
2. Configurar OAuth consent screen (scopes: `gmail.send`, `gmail.readonly`)
3. Crear credenciales OAuth 2.0 (Web application)
4. Agregar `http://localhost:3000/api/auth/gmail/callback` como redirect URI (y la URL de producción)
5. Cargar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env` (los mismos que para login)
6. En la app: Settings → Gmail → "Conectar cuenta de Google"
7. Repetir para cada cuenta que quieras usar (ej: `sdr1@empresa.com`, `sdr2@empresa.com`)

**Comportamiento:**
- Rotación automática entre cuentas (la que menos envió hoy va primero)
- Límite de 50 emails/día por cuenta
- Follow-ups van al mismo thread de Gmail (se ven como conversación)
- Gmail Poller revisa la bandeja cada 5 minutos buscando respuestas
- Al detectar una respuesta: pausa la secuencia, clasifica con IA, si es interesado → HubSpot

### PhantomBuster (LinkedIn)

Se usa PhantomBuster para automatizar acciones de LinkedIn: solicitudes de conexión con nota personalizada y mensajes directos.

**Setup:**

1. Crear cuenta en [phantombuster.com](https://phantombuster.com)
2. Ir a tu dashboard de PhantomBuster
3. Crear un Phantom **"LinkedIn Auto Connect"**:
   - Buscar "LinkedIn Auto Connect" en el store de Phantoms
   - Configurarlo con tu cuenta de LinkedIn (session cookie)
   - Copiar el **Agent ID** (se ve en la URL o en la configuración del phantom)
4. Crear un Phantom **"LinkedIn Message Sender"**:
   - Buscar "LinkedIn Message Sender" en el store
   - Configurarlo con tu cuenta de LinkedIn
   - Copiar el **Agent ID**
5. Obtener tu **API Key** de PhantomBuster: Settings → API → copiar la key
6. En la app: Settings → PhantomBuster:
   - Pegar la API Key
   - Pegar el Agent ID de Auto Connect
   - Pegar el Agent ID de Message Sender

### Secuencias Multi-Canal

Las secuencias soportan pasos de distintos tipos que se pueden combinar libremente:

| Tipo de paso | Canal | Qué hace |
|-------------|-------|----------|
| **Email** | Gmail | Envía email personalizado por IA desde Gmail. Subject + body. |
| **LinkedIn Conexión** | PhantomBuster | Envía solicitud de conexión con nota personalizada (máx 300 chars). |
| **LinkedIn Mensaje** | PhantomBuster | Envía mensaje directo por LinkedIn. |

**Ejemplo de secuencia multi-canal:**

| Paso | Tipo | Delay | Descripción |
|------|------|-------|-------------|
| 1 | LinkedIn Conexión | 0 días | Nota personalizada mencionando algo de la empresa |
| 2 | Email | 3 días | Primer email con propuesta de valor + caso de éxito |
| 3 | Email | 5 días | Follow-up (mismo thread de Gmail) con ángulo diferente |
| 4 | LinkedIn Mensaje | 3 días | Mensaje corto preguntando si vio el email |

**Detección de respuestas:**
- Para **emails**: el Gmail Poller revisa cada 5 minutos. Si alguien responde, la secuencia se pausa automáticamente.
- Para **LinkedIn**: actualmente no se detectan respuestas automáticas de LinkedIn. Si un lead responde por LinkedIn, hay que pausar manualmente.
- La IA clasifica cada respuesta como: INTERESTED, NOT_NOW, NOT_INTERESTED, OUT_OF_OFFICE, BOUNCE.
- Si es INTERESTED → se crea un contacto + deal en HubSpot automáticamente.

## Arquitectura

### Páginas

| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard con pipeline funnel y stats |
| `/leads` | Lista de leads con búsqueda y filtros |
| `/leads/[id]` | Detalle del lead (contacto, empresa, IA, score) |
| `/approval` | Cola de aprobación del CCO (individual + batch) |
| `/sequences` | Builder de secuencias multi-canal (email + LinkedIn) |
| `/exclusions` | Gestión de exclusiones (dominio, email, empresa) |
| `/icp` | Configuración de ICP + trigger de discovery |
| `/knowledge` | Knowledge base (casos de éxito, servicios) |
| `/analytics` | Funnel, outreach stats, performance por secuencia/ICP |
| `/settings` | API keys, Gmail accounts, PhantomBuster, aprobación, modo autónomo |

### Workers (BullMQ)

| Worker | Función |
|--------|---------|
| `discovery` | Busca leads en Apollo.io por ICP |
| `research` | Investiga empresas con Claude (scrape web + IA) |
| `scoring` | Califica leads 0-100 contra ICP |
| `approval-prep` | Prepara items para cola de aprobación |
| `copywriter` | Genera copy personalizado con IA (email + LinkedIn) |
| `outreach` | Envía emails via Gmail o acciones LinkedIn via PhantomBuster |
| `response-classification` | Clasifica replies con IA |
| `hubspot-sync` | Sync bidireccional con HubSpot |
| `gmail-poller` | Revisa Gmail cada 5 min buscando respuestas |

### Webhooks

| Endpoint | Función |
|----------|---------|
| `POST /api/webhooks/icomm` | Eventos de email legacy (open, click, reply, bounce) |
| `POST /api/webhooks/hubspot` | Cambios de contactos en HubSpot |
| `GET /api/auth/gmail` | Inicia OAuth flow para conectar cuenta Gmail |
| `GET /api/auth/gmail/callback` | Callback del OAuth de Gmail |

## Roles

| Rol | Permisos |
|-----|----------|
| `ADMIN` | Acceso total + settings |
| `CCO` | Aprobación + settings + todo lo demás |
| `SDR_MANAGER` | Todo excepto settings sensibles |
| `VIEWER` | Solo lectura |
