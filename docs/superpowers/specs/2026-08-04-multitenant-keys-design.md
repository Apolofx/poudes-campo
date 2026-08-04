# Etapa — Multitenant: API keys por tenant + Resend

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Fecha: 2026-08-04. Rama: `feat/multitenant-keys`. Repos: app (`poudes-campo`) + backend (`campo-poudes-backend`).
> Contrato: [`docs/api/openapi.yaml`](../../api/openapi.yaml) (secciones `ReminderFeed` y `Maintenance`).

## Contexto y alcance

Hoy **toda** instancia de la app comparte la misma `API_KEY` — embebida en el bundle público de
Vercel (`VITE_REMINDERS_API_KEY`) — y escribe sobre los **mismos items globales** de DynamoDB
(`FEED#SNAPSHOT`, `FEED#LAST_RUN`). Consecuencia: dos owners se pisan el feed entre sí y el digest
viaja siempre al mismo `TO_EMAIL` fijo.

**Objetivo**: multitenant real para que cada owner:
1. Tenga **datos aislados** (partición por tenant).
2. Solo **su credencial** acceda a sus datos.
3. Reciba su digest en **su propio mail**.

**Fuera de alcance**: sincronización full del CRUD (Etapa 5) y merge multi-dispositivo del mismo
tenant. Esta etapa solo particiona el feed de recordatorios y su auth.

## Decisiones tomadas (brainstorming)

1. **API keys por tenant, no auth completa.** Cada tenant tiene una key propia; quien posee la key
   es el dueño de los datos (requisito 2 se cumple por posesión de credencial). **Better Auth /
   Cognito se difiere** hasta que un tenant tenga >1 usuario real o exista login web. YAGNI explícito.
2. **Aprovisionamiento manual por script del admin** (`scripts/create-tenant.ts`). Genera
   `tenantId` + key, persiste solo `keyHash` y `email`. La key se muestra **una sola vez** y se
   entrega por canal privado. Sin endpoints públicos de registro (nadie puede auto-darse de alta).
3. **Destino del digest = email del perfil del tenant.** Lo fija el admin al crear el tenant. El
   cliente **no** manda su mail en el payload (fuente única de verdad, no falsable por el cliente).
4. **Resend como proveedor de email** (reemplaza SES). Sin verificación por destinatario, mejor
   deliverability, y el swap es trivial: `SESNotificationAdapter` se reemplaza por
   `ResendNotificationAdapter` detrás del mismo puerto `ReminderNotificationPort`.

## Arquitectura

### Backend

**Clave**: `tnt_<tenantId>_<secreto>`. El `tenantId` viaja **prefijado** en la credencial, así la
autorización es un `GetItem` directo (sin GSI, sin tabla extra de lookups).

Flujo de auth:

```
1. Llega  Authorization: Bearer tnt_<tenantId>_<secreto>
2. Parse tenantId (segundo segmento)
3. GetItem(pk=TENANT#<tenantId>, sk=PROFILE)
4. sha256(key) == keyHash  (comparación timing-safe)
5. OK → operaciones sobre la partición TENANT#<tenantId>; digest → profile.email
```

**Schema DynamoDB** (single-table; cambia solo el pk, se mantiene el mismo patrón):

```
TENANT#<id>   PROFILE           { email, keyHash, createdAt }
TENANT#<id>   FEED#SNAPSHOT     { visits }
TENANT#<id>   FEED#LAST_RUN     { lastRunAt }
```

- `DynamoDBReminderFeedRepository` recibe `tenantId` en el constructor y usa `pk=TENANT#<tenantId>`.
- Nuevo `DynamoDBTenantRepository` (port `TenantRepository.getProfile(tenantId)`).

**Notify**:

- **Cron EventBridge**: `scan` `begins_with(pk, 'TENANT#')` filtrando `sk=PROFILE` → **itera todos
  los tenants**; por cada uno: lee su snapshot + watermark, calcula vencidos
  (`computeDueVisits`), manda digest a su `email`, avanza su watermark (CAS por tenant).
- **`POST /v1/notify` manual**: autentica con la key del tenant → opera sobre ese tenant. `dryRun`
  se mantiene para testear.

**Resend**: `ResendNotificationAdapter implements ReminderNotificationPort` (HTTP POST a
`https://api.resend.com/emails`). Envs nuevas: `RESEND_API_KEY`, `FROM_EMAIL`. **Mueren** `TO_EMAIL`,
`API_KEY` (env) y todo el adapter/config de SES. La key de la API deja de ser env var global: vive
en DynamoDB, una por tenant.

### App

- **Config store**: puerto `TenantConfigRepository` (`get()/save({ apiUrl, apiKey })`) con adaptador
  IndexedDB. La key **deja de viajar en el bundle**.
- **Pantalla Configuración** (`/configuracion`): input de la key (y URL, con default
  `VITE_REMINDERS_API_URL`), botón "Guardar" → persiste → dispara sync.
- **Boot**:
  - Si hay config guardada → se usa.
  - Si no hay config pero existe `VITE_REMINDERS_API_KEY` (install legacy) → usa la de env
    (**compat**: el dispositivo actual sigue funcionando sin re-configurar).
  - Si no hay ninguna → redirige a `/configuracion`.
- **Sync**: `syncPendingVisitsFeed` lee la config en runtime y construye
  `HttpReminderFeedRepository` con la key vigente. Los triggers actuales (boot + registrar/editar/
  programar/cancelar) no cambian.

## Contrato

- `PUT /v1/pending-visits` y `POST /v1/notify`: **sin cambios de payload**. La auth implica el
  tenant; el servidor particiona por la key.
- `securitySchemes.bearerAuth`: documentar el formato `tnt_<tenantId>_<secreto>` y que el servidor
  deriva el tenant de la key.
- El alta de tenants **no es un endpoint**: es el script admin (anotado en el spec, no en el swagger).

## Setup (ops — al implementar)

1. Crear cuenta en Resend y **verificar el dominio** `navlogvfr.app` →
   `FROM_EMAIL = avisos@navlogvfr.app`.
2. `RESEND_API_KEY` + `FROM_EMAIL` en el `serverless.yml` env.
3. Correr `npm run create-tenant -- email=<owner>` por cada tenant.
4. En cada dispositivo: pegar la key en Configuración.

## Costos y límites (explícitos)

- **La key es un secreto cliente**: quien lee el IndexedDB de un dispositivo la obtiene. Aceptado
  (modelo estándar de API keys); hoy la key ya está expuesta en el bundle, así que **esto mejora**
  la situación.
- **Compartir la key = compartir el acceso**: no hay login/logout. Rotación manual (regenerar key →
  actualizar `PROFILE`).
- **Mismo tenant en 2 dispositivos**: misma partición, feed **last-write-wins** (un dispositivo
  puede pisar la proyección del otro). La sincronización real del CRUD es Etapa 5; el merge del feed
  es diferido.
- **Cambiar el mail del digest** = editar `PROFILE` (sin endpoint por ahora; decisión 3a=A).
- **Reputación del dominio en Resend**: la gerencian ellos (IPs calentadas); igual conviene usar el
  dominio con mejor historial de deliverability.

## Diferidos (YAGNI)

- **Auth completa (Better Auth / Cognito)**: cuando un tenant tenga >1 usuario real o haya login web.
- **Per-device keys**: una key por dispositivo dentro de un tenant (revocar un dispositivo sin tocar
  al resto).
- **Endpoint admin de provisioning**: cuando el owner quiera dar de alta tenants sin AWS/CLI.
- **Auto-config del email desde la app**: hoy lo setea el admin (decisión 3a=A).
- **Rotación de key por UI / expiración**: manual hoy.
- **Merge del feed multi-dispositivo**: junto con la sincronización real (Etapa 5).

## ROADMAP

Al cerrar la etapa:
- Agregar fila **multitenant-keys** ✅ en "Etapas".
- Resolver la deuda de ROADMAP **"API key embebida en el bundle"** (la key sale del bundle y pasa a
  ser por tenant).
- Actualizar la fila de recordatorios: **SES → Resend**, **auth por tenant** (una key por owner),
  digest al **mail del tenant** (ya no `TO_EMAIL` global).
- Nota: el digest diario ahora itera tenants; cada tenant con su watermark.
