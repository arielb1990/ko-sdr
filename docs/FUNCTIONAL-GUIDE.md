# KO-SDR — Guía Funcional

## Qué es KO-SDR

KO-SDR es la plataforma de prospección B2B automatizada de Known Online. Funciona como un SDR (Sales Development Representative) inteligente que:

1. **Descubre** leads potenciales usando Apollo.io
2. **Investiga** cada empresa con inteligencia artificial
3. **Califica** cada lead con un score de 0 a 100
4. **Espera aprobación** del CCO antes de contactar
5. **Envía** emails personalizados desde Gmail y solicitudes de conexión en LinkedIn
6. **Detecta** respuestas automáticamente y clasifica el interés
7. **Sincroniza** leads interesados con HubSpot

---

## Acceso

- **URL**: https://sdr.knownonline.com
- **Roles disponibles**:
  - **ADMIN**: acceso total, puede configurar API keys y settings
  - **CCO**: aprobación de leads y mensajes, acceso a todo
  - **SDR_MANAGER**: gestión de secuencias e ICPs, sin settings sensibles
  - **VIEWER**: solo lectura

---

## Flujo completo paso a paso

### Paso 1: Configurar el ICP (Ideal Customer Profile)

**Dónde**: Menú lateral → **ICP**

El ICP define qué tipo de empresa y persona estamos buscando. Se configuran:

- **Países**: Argentina, Uruguay, Chile, Ecuador, Perú, Panamá, Guatemala, Costa Rica, USA
- **Tamaño de empresa**: rangos de empleados (11-50, 51-200, 201-500, etc.)
- **Cargos objetivo**: Director de Ecommerce, CMO, CTO, CEO, etc.
- **Industrias a incluir**: opcional, filtra por industrias específicas
- **Industrias a excluir**: evita competidores u otros sectores no deseados
- **Keywords**: términos como "ecommerce", "transformación digital" que la empresa debe tener

Se pueden crear múltiples ICPs (ej: uno para LATAM y otro para USA).

### Paso 2: Ejecutar Discovery

**Dónde**: ICP → botón naranja **"Discovery"** en cada configuración

Al ejecutar un discovery:

1. KO-SDR busca en Apollo.io personas que coincidan con los filtros del ICP
2. Cada persona encontrada se enriquece para obtener su email
3. Se cruza contra la lista de exclusiones (dominios, emails, empresas excluidas)
4. Los leads nuevos se crean en el sistema con status **DISCOVERED**
5. Automáticamente se encola la investigación con IA

**Límite**: configurable en Settings → Discovery → "Máximo de leads a enriquecer por run". Cada lead enriquecido consume 1 crédito de Apollo.

### Paso 3: Investigación automática con IA

Después del discovery, la IA investiga automáticamente cada lead:

1. **Research**: Claude visita el sitio web de la empresa y genera:
   - Brief de la empresa (qué hace, presencia digital)
   - Pain points potenciales en ecommerce/digital
   - Servicios de KO relevantes (VTEX, Magento, SEO, etc.)
   - Hooks de personalización para el primer contacto

2. **Scoring**: Claude califica al lead de 0 a 100 basándose en:
   - Coincidencia del cargo con el ICP
   - Tamaño y sofisticación de la empresa
   - Señales de necesidad de servicios digitales
   - País e industria

   Criterios de score:
   - **80-100**: Excelente fit, alta prioridad
   - **60-79**: Buen fit, vale la pena contactar
   - **40-59**: Fit moderado
   - **0-39**: Bajo fit → se descalifica automáticamente

3. Los leads con score ≥ 60 pasan a **QUALIFIED** y entran en la cola de aprobación.

### Paso 4: Aprobación del CCO

**Dónde**: Menú lateral → **Aprobación**

El CCO ve una lista de leads calificados esperando revisión. Para cada lead se muestra:

- Nombre, cargo, empresa, país
- Score con la explicación de por qué la IA le dio ese puntaje
- Brief de la empresa, pain points, servicios relevantes

**Acciones disponibles**:
- ✅ **Aprobar**: el lead pasa a status APPROVED y puede ser inscripto en una secuencia
- ❌ **Rechazar**: el lead se descarta
- **Batch**: seleccionar múltiples leads y aprobar/rechazar todos de una vez

**Modo autónomo**: en Settings se puede configurar un threshold (ej: 80). Los leads con score ≥ threshold se aprueban automáticamente sin pasar por la cola.

### Paso 5: Crear secuencias de outreach

**Dónde**: Menú lateral → **Secuencias**

Una secuencia es un flujo de contacto multi-paso. Cada paso puede ser:

| Tipo | Canal | Descripción |
|------|-------|-------------|
| **Email** | Gmail | Email personalizado por IA. Subject + body. Sale desde Gmail. |
| **LinkedIn Conexión** | PhantomBuster | Solicitud de conexión con nota personalizada (máx 300 chars). |
| **LinkedIn Mensaje** | PhantomBuster | Mensaje directo por LinkedIn. |

**Ejemplo de secuencia**:

| Paso | Tipo | Delay | Descripción |
|------|------|-------|-------------|
| 1 | LinkedIn Conexión | 0 días | Nota mencionando algo específico de la empresa |
| 2 | Email | 3 días | Propuesta de valor + caso de éxito del mismo sector |
| 3 | Email follow-up | 5 días | Nuevo ángulo, referencia al email anterior |
| 4 | LinkedIn Mensaje | 3 días | Mensaje corto preguntando si vio el email |

Al crear una secuencia se configura:
- **Nombre** y descripción
- **Servicio a promover**: contexto para que la IA personalice (ej: "VTEX Commerce - migración")
- **Guía de tono**: instrucciones de estilo (ej: "Directo, sin formalidades excesivas")
- **Pasos**: tipo + template + delay en días

Los templates son guías — la IA los personaliza para cada lead usando el research de la empresa y casos de éxito relevantes de la Knowledge Base.

### Paso 6: Inscribir leads en secuencias

**Dónde**: Secuencias → botón **"Inscribir leads"**

Al hacer click, todos los leads con status APPROVED se inscriben en la secuencia. Entonces:

1. El **Copywriter** (IA) genera el contenido personalizado del primer paso
2. Si "Requiere aprobación de mensajes" está activado → el CCO revisa el mensaje antes de enviar
3. Si no → se envía automáticamente
4. Después del delay configurado, se genera y envía el siguiente paso
5. Y así hasta completar la secuencia

### Paso 7: Envío y detección de respuestas

**Emails (Gmail)**:
- Se envían desde cuentas de Gmail conectadas en Settings
- Rotación automática entre cuentas (la que menos envió hoy)
- Los follow-ups van al mismo thread de Gmail (se ven como conversación)
- Límite: 50 emails/día por cuenta
- Cada 5 minutos, el sistema revisa Gmail buscando respuestas

**LinkedIn (PhantomBuster)**:
- Las conexiones y mensajes se envían via PhantomBuster
- La nota de conexión se personaliza por IA (máx 300 caracteres)

**Al detectar una respuesta**:
1. La secuencia se **pausa automáticamente** (no se envían más pasos)
2. La IA clasifica la respuesta como:
   - **INTERESTED**: quiere saber más, acepta reunión
   - **NOT_NOW**: no es buen momento pero no cierra la puerta
   - **NOT_INTERESTED**: rechaza claramente
   - **OUT_OF_OFFICE**: respuesta automática
   - **BOUNCE**: email no existe
3. Si es **INTERESTED** → se crea automáticamente un contacto + deal en HubSpot

---

## Exclusiones

**Dónde**: Menú lateral → **Exclusiones**

Las exclusiones evitan contactar a personas o empresas que no queremos. Tipos:

| Tipo | Ejemplo | Efecto |
|------|---------|--------|
| **DOMAIN** | competidor.com | Excluye a toda persona de esa empresa |
| **EMAIL** | juan@ejemplo.com | Excluye a esa persona específica |
| **COMPANY_NAME** | Globant | Excluye por nombre (búsqueda parcial) |

**Formas de agregar exclusiones**:
- **Manual**: botón "Agregar" en la página de exclusiones
- **Importar Excel**: botón "Importar Excel" — acepta .xlsx, .xls, .csv con columnas `type`, `value`, `reason` (o solo una columna de valores, el sistema detecta el tipo)
- **Desde leads**: en la lista de leads, cada registro tiene botones para excluir el email o el dominio
- **Desde HubSpot**: automáticamente se sincronizan clientes existentes como exclusiones

---

## Knowledge Base

**Dónde**: Menú lateral → **Knowledge Base**

La Knowledge Base almacena información que la IA usa para personalizar los emails:

- **Casos de éxito**: "Migramos RetailX a VTEX, +40% conversión"
- **Servicios**: descripción de lo que ofrece Known Online
- **Verticales**: industrias donde KO tiene experiencia
- **Testimonios**: feedback de clientes

La IA busca automáticamente los casos más relevantes al sector del lead y los menciona como social proof en los emails.

**Carga de datos**:
- **Importar desde web**: scrapea knownonline.com para extraer servicios y casos públicos
- **Carga manual**: agregar items con título, descripción, industria, servicio, métricas, país

---

## Dashboard

**Dónde**: Menú lateral → **Dashboard**

Vista general del pipeline:

- **Stats**: total de leads, pendientes de aprobación, aprobados, interesados
- **Pipeline visual**: barras que muestran la cantidad de leads en cada etapa
- **Últimos Discovery Runs**: historial de búsquedas con stats (encontrados, nuevos, excluidos)

---

## Analytics

**Dónde**: Menú lateral → **Analytics**

Métricas detalladas con filtro por período (7, 14, 30, 90 días):

- **Outreach**: emails enviados, open rate, click rate, reply rate, bounce rate
- **Funnel**: gráfico de barras con la conversión en cada etapa del pipeline
- **Leads por día**: gráfico de líneas temporal
- **Performance por secuencia**: cuál secuencia tiene mejor reply rate e interest rate
- **Performance por ICP**: cuál configuración de ICP genera leads de mayor calidad
- **Export CSV**: descarga de todas las métricas

---

## Settings

**Dónde**: Menú lateral → **Settings**

### API Keys
- **Apollo.io**: para búsqueda de leads
- **HubSpot**: para sincronización de contactos/deals
- **Anthropic (Claude)**: para la IA de research, scoring, copywriting y clasificación

### Gmail (Email Outreach)
- Conectar cuentas de Google Workspace con botón "Conectar cuenta de Google"
- Se pueden conectar múltiples cuentas para rotación
- Los emails salen directamente desde Gmail

### PhantomBuster (LinkedIn)
- API Key de PhantomBuster
- Agent ID del Phantom "LinkedIn Auto Connect"
- Agent ID del Phantom "LinkedIn Message Sender" (opcional)

### Discovery
- **Máximo de leads por run**: controla cuántos leads se enriquecen por discovery (cada uno consume 1 crédito de Apollo)

### Aprobación
- **Requiere aprobación de leads**: si está activado, el CCO debe aprobar cada lead
- **Requiere aprobación de mensajes**: si está activado, el CCO revisa cada email/mensaje antes de enviar

### Modo Autónomo
- **Auto-aprobar leads con score ≥ X**: los leads que superen este threshold se aprueban sin pasar por la cola

### Cambiar contraseña
- Permite cambiar la contraseña del usuario actual

---

## Glosario de estados de un lead

| Status | Significado |
|--------|------------|
| DISCOVERED | Encontrado en Apollo, pendiente de investigación |
| RESEARCHING | La IA está investigando la empresa |
| RESEARCHED | Investigación completa, pendiente de scoring |
| SCORING | La IA está calculando el score |
| QUALIFIED | Score ≥ 60, apto para contactar |
| DISQUALIFIED | Score < 60 o excluido manualmente |
| PENDING_APPROVAL | En la cola de aprobación del CCO |
| APPROVED | Aprobado, listo para inscribir en secuencia |
| REJECTED | Rechazado por el CCO |
| IN_SEQUENCE | Actualmente en una secuencia de outreach |
| REPLIED | Respondió (pendiente de clasificación) |
| INTERESTED | Clasificado como interesado |
| NOT_INTERESTED | Clasificado como no interesado |
| MEETING_BOOKED | Se agendó una reunión |
| PUSHED_TO_CRM | Sincronizado con HubSpot |
