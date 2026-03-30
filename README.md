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
| `ICOMM_SMTP_HOST` | ICOMM SMTP host |
| `ICOMM_SMTP_PORT` | ICOMM SMTP port (default 587) |
| `ICOMM_SMTP_USER` | ICOMM SMTP usuario |
| `ICOMM_SMTP_PASS` | ICOMM SMTP contraseña |
| `ANTHROPIC_API_KEY` | Claude API key |
| `EMAIL_DOMAIN` | Dominio para cold email |

Las API keys también se configuran desde la UI en `/settings`.

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia Next.js en desarrollo |
| `npm run worker` | Inicia los 8 workers de BullMQ |
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

## Arquitectura

### Páginas

| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard con pipeline funnel y stats |
| `/leads` | Lista de leads con búsqueda y filtros |
| `/leads/[id]` | Detalle del lead (contacto, empresa, IA, score) |
| `/approval` | Cola de aprobación del CCO (individual + batch) |
| `/sequences` | Builder de secuencias de email multi-step |
| `/exclusions` | Gestión de exclusiones (dominio, email, empresa) |
| `/icp` | Configuración de ICP + trigger de discovery |
| `/knowledge` | Knowledge base (casos de éxito, servicios) |
| `/analytics` | Funnel, outreach stats, performance por secuencia/ICP |
| `/settings` | API keys, ICOMM, aprobación, modo autónomo |

### Workers (BullMQ)

| Worker | Función |
|--------|---------|
| `discovery` | Busca leads en Apollo.io por ICP |
| `research` | Investiga empresas con Claude (scrape web + IA) |
| `scoring` | Califica leads 0-100 contra ICP |
| `approval-prep` | Prepara items para cola de aprobación |
| `copywriter` | Genera emails personalizados con IA |
| `outreach` | Envía emails via ICOMM SMTP |
| `response-classification` | Clasifica replies con IA |
| `hubspot-sync` | Sync bidireccional con HubSpot |

### Webhooks

| Endpoint | Función |
|----------|---------|
| `POST /api/webhooks/icomm` | Eventos de email (open, click, reply, bounce) |
| `POST /api/webhooks/hubspot` | Cambios de contactos en HubSpot |

## Roles

| Rol | Permisos |
|-----|----------|
| `ADMIN` | Acceso total + settings |
| `CCO` | Aprobación + settings + todo lo demás |
| `SDR_MANAGER` | Todo excepto settings sensibles |
| `VIEWER` | Solo lectura |
