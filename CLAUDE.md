@AGENTS.md

# KO-SDR — SDR Autónomo con IA

## Qué es
Plataforma de prospección B2B para Known Online. Pipeline automatizado: Apollo.io → AI Research → Scoring → Aprobación → Email Outreach → Reply Classification → HubSpot Sync.

## Stack y patrones

- **Next.js 16.2**: usa `proxy.ts` (NO `middleware.ts`, está deprecado)
- **Prisma v7.6**: config en `prisma.config.ts` en la RAÍZ (no dentro de `prisma/`), usa `defineConfig` de `prisma/config`
- **Auth.js v5**: JWT strategy, Google + Credentials, roles en token
- **BullMQ**: 8 workers en proceso separado (`npm run worker`), NO dentro de Next.js
- **Anthropic SDK**: tool_use para outputs estructurados en todos los servicios de IA
- **Tailwind CSS 4**: `@import "tailwindcss"` + `@theme inline` en globals.css

## Estructura clave

```
src/
├── app/(auth)/login/       # Login page
├── app/(dashboard)/        # Todas las páginas del dashboard
├── app/api/                # API routes
├── workers/                # BullMQ workers (proceso separado)
├── services/               # Apollo, email, hubspot
├── services/ai/            # researcher, scorer, copywriter, classifier
├── lib/                    # db, auth, redis, queue, utils
└── generated/prisma/       # Prisma client generado (gitignored)
```

## Comandos importantes

```bash
docker compose up -d              # PostgreSQL (5441) + Redis (6383)
npm run dev                       # Next.js
npm run worker                    # BullMQ workers
npx prisma migrate dev --name X   # Nueva migración
npx prisma generate               # Regenerar client
npm run db:seed                   # Seed datos iniciales
npm test                          # Vitest
```

## Puertos (no colisionar con otros proyectos)

- PostgreSQL: **5441**
- Redis: **6383**
- App: **3000**

## Cosas a tener en cuenta

- Los API keys se guardan en la tabla Organization, NO en .env (excepto ANTHROPIC_API_KEY como fallback)
- `isExcluded()` en `discovery.worker.ts` es exportada para tests
- El classifier usa Claude Haiku (más barato), el resto usa Sonnet
- El warm-up de email es progresivo: 5→15→30→50→100 emails/día
- El modo autónomo auto-aprueba leads con score >= `autoApproveThreshold`
