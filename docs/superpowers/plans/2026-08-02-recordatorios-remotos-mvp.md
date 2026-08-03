# Etapa — Recordatorios remotos MVP — Implementation Plan

> Fuente: `docs/superpowers/specs/2026-08-02-recordatorios-remotos-design.md`.
> Convenciones: `AGENTS.md`. TDD estricto: test rojo → verde → commit por tarea.
> Rama: `reminder-remote`. Al cerrar: merge --no-ff a `main`.
>
> **Alcance MVP explícito**: notificar por email **sin abrir la app** (el banner in-app sigue).
> Dos frentes: (1) servicio serverless `campo-poudes-backend` (proyecto hermano en
> `/Users/nacho/Documents/projects/campo-poudes-backend`, moldeado en `hexagonal-serverless-ts`),
> (2) push del feed desde la app (repo de Campo). Doc-only en esta rama: el plan se ejecuta en
> etapas futuras (backend y cliente), cada una con su rama.

## Decisiones del MVP (además del spec)

1. **Proyecto hermano `campo-poudes-backend`** en `/Users/nacho/Documents/projects/` (mismo padre
   que la app), clonado del molde `~/Sites/hexagonal-serverless-ts` (serverless v4, esbuild,
   DynamoDB single-table pk/sk PAY_PER_REQUEST, zod, SES integrado, LocalStack).
2. **Idempotencia con watermark `lastRunAt`** (en vez del log `(visitId, remindAt)` del spec):
   la lambda notifica lo que venció **desde la última corrida** y avanza el watermark con write
   condicional (CAS) → **at-most-once**, auto-recupera días perdidos, y el cliente reemplaza el
   snapshot sin tocar el watermark (2 items en la misma tabla).
3. **Auth de endpoints**: check del header `Authorization: Bearer <API_KEY>` **dentro del handler**
   (sin lambda authorizer — menos infra). La invocación por schedule de EventBridge va directo a la
   misma función sin pasar por API Gateway.
4. **Dos items DynamoDB**: `FEED#SNAPSHOT` (array `PendingVisit`) y `FEED#LAST_RUN` (`lastRunAt`).
   Sin tabla de log, sin GSI.
5. **Cliente**: puerto nuevo `ReminderFeedRepository` + caso de uso `SyncPendingVisitsFeed` +
   adapter HTTP + triggers (boot de la app + tras cada mutación de visitas, fire-and-forget,
   best-effort offline).
6. **`POST /v1/notify` con `dryRun`** para probar el pipeline sin enviar (misma función que el cron).

## Arquitectura

```
App (PWA)                          campo-poudes-backend (AWS)
────────                          ─────────────────────────
boot + mutación de visitas         DynamoDB AppTable (pk/sk, PAY_PER_REQUEST)
  → PUT /v1/pending-visits          · FEED#SNAPSHOT  → PendingVisit[]
      (Authorization: Bearer)       · FEED#LAST_RUN  → lastRunAt (watermark)
                                    · replaceSnapshot: PutItem (cliente no toca watermark)

                                    API Gateway (Bearer in-handler)
                                      PUT /v1/pending-visits  → replaceSnapshot
                                      POST /v1/notify         → NotifyDueReminders (dryRun?)
                                    EventBridge cron(0 10 * * ? *) → misma función notify

                                    Lambda notifyScheduled:
                                      1. getSnapshot + getLastRunAt
                                      2. due = remindAt ≤ now ∧ remindAt > lastRunAt
                                                   ∧ plannedFor > now
                                      3. si due vacío → ok sin estado
                                      4. claimRun(lastRunAt=now, CAS vs leído) → si pierde, aborta
                                      5. SES: 1 email digest con los due
```

## Tareas — Parte 1: backend `campo-poudes-backend`

### Tarea B1 — Scaffold del proyecto (molde, sin código de negocio)

- [ ] `cp -R ~/Sites/hexagonal-serverless-ts /Users/nacho/Documents/projects/campo-poudes-backend`; eliminar `.git`, `node_modules`, `.serverless`, `.swp`.
- [ ] Renombrar `service` en `serverless.yml` → `campo-poudes-backend`; borrar handlers/use-cases/repos del User CRUD (carpetas `src/handlers/{createUser,getUser,updateUser,deleteUser,listUsers,deactivateUser,userDeactivatedHandler}`, `src/application`, `src/domain`, `src/infrastructure/repositories/DynamoDBUserRepository*`, `src/infrastructure/adapters/*`, `src/schemas/user.schema.ts`, `src/openapi/*`).
- [ ] `npm install`; `npm test` (jest) verde sin tests → commit `chore: scaffold campo-poudes-backend desde el molde hexagonal-serverless-ts`.

### Tarea B2 — Dominio puro: PendingVisit + cómputo de due

- [ ] Rojo: `src/domain/__tests__/reminder-feed.test.ts` — `remindAtOf` (plannedFor − lead días), `computeDueVisits` (filtro `remindAt ≤ now ∧ remindAt > lastRunAt ∧ plannedFor > now`; `lastRunAt = null` → todo lo vencido hasta ahora; orden por `remindAt`).
- [ ] Verde: `src/domain/reminder-feed.ts` (interfaz `PendingVisit`, `remindAtOf`, `computeDueVisits`, `DueResult`) → commit `feat(domain): cómputo puro de recordatorios vencidos (watermark)`.

### Tarea B3 — Puerto + use case `NotifyDueReminders` (CAS)

- [ ] Rojo: `src/application/use-cases/__tests__/NotifyDueReminders.test.ts` con doubles: repo fake (`getSnapshot`/`getLastRunAt`/`claimRun`), notifier fake, `Clock` fake.
  - due vacío → no claim, `sent: 0`.
  - hay due → `claimRun(nowISO, lastRunLeído)` llamado **antes** de enviar; `sendDigest(items)` con los due.
  - `claimRun` devuelve `false` (corrida concurrente ganó) → **no** envía, `sent: 0`.
  - `dryRun: true` → calcula `items` pero **no** claim ni envío.
- [ ] Verde: `src/domain/ports/ReminderFeedRepository.ts` (`replaceSnapshot`, `getSnapshot`, `getLastRunAt`, `claimRun`), `src/domain/ports/ReminderNotificationPort.ts` (`sendDigest`), `src/application/use-cases/NotifyDueReminders.ts` → commit `feat(application): NotifyDueReminders con claim de watermark (CAS)`.

### Tarea B4 — Use case `ReplacePendingVisits` + schema zod

- [ ] Rojo: `ReplacePendingVisits.test.ts` (guarda el array tal cual; `ReplacePendingVisitsRequestSchema` valida: `visitId`/`fieldId`/`fieldName` requeridos, `plannedFor` datetime, `reminderLeadDays ≥ 0`; rechaza malformados).
- [ ] Verde: `src/application/use-cases/ReplacePendingVisits.ts`, `src/schemas/pending-visit.schema.ts` (zod + openapi) → commit `feat(application): reemplazo de snapshot de programadas + schema zod`.

### Tarea B5 — Adaptadores DynamoDB + SES

- [ ] Rojo: `DynamoDBReminderFeedRepository.test.ts` con `@aws-sdk/lib-dynamodb` mockeado (o LocalStack):
  - `replaceSnapshot` → PutItem `{ pk: 'FEED', sk: 'SNAPSHOT', visits }`.
  - `getSnapshot` → GetItem; sin item → `[]`.
  - `getLastRunAt` → sin item → `null`.
  - `claimRun(expected)` → PutItem con `ConditionExpression: attribute_not_exists(pk) OR lastRunAt = :expected`; si el item existe y cambió → `false`, si no → `true`.
- [ ] Rojo: `SESNotificationAdapter.test.ts` — `sendDigest(to, items)` arma asunto `Campo — recordatorio: N visitas` y cuerpo por línea `Lote {fieldName} · {clientName} · {zoneName} — {dd/mm/yyyy}` (+ nota), y llama `SendEmailCommand` con `Source`/`ToAddresses`/texto.
- [ ] Verde: `src/infrastructure/repositories/DynamoDBReminderFeedRepository.ts`, `src/infrastructure/adapters/SESNotificationAdapter.ts`, `src/infrastructure/config/dynamodb.ts` (`APP_TABLE` + `keys.feed()`), `src/infrastructure/config/ses.ts` (`sesClient`, `FROM_EMAIL`, `TO_EMAIL`) → commit `feat(infra): repos DynamoDB con watermark CAS y adapter SES de digest`.

### Tarea B6 — Handlers + serverless.yml

- [ ] Rojo→verde: `src/handlers/__tests__/replacePendingVisits.test.ts` (Bearer correcto → 204; sin/mal Bearer → 401; zod → 422; JSON malformado → 400) y `notify.test.ts` (API con `dryRun` → `{ sent, items }`; invocación por schedule sin `httpMethod` → corre igual; Bearer malo en API → 401).
- [ ] Verde: `src/handlers/shared/authorize.ts` (compara `Authorization` con `API_KEY` de env), `src/handlers/replacePendingVisits.ts`, `src/handlers/notify.ts` (doble cara: API Gateway + schedule), `src/handlers/shared/errorHandler.ts` (ZodError→422, JSON.parse→400, resto→500), `src/handlers/shared/response.ts` (añadir `unauthorized` y `validationError`).
- [ ] `serverless.yml`: tabla sin GSI, IAM solo `dynamodb:GetItem/PutItem` + `ses:SendEmail`; funciones `replacePendingVisits` (http PUT `v1/pending-visits`, cors), `notify` (http POST `v1/notify`, cors), `notifyScheduled` (schedule `cron(0 10 * * ? *)` → mismo handler). Env `API_KEY`, `FROM_EMAIL`, `TO_EMAIL`.
- [ ] `npm test` verde + `npm run typecheck` → commit `feat(handlers): endpoints PUT /v1/pending-visits y POST /v1/notify + cron diario`.

### Tarea B7 — Deploy y verificación manual

- [ ] Verificar identidad de `FROM_EMAIL` en SES (dominio o dirección) y setear `TO_EMAIL` = correo del usuario; `API_KEY` generada.
- [ ] `npm run deploy:dev` (o `deploy:local` con LocalStack).
- [ ] Smoke: `curl -X PUT <url>/v1/pending-visits -H "Authorization: Bearer $API_KEY" -d '[{...}]'` → 204; `curl -X POST <url>/v1/notify -H "Authorization: Bearer $API_KEY" -d '{"dryRun":true}'` → items; luego `dryRun:false` → llega el email.
- [ ] Commit de los env docs en README del proyecto (si aplica) → merge de la rama del backend.

## Tareas — Parte 2: cliente (app Campo)

> Tocar `src/domain` y `src/application` es la **intención explícita** de esta etapa (puerto y caso
> de uso nuevos; no se modifican entidades ni casos existentes).

### Tarea C1 — Puerto + caso de uso `SyncPendingVisitsFeed`

- [ ] Rojo: `tests/application/sync-pending-visits-feed.test.ts` — con visitas `findPendings()` y `fields.listAllForCatalog()` in-memory + feed fake: arma items denormalizados (`fieldName`/`clientName`/`zoneName` desde el catálogo, `plannedFor` ISO, `reminderLeadDays`); sin pendientes → `feed.replace([])`; lote archivado/fuera del catálogo → `fieldName` fallback.
- [ ] Verde: `src/domain/ports/outbound/reminder-feed-repository.ts` (`PendingVisitFeedItem`, `ReminderFeedRepository.replace`), `src/application/use-cases/sync-pending-visits-feed.ts` → commit `feat(domain+application): puerto y caso de uso del feed de programadas`.

### Tarea C2 — Adapter HTTP + configuración

- [ ] Rojo: `tests/infrastructure/http/reminder-feed-repository.test.ts` (mock de `fetch`): PUT a `${baseUrl}/v1/pending-visits` con `Authorization: Bearer <key>`, body JSON, `204` no lanza.
- [ ] Verde: `src/infrastructure/persistence/http/reminder-feed-repository.ts` + `src/infrastructure/persistence/http/index.ts` → commit `feat(infra): adapter HTTP del feed (fetch, bearer)`.

### Tarea C3 — Wiring + triggers

- [ ] `src/composition/container.ts`: si `import.meta.env.VITE_REMINDERS_API_URL` y `VITE_REMINDERS_API_KEY` están seteadas → `HttpReminderFeedRepository` + `SyncPendingVisitsFeed` expuesto como `syncPendingVisitsFeed` (fire-and-forget con catch que silencia); si no → no-op. `tests/support/in-memory-container.ts` espeja (no-op o fake).
- [ ] `src/main.tsx`: tras build del container → `void container.syncPendingVisitsFeed()` (boot de la app).
- [ ] Hooks de mutación (`use-record-visit-ensuring-field`, `use-schedule-visit-ensuring-field`, `use-edit-visit`, `use-cancel-visit`): tras éxito → `void useCampo().syncPendingVisitsFeed()` (una línea cada uno).
- [ ] Suite completa verde + typecheck + `npm run build` → commit `feat(ui): push del feed de programadas (boot + tras mutaciones)`.

### Tarea C3b — Precisión del watermark (aditivo, opcional MVP)

- [ ] Nota de diseño: como `claimRun` avanza el watermark **antes** de enviar, un fallo de SES pierde el batch (at-most-once). Aceptado para MVP; el banner in-app y la agenda cubren el caso. Se documenta en ROADMAP como diferido (no se implementa en esta etapa).

### Tarea C4 — Cierre

- [ ] Actualizar `docs/ROADMAP.md`: fila de etapa `recordatorios-remotos-mvp` con el conteo de tests (backend y app); mover "recibir recordatorios por email fuera de la app" a "Se puede hacer hoy" si el backend quedó deployado; diferidos nuevos (key embebida, SES at-most-once, cron UTC).
- [ ] Suite completa verde + typecheck + `npm run build`.
- [ ] Merge --no-ff a `main`, borrar rama.

---

## Código de referencia

### B2 — `src/domain/reminder-feed.ts`

```ts
export interface PendingVisit {
  visitId: string;
  fieldId: string;
  fieldName: string;
  clientName?: string;
  zoneName?: string;
  plannedFor: string; // ISO-8601 UTC
  reminderLeadDays: number;
  notes?: string;
}

export interface DueResult {
  visit: PendingVisit;
  remindAt: string;
}

const DAY_MS = 86_400_000;

export function remindAtOf(v: PendingVisit): string {
  return new Date(Date.parse(v.plannedFor) - v.reminderLeadDays * DAY_MS).toISOString();
}

export function computeDueVisits(visits: PendingVisit[], lastRunAt: string | null, now: Date): DueResult[] {
  const nowMs = now.getTime();
  const sinceMs = lastRunAt ? Date.parse(lastRunAt) : 0;
  return visits
    .map((visit) => ({ visit, remindAt: remindAtOf(visit) }))
    .filter(({ visit, remindAt }) => {
      const r = Date.parse(remindAt);
      return r <= nowMs && r > sinceMs && Date.parse(visit.plannedFor) > nowMs;
    })
    .sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt));
}
```

### B3 — puertos y use case

```ts
// src/domain/ports/ReminderFeedRepository.ts
import type { PendingVisit } from '../reminder-feed';

export interface ReminderFeedRepository {
  replaceSnapshot(visits: PendingVisit[]): Promise<void>;
  getSnapshot(): Promise<PendingVisit[]>;
  getLastRunAt(): Promise<string | null>;
  /** CAS: avanza el watermark solo si nadie lo cambió desde `expected` (null = no existe aún). */
  claimRun(lastRunAt: string, expected: string | null): Promise<boolean>;
}

// src/domain/ports/ReminderNotificationPort.ts
import type { DueResult } from '../reminder-feed';

export interface ReminderNotificationPort {
  sendDigest(to: string, items: DueResult[]): Promise<void>;
}
```

```ts
// src/application/use-cases/NotifyDueReminders.ts
import type { ReminderFeedRepository } from '../../domain/ports/ReminderFeedRepository';
import type { ReminderNotificationPort } from '../../domain/ports/ReminderNotificationPort';
import { computeDueVisits, type DueResult } from '../../domain/reminder-feed';

export interface NotifyDueRemindersResult {
  sent: number;
  items: DueResult[];
}

export class NotifyDueReminders {
  constructor(
    private readonly repo: ReminderFeedRepository,
    private readonly notifier: ReminderNotificationPort,
    private readonly to: string,
  ) {}

  async execute(now: Date, dryRun = false): Promise<NotifyDueRemindersResult> {
    const visits = await this.repo.getSnapshot();
    const lastRunAt = await this.repo.getLastRunAt();
    const items = computeDueVisits(visits, lastRunAt, now);

    if (dryRun || items.length === 0) return { sent: 0, items };

    const claimed = await this.repo.claimRun(now.toISOString(), lastRunAt);
    if (!claimed) return { sent: 0, items: [] };

    await this.notifier.sendDigest(this.to, items);
    return { sent: 1, items };
  }
}
```

### B5 — repos DynamoDB + SES

```ts
// src/infrastructure/repositories/DynamoDBReminderFeedRepository.ts
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ReminderFeedRepository } from '../../domain/ports/ReminderFeedRepository';
import { PendingVisit } from '../../domain/reminder-feed';

const SNAPSHOT_KEY = { pk: 'FEED', sk: 'SNAPSHOT' };
const LAST_RUN_KEY = { pk: 'FEED', sk: 'LAST_RUN' };

export class DynamoDBReminderFeedRepository implements ReminderFeedRepository {
  constructor(private readonly client: DynamoDBDocumentClient, private readonly tableName: string) {}

  async replaceSnapshot(visits: PendingVisit[]): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...SNAPSHOT_KEY, visits } }));
  }

  async getSnapshot(): Promise<PendingVisit[]> {
    const r = await this.client.send(new GetCommand({ TableName: this.tableName, Key: SNAPSHOT_KEY }));
    return (r.Item?.visits as PendingVisit[] | undefined) ?? [];
  }

  async getLastRunAt(): Promise<string | null> {
    const r = await this.client.send(new GetCommand({ TableName: this.tableName, Key: LAST_RUN_KEY }));
    return (r.Item?.lastRunAt as string | undefined) ?? null;
  }

  async claimRun(lastRunAt: string, expected: string | null): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...LAST_RUN_KEY, lastRunAt },
          ConditionExpression: 'attribute_not_exists(pk) OR lastRunAt = :expected',
          ExpressionAttributeValues: { ':expected': expected ?? '' },
        }),
      );
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }
}
```

```ts
// src/infrastructure/adapters/SESNotificationAdapter.ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { ReminderNotificationPort } from '../../domain/ports/ReminderNotificationPort';
import { DueResult } from '../../domain/reminder-feed';

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

export class SESNotificationAdapter implements ReminderNotificationPort {
  constructor(private readonly client: SESClient, private readonly from: string) {}

  async sendDigest(to: string, items: DueResult[]): Promise<void> {
    const lines = items.map(({ visit, remindAt }) => {
      const who = [visit.clientName, visit.zoneName].filter(Boolean).join(' · ');
      const note = visit.notes ? ` (${visit.notes})` : '';
      return `Lote ${visit.fieldName}${who ? ` · ${who}` : ''} — ${formatDate(visit.plannedFor)}${note}`;
    });
    const subject = `Campo — recordatorio: ${items.length} ${items.length === 1 ? 'visita' : 'visitas'}`;
    await this.client.send(
      new SendEmailCommand({
        Source: this.from,
        Destination: { ToAddresses: [to] },
        Message: { Subject: { Data: subject }, Body: { Text: { Data: lines.join('\n') } } },
      }),
    );
  }
}
```

### B6 — handlers

```ts
// src/handlers/shared/authorize.ts
export function isAuthorized(event: { headers?: Record<string, string | undefined> | null }): boolean {
  const key = process.env.API_KEY ?? '';
  return event.headers?.Authorization === `Bearer ${key}`;
}
```

```ts
// src/handlers/replacePendingVisits.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ReplacePendingVisits } from '../application/use-cases/ReplacePendingVisits';
import { DynamoDBReminderFeedRepository } from '../infrastructure/repositories/DynamoDBReminderFeedRepository';
import { APP_TABLE, dynamoDBClient } from '../infrastructure/config/dynamodb';
import { ReplacePendingVisitsRequestSchema } from '../schemas/pending-visit.schema';
import { isAuthorized } from './shared/authorize';
import { handleError } from './shared/errorHandler';
import * as response from './shared/response';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!isAuthorized(event)) return response.unauthorized();
  try {
    const visits = ReplacePendingVisitsRequestSchema.parse(JSON.parse(event.body ?? '[]'));
    const repo = new DynamoDBReminderFeedRepository(dynamoDBClient, APP_TABLE);
    await new ReplacePendingVisits(repo).execute(visits);
    return response.noContent();
  } catch (error) {
    return handleError(error);
  }
}
```

```ts
// src/handlers/notify.ts (doble cara: API Gateway + EventBridge schedule)
import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { NotifyDueReminders } from '../application/use-cases/NotifyDueReminders';
import { DynamoDBReminderFeedRepository } from '../infrastructure/repositories/DynamoDBReminderFeedRepository';
import { SESNotificationAdapter } from '../infrastructure/adapters/SESNotificationAdapter';
import { APP_TABLE, dynamoDBClient } from '../infrastructure/config/dynamodb';
import { FROM_EMAIL, sesClient, TO_EMAIL } from '../infrastructure/config/ses';
import { isAuthorized } from './shared/authorize';
import { handleError } from './shared/errorHandler';
import * as response from './shared/response';

type NotifyEvent = Partial<APIGatewayProxyEvent> & Partial<ScheduledEvent>;

export async function handler(event: NotifyEvent): Promise<APIGatewayProxyResult | void> {
  const isHttp = typeof event.httpMethod === 'string';
  if (isHttp && !isAuthorized(event as APIGatewayProxyEvent)) return response.unauthorized();

  try {
    const dryRun = isHttp ? (JSON.parse((event as APIGatewayProxyEvent).body ?? '{}') as { dryRun?: boolean }).dryRun === true : false;
    const repo = new DynamoDBReminderFeedRepository(dynamoDBClient, APP_TABLE);
    const notifier = new SESNotificationAdapter(sesClient, FROM_EMAIL);
    const result = await new NotifyDueReminders(repo, notifier, TO_EMAIL).execute(new Date(), dryRun);
    return isHttp ? response.ok(result) : undefined;
  } catch (error) {
    if (isHttp) return handleError(error);
    console.error('notifyScheduled failed:', error);
  }
}
```

### C1 — puerto y use case (app)

```ts
// src/domain/ports/outbound/reminder-feed-repository.ts
export interface PendingVisitFeedItem {
  visitId: string;
  fieldId: string;
  fieldName: string;
  clientName?: string;
  zoneName?: string;
  plannedFor: string;
  reminderLeadDays: number;
  notes?: string;
}

export interface ReminderFeedRepository {
  replace(items: PendingVisitFeedItem[]): Promise<void>;
}
```

```ts
// src/application/use-cases/sync-pending-visits-feed.ts
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { ReminderFeedRepository, PendingVisitFeedItem } from '@/domain/ports/outbound/reminder-feed-repository';

export class SyncPendingVisitsFeed {
  constructor(
    private readonly visits: VisitRepository,
    private readonly fields: FieldRepository,
    private readonly feed: ReminderFeedRepository,
  ) {}

  async execute(): Promise<void> {
    const [pendings, catalog] = await Promise.all([this.visits.findPendings(), this.fields.listAllForCatalog()]);
    const byId = new Map(catalog.map((row) => [row.field.id, row]));

    const items: PendingVisitFeedItem[] = pendings.map((v) => {
      const row = byId.get(v.fieldId);
      return {
        visitId: v.id,
        fieldId: v.fieldId,
        fieldName: row?.field.name ?? 'Lote',
        clientName: row?.clientName,
        zoneName: row?.zoneName,
        plannedFor: v.plannedFor?.toISOString() ?? '',
        reminderLeadDays: v.reminderLeadDays ?? 0,
        notes: v.notes,
      };
    });
    await this.feed.replace(items);
  }
}
```

### C2 — adapter HTTP (app)

```ts
// src/infrastructure/persistence/http/reminder-feed-repository.ts
import type { PendingVisitFeedItem, ReminderFeedRepository } from '@/domain/ports/outbound/reminder-feed-repository';

export class HttpReminderFeedRepository implements ReminderFeedRepository {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async replace(items: PendingVisitFeedItem[]): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/pending-visits`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(items),
    });
    if (!res.ok) throw new Error(`reminder feed: HTTP ${res.status}`);
  }
}
```

### C3 — wiring y triggers (app)

```ts
// src/composition/container.ts (extracto)
const remindersApiUrl = import.meta.env.VITE_REMINDERS_API_URL as string | undefined;
const remindersApiKey = import.meta.env.VITE_REMINDERS_API_KEY as string | undefined;

if (remindersApiUrl && remindersApiKey) {
  const feed = new HttpReminderFeedRepository(remindersApiUrl, remindersApiKey);
  const sync = new SyncPendingVisitsFeed(visits, fields, feed);
  container.syncPendingVisitsFeed = () => sync.execute().catch(() => undefined);
} else {
  container.syncPendingVisitsFeed = async () => undefined;
}
```

```ts
// src/main.tsx (extracto)
const container = await buildContainer();
void container.syncPendingVisitsFeed();
```

```ts
// src/ui/hooks/use-schedule-visit-ensuring-field.ts (patrón para los 4 hooks de mutación)
const { syncPendingVisitsFeed } = useCampo();
// tras el éxito de la mutación:
void syncPendingVisitsFeed();
```

## Notas de deploy y entorno

- **SES**: `FROM_EMAIL` debe estar verificado (dominio o dirección) en la región; `TO_EMAIL` = correo del usuario. Sandbox de SES solo envía a direcciones verificadas.
- **API_KEY**: generar una clave (ej. `openssl rand -hex 24`), pasar por env al deploy (`sls deploy --stage dev` con el env). En la PWA la key **queda embebida en el bundle** (MVP de un solo usuario; rotar la key revoca).
- **Cron UTC**: `cron(0 10 * * ? *)` = 07:00 ART. La marca de agua hace la hora poco crítica (at-most-once + catch-up).
- **Costos**: DynamoDB PAY_PER_REQUEST (~$0), SES (≈$0 a este volumen), API Gateway + 1 invocación/día.
- **LocalStack**: `npm run deploy:local` para iterar sin AWS.

## Diferidos (explícitos)

- SES at-most-once (perder batch si falla tras el claim) — el banner/agenda cubren.
- Key embebida en el bundle (→ API key scheme con rotación o authorizer real cuando haya más usuarios).
- WhatsApp como canal alternativo (mismo `ReminderNotificationPort`).
- Log `(visitId, remindAt)` del spec (editar re-dispara) si el watermark se queda corto.
- `zod-to-openapi`/openapi generado en el backend (el contrato ya vive en `docs/api/openapi.yaml`).
