# Etapa — Multitenant: API keys por tenant + Resend — Implementation Plan

> Fuente: `docs/superpowers/specs/2026-08-04-multitenant-keys-design.md`.
> Convenciones: `AGENTS.md`. TDD estricto: test rojo → verde → commit por tarea.
> Rama: `feat/multitenant-keys`. Al cerrar: merge --no-ff a `main`.
>
> **Alcance**: dos frentes. (1) **backend** `campo-poudes-backend`
> (`/Users/nacho/Documents/projects/campo-poudes-backend`): particionado por tenant, auth por key
> `tnt_<tenantId>_<secreto>`, notificador Resend, script de alta. (2) **app** (repo de Campo):
> config de tenant en runtime (pantalla Configuración), la key sale del bundle.

## Decisiones del plan (además del spec)

1. **Clave `tnt_<tenantId>_<secreto>`**: el `tenantId` (UUIDv4) viaja prefijado → la auth es un
   `GetItem(pk=TENANT#<id>, sk=PROFILE)` directo, sin GSI. Se persiste solo `sha256(key)` (comparación
   `timingSafeEqual`). Quien posee la key es el dueño del tenant.
2. **Schema DynamoDB** (mismo single-table, cambia el pk):
   `TENANT#<id>#PROFILE` (`{ tenantId, email, keyHash, createdAt }`),
   `TENANT#<id>#FEED#SNAPSHOT`, `TENANT#<id>#FEED#LAST_RUN`. El repo de feed recibe `tenantId`.
3. **Cron itera tenants**: `scan` `begins_with(pk,'TENANT#') AND sk='PROFILE'` → por cada tenant
   corre `NotifyDueReminders` con su feed + su email. El `POST /v1/notify` manual autentica y corre
   solo para ese tenant. IAM suma `dynamodb:Scan`.
4. **Resend**: `ResendNotificationAdapter` implementa `ReminderNotificationPort` (HTTP a
   `https://api.resend.com/emails`). Mueren `ses.ts`, `SESNotificationAdapter`, envs `TO_EMAIL` y
   `API_KEY`; nacen env `RESEND_API_KEY`. `FROM_EMAIL` sigue (`avisos@navlogvfr.app`).
5. **App — config en runtime**: puerto `TenantConfigRepository` (adapter `localStorage`), expuesto en
   el container como `getTenantConfig/saveTenantConfig/clearTenantConfig`. **Compat legacy**: si no
   hay config guardada y existen `VITE_REMINDERS_API_URL/KEY` → se usan las de env (el dispositivo
   actual no se rompe). `syncPendingVisitsFeed` lee la config efectiva en cada corrida.
6. **Gate de config en UI**: `TenantConfigProvider` (Context) + `ConfigGate` en `App` → sin config,
   redirige a `/configuracion`. La pantalla guarda y navega a `/`. (La URL `/configuracion` queda
   accesible para re-configurar; un entry visible en la UI es diferido.)
7. **Setup (al implementar)**: verificar `navlogvfr.app` en Resend → `FROM_EMAIL=avisos@navlogvfr.app`;
   `npm run create-tenant -- --email=<owner>` por tenant.

## Arquitectura

```
App (PWA)                          campo-poudes-backend (AWS)
─────────                          ─────────────────────────
Configuración (1er uso)            DynamoDB AppTable (pk/sk)
  pega key tnt_<id>_<secreto>       · TENANT#<id>#PROFILE       { email, keyHash, createdAt }
  → localStorage                   · TENANT#<id>#FEED#SNAPSHOT  PendingVisit[]
boot + mutación de visitas         · TENANT#<id>#FEED#LAST_RUN  watermark
  → PUT /v1/pending-visits         (una partición por tenant)
      Authorization: Bearer tnt_…          ▲
                                   autentica: parse tnt_ → GetItem PROFILE → sha256 == keyHash
                                   API Gateway
                                     PUT /v1/pending-visits → replaceSnapshot(tenant)
                                     POST /v1/notify (dryRun?) → NotifyDueReminders(tenant)
                                   EventBridge cron(0 10 * * ? *)
                                     scan TENANT# → por tenant: computeDue + digest Resend(profile.email)
```

## Tareas — Parte 1: backend `campo-poudes-backend`

### Tarea B1 — Dominio: formato de la key por tenant

- [ ] Rojo: `src/domain/__tests__/tenant.test.ts` — `parseApiKey('tnt_abc_xyz')` → `{ tenantId:'abc', secret:'xyz' }`; devuelve `null` para `''`, `'abc'`, `'tnt_abc'`, `'xnt_abc_xyz'`, `'tnt__xyz'`, `'tnt_abc_'`.
- [ ] Verde: `src/domain/tenant.ts` (`API_KEY_PREFIX='tnt'`, `ParsedApiKey`, `TenantProfile`, `parseApiKey`) → commit `feat(domain): formato de api key por tenant (tnt_<id>_<secreto>)`.

### Tarea B2 — Auth: puerto TenantRepository + hash + authenticate

- [ ] Rojo: `src/handlers/__tests__/authorize.test.ts` con repo fake:
  - `hashApiKey` devuelve el sha256 hex.
  - `authenticate` sin header / con `Bearer` mal formado → `null`.
  - con key `tnt_t1_secreto` y PROFILE con `keyHash=hashApiKey(key)` → devuelve el profile.
  - PROFILE con otro `keyHash` (key distinta) → `null`.
  - `getProfile` sin item → `null`.
- [ ] Verde: `src/domain/ports/TenantRepository.ts` (`getProfile`, `listProfiles`), `src/handlers/shared/authorize.ts` (reemplaza al actual: `hashApiKey`, `keysMatch` con `timingSafeEqual`, `authenticate(headers, repo)`) → commit `feat(auth): authenticate por key de tenant (sha256 timing-safe)`.

### Tarea B3 — Repos DynamoDB tenant-scoped + listado de tenants

- [ ] Rojo: `src/infrastructure/repositories/__tests__/DynamoDBTenantRepository.test.ts` (mock de `send`):
  - `getProfile` → GetItem con `Key: { pk:'TENANT#t1', sk:'PROFILE' }`; sin item → `null`.
  - `listProfiles` → Scan con `FilterExpression: begins_with(pk,:p) AND sk=:s`; devuelve items.
  - `create` → PutItem con perfil completo.
- [ ] Rojo→verde (actualizar): `DynamoDBReminderFeedRepository.test.ts` — el constructor ahora recibe `tenantId`; todas las claves pasan a `pk:'TENANT#<id>'` con `sk:'FEED#SNAPSHOT'`/`'FEED#LAST_RUN'`.
- [ ] Verde: `src/infrastructure/repositories/DynamoDBTenantRepository.ts` (+ `create` para el script), `src/infrastructure/repositories/DynamoDBReminderFeedRepository.ts` (tenant-scoped), `src/infrastructure/config/dynamodb.ts` (sacar el export `keys` ya no usado) → commit `feat(infra): repos DynamoDB por partición de tenant`.

### Tarea B4 — Adapter Resend (reemplaza SES)

- [ ] Rojo: `src/infrastructure/adapters/__tests__/ResendNotificationAdapter.test.ts` (mock de `global.fetch`):
  - `sendDigest(to, items)` hace POST a `https://api.resend.com/emails` con `Authorization: Bearer <key>`, body `{ from, to:[to], subject:'Campo — recordatorio: N visitas', text: '<líneas>' }`, misma línea `Lote X · Cliente · Zona — dd/mm/yyyy` (+ nota).
  - respuesta `!ok` → lanza.
- [ ] Verde: `src/infrastructure/adapters/ResendNotificationAdapter.ts`, `src/infrastructure/config/resend.ts` (`RESEND_API_KEY`, `FROM_EMAIL`), borrar `src/infrastructure/config/ses.ts` y `src/infrastructure/adapters/SESNotificationAdapter.ts` (y su test) → commit `feat(infra): adapter Resend de digest (reemplaza SES)`.

### Tarea B5 — Handlers: auth por tenant + cron por tenant

- [ ] Rojo→verde: `src/handlers/__tests__/replacePendingVisits.test.ts`:
  - mocks de config `dynamodb` y `resend`; `send` devuelve PROFILE para `getProfile` (con `keyHash` calculado con `hashApiKey` sobre la key real del test) y `{}` para el PutItem.
  - Bearer válido → 204; sin/mal Bearer → 401; key válida pero de otro tenant (PROFILE de `t1`, key de `t2`) → 401; zod → 422; JSON malformado → 400.
- [ ] Rojo→verde: `src/handlers/__tests__/notify.test.ts`:
  - mock de `ResendNotificationAdapter` (con `mockSendDigest`), config `dynamodb` y `resend`.
  - HTTP con dryRun → `{ sent, items }` sin enviar; Bearer malo → 401; envía el digest al `profile.email`.
  - Schedule: `send` secuencia → `listProfiles` devuelve 2 tenants → por cada uno snapshot+lastRun+claim y `sendDigest(email, due)` llamado por tenant; sin vencidos no envía.
- [ ] Verde: `src/handlers/replacePendingVisits.ts` y `src/handlers/notify.ts` (doble cara: API autenticada → un tenant; schedule → iterar `listProfiles`) → commit `feat(handlers): endpoints y cron particionados por tenant`.

### Tarea B6 — Script de alta de tenants

- [ ] Verde: `scripts/create-tenant.ts` (lee `--email=`, genera `randomUUID()` + `randomBytes(24).hex`, `PutCommand` del PROFILE con `hashApiKey`, imprime la key una sola vez) + script npm `"create-tenant": "ts-node scripts/create-tenant.ts"` en `package.json`.
- [ ] Smoke local: `APP_TABLE=<tabla> npm run create-tenant -- --email=test@example.com` y verificar el item en la tabla → commit `feat(scripts): create-tenant (aprovisiona key + email del digest)`.

### Tarea B7 — serverless.yml + limpieza de deps

- [ ] `serverless.yml`: env → sacar `TO_EMAIL` y `API_KEY`, sumar `RESEND_API_KEY: ${env:RESEND_API_KEY, ''}` (queda `APP_TABLE`, `FROM_EMAIL`). IAM → `dynamodb:GetItem/PutItem/Scan`; sacar `ses:SendEmail`.
- [ ] `package.json`: `npm uninstall @aws-sdk/client-ses` (ya no se usa).
- [ ] `npm test` verde + `npm run typecheck` + `npm run lint` → commit `chore(infra): serverless.yml con Scan y Resend; quitar SES`.

### Tarea B8 — Deploy y smoke manual

- [ ] Verificar dominio `navlogvfr.app` en Resend → `FROM_EMAIL=avisos@navlogvfr.app`; `RESEND_API_KEY` generada.
- [ ] `npm run create-tenant -- --email=<tu-email>` → anotar la key.
- [ ] `npm run deploy:dev`.
- [ ] Smoke: `curl -X PUT <url>/v1/pending-visits -H "Authorization: Bearer <key>" -d '[{...}]'` → 204; `POST /v1/notify {"dryRun":true}` → items; luego real → llega el digest al email del tenant.
- [ ] Commit de docs/env en el README del backend si aplica → merge de la rama del backend.

## Tareas — Parte 2: cliente (app Campo)

> Tocar `src/domain` (puerto nuevo) y `src/application` (no se modifica; `SyncPendingVisitsFeed`
> queda igual) es intención explícita de esta etapa.

### Tarea A1 — Puerto TenantConfigRepository + adapter localStorage

- [ ] Rojo: `tests/infrastructure/persistence/local/tenant-config-repository.test.ts` (con pragma `// @vitest-environment jsdom`): `get()` sin dato → `null`; `save()` + `get()` → el config; `clear()` → `null`; JSON corrupto → `null`.
- [ ] Verde: `src/domain/ports/outbound/tenant-config-repository.ts` (`TenantConfig`, `TenantConfigRepository`), `src/infrastructure/persistence/local/tenant-config-repository.ts` → commit `feat(domain+infra): puerto y adapter localStorage de config de tenant`.

### Tarea A2 — Container: config efectiva + sync con key runtime

- [ ] Rojo→verde: `tests/application/sync-pending-visits-feed.test.ts` (existe) sigue verde sin cambios; el cambio es de wiring.
- [ ] Verde: `src/composition/container.ts`:
  - interfaz `Container` suma `getTenantConfig/saveTenantConfig/clearTenantConfig` (tipadas con `TenantConfigRepository`).
  - `envFallback` = `{ apiUrl, apiKey }` si ambos env existen, si no `null`.
  - `syncPendingVisitsFeed` lee `(await tenantConfig.get()) ?? envFallback`; sin config → no-op; con config construye `HttpReminderFeedRepository(cfg.apiUrl, cfg.apiKey)`.
- [ ] `tests/support/in-memory-container.ts`: `makeInMemoryContainer(now, config?)` con `InMemoryTenantConfigRepository` (fake); `syncPendingVisitsFeed` no-op; `get/save/clearTenantConfig` sobre el fake.
- [ ] `tests/support/in-memory-tenant-config-repository.ts` (fake con memoria).
- [ ] Suite completa verde + typecheck → commit `feat(composition): config de tenant en runtime + compat env legacy`.

### Tarea A3 — TenantConfigProvider (Context) + hook

- [ ] Rojo: `tests/ui/tenant-config-provider.test.tsx` — con container in-memory vacío: `loading` true y luego `config === null`; tras `save()`, el provider expone el config y el repo lo persiste.
- [ ] Verde: `src/ui/TenantConfigProvider.tsx` (`TenantConfigContext`, `TenantConfigProvider`, `useTenantConfig()` con `{ config, loading, save, clear }`) → commit `feat(ui): contexto de config de tenant (gate + pantalla)`.

### Tarea A4 — ConfigScreen + ruta + ConfigGate

- [ ] Rojo: `tests/ui/config-screen.test.tsx`:
  - sin config: form con campo clave (password), campo URL (default de env o vacío); submit vacío → error; submit con clave+URL → `saveTenantConfig` llamado y navega a `/`.
- [ ] Rojo: `tests/ui/config-gate.test.tsx` (render de `<App/>` bajo `TenantConfigProvider`):
  - container sin config → muestra la pantalla de Configuración (redirige desde `/`).
  - container con config seed → muestra las tabs (Inicio).
- [ ] Verde: `src/ui/screens/ConfigScreen.tsx` (usa `useTenantConfig`, botón `.btn-primary`, errores en `role="alert"`), `src/ui/App.tsx` (ruta `/configuracion` fuera del gate; `ConfigGate` con `<Outlet/>` envolviendo el resto) → commit `feat(ui): pantalla de Configuración + gate de primer uso`.

### Tarea A5 — Wiring en main.tsx

- [ ] `src/main.tsx`: envolver `<App/>` con `<TenantConfigProvider>`.
- [ ] Suite completa verde + typecheck + `npm run build` → commit `feat(main): provider de config de tenant al render`.

## Tareas — Parte 3: cierre

- [ ] Actualizar `docs/ROADMAP.md`: fila `multitenant-keys` ✅ con conteo de tests (backend y app); resolver la deuda "API key embebida en el bundle" (ya sale del bundle); actualizar la fila de recordatorios (SES→Resend, auth por tenant, digest al mail del tenant).
- [ ] Suite completa verde + typecheck + `npm run build` (app) y `npm test` + typecheck (backend).
- [ ] Merge --no-ff a `main`, borrar rama. Vercel deployea solo.

---

## Código de referencia

### B1 — `src/domain/tenant.ts`

```ts
export const API_KEY_PREFIX = 'tnt';

export interface ParsedApiKey {
  tenantId: string;
  secret: string;
}

export interface TenantProfile {
  tenantId: string;
  email: string;
  keyHash: string;
  createdAt: string;
}

/** `tnt_<tenantId>_<secreto>` → tenantId/secret. Devuelve null si el formato no coincide. */
export function parseApiKey(raw: string): ParsedApiKey | null {
  const parts = raw.split('_');
  if (parts.length !== 3 || parts[0] !== API_KEY_PREFIX || !parts[1] || !parts[2]) return null;
  return { tenantId: parts[1], secret: parts[2] };
}
```

### B2 — `src/domain/ports/TenantRepository.ts` y `src/handlers/shared/authorize.ts`

```ts
// src/domain/ports/TenantRepository.ts
import type { TenantProfile } from '../tenant';

export interface TenantRepository {
  getProfile(tenantId: string): Promise<TenantProfile | null>;
  listProfiles(): Promise<TenantProfile[]>;
}
```

```ts
// src/handlers/shared/authorize.ts
import { createHash, timingSafeEqual } from 'node:crypto';
import type { TenantRepository } from '../../domain/ports/TenantRepository';
import type { TenantProfile } from '../../domain/tenant';
import { parseApiKey } from '../../domain/tenant';

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

function keysMatch(expectedHash: string, actualKey: string): boolean {
  const a = Buffer.from(expectedHash, 'hex');
  const b = Buffer.from(hashApiKey(actualKey), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authenticate(
  headers: Record<string, string | undefined> | null | undefined,
  repo: TenantRepository,
): Promise<TenantProfile | null> {
  const header = headers?.['Authorization'];
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length);
  const parsed = parseApiKey(token);
  if (!parsed) return null;
  const profile = await repo.getProfile(parsed.tenantId);
  if (!profile) return null;
  return keysMatch(profile.keyHash, token) ? profile : null;
}
```

### B3 — repos DynamoDB

```ts
// src/infrastructure/repositories/DynamoDBTenantRepository.ts
import { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { TenantRepository } from '../../domain/ports/TenantRepository';
import type { TenantProfile } from '../../domain/tenant';

export class DynamoDBTenantRepository implements TenantRepository {
  constructor(private readonly client: DynamoDBDocumentClient, private readonly tableName: string) {}

  private key(tenantId: string) {
    return { pk: `TENANT#${tenantId}`, sk: 'PROFILE' };
  }

  async getProfile(tenantId: string): Promise<TenantProfile | null> {
    const r = await this.client.send(new GetCommand({ TableName: this.tableName, Key: this.key(tenantId) }));
    return (r.Item as TenantProfile | undefined) ?? null;
  }

  async listProfiles(): Promise<TenantProfile[]> {
    const r = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(pk, :prefix) AND sk = :profile',
        ExpressionAttributeValues: { ':prefix': 'TENANT#', ':profile': 'PROFILE' },
      }),
    );
    return (r.Items as TenantProfile[] | undefined) ?? [];
  }

  async create(profile: TenantProfile): Promise<void> {
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: { ...this.key(profile.tenantId), ...profile } }),
    );
  }
}
```

```ts
// src/infrastructure/repositories/DynamoDBReminderFeedRepository.ts (cambios: tenantId + claves)
export class DynamoDBReminderFeedRepository implements ReminderFeedRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly tenantId: string,
  ) {}

  private key(sk: 'FEED#SNAPSHOT' | 'FEED#LAST_RUN') {
    return { pk: `TENANT#${this.tenantId}`, sk };
  }

  async replaceSnapshot(visits: PendingVisit[]): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...this.key('FEED#SNAPSHOT'), visits } }));
  }
  async getSnapshot(): Promise<PendingVisit[]> {
    const r = await this.client.send(new GetCommand({ TableName: this.tableName, Key: this.key('FEED#SNAPSHOT') }));
    return (r.Item?.visits as PendingVisit[] | undefined) ?? [];
  }
  async getLastRunAt(): Promise<string | null> {
    const r = await this.client.send(new GetCommand({ TableName: this.tableName, Key: this.key('FEED#LAST_RUN') }));
    return (r.Item?.lastRunAt as string | undefined) ?? null;
  }
  async claimRun(lastRunAt: string, expected: string | null): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...this.key('FEED#LAST_RUN'), lastRunAt },
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

### B4 — `src/infrastructure/adapters/ResendNotificationAdapter.ts` y `src/infrastructure/config/resend.ts`

```ts
import type { ReminderNotificationPort } from '../../domain/ports/ReminderNotificationPort';
import type { DueResult } from '../../domain/reminder-feed';

const RESEND_URL = 'https://api.resend.com/emails';

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

export class ResendNotificationAdapter implements ReminderNotificationPort {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async sendDigest(to: string, items: DueResult[]): Promise<void> {
    const lines = items.map(({ visit }) => {
      const who = [visit.clientName, visit.zoneName].filter(Boolean).join(' · ');
      const note = visit.notes ? ` (${visit.notes})` : '';
      return `Lote ${visit.fieldName}${who ? ` · ${who}` : ''} — ${formatDate(visit.plannedFor)}${note}`;
    });
    const subject = `Campo — recordatorio: ${items.length} ${items.length === 1 ? 'visita' : 'visitas'}`;
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ from: this.from, to: [to], subject, text: lines.join('\n') }),
    });
    if (!res.ok) throw new Error(`resend: HTTP ${res.status}`);
  }
}
```

```ts
// src/infrastructure/config/resend.ts
export const RESEND_API_KEY = process.env.RESEND_API_KEY ?? (() => { throw new Error('RESEND_API_KEY env var is required'); })();
export const FROM_EMAIL = process.env.FROM_EMAIL ?? (() => { throw new Error('FROM_EMAIL env var is required'); })();
```

### B5 — handlers

```ts
// src/handlers/replacePendingVisits.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ReplacePendingVisits } from '../application/use-cases/ReplacePendingVisits';
import { DynamoDBReminderFeedRepository } from '../infrastructure/repositories/DynamoDBReminderFeedRepository';
import { DynamoDBTenantRepository } from '../infrastructure/repositories/DynamoDBTenantRepository';
import { APP_TABLE, dynamoDBClient } from '../infrastructure/config/dynamodb';
import { ReplacePendingVisitsRequestSchema } from '../schemas/pending-visit.schema';
import { authenticate } from './shared/authorize';
import { handleError } from './shared/errorHandler';
import * as response from './shared/response';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenants = new DynamoDBTenantRepository(dynamoDBClient, APP_TABLE);
    const tenant = await authenticate(event.headers, tenants);
    if (!tenant) return response.unauthorized();

    const visits = ReplacePendingVisitsRequestSchema.parse(JSON.parse(event.body ?? '[]'));
    const repo = new DynamoDBReminderFeedRepository(dynamoDBClient, APP_TABLE, tenant.tenantId);
    await new ReplacePendingVisits(repo).execute(visits);
    return response.noContent();
  } catch (error) {
    return handleError(error);
  }
}
```

```ts
// src/handlers/notify.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { NotifyDueReminders } from '../application/use-cases/NotifyDueReminders';
import { DynamoDBReminderFeedRepository } from '../infrastructure/repositories/DynamoDBReminderFeedRepository';
import { DynamoDBTenantRepository } from '../infrastructure/repositories/DynamoDBTenantRepository';
import { APP_TABLE, dynamoDBClient } from '../infrastructure/config/dynamodb';
import { FROM_EMAIL, RESEND_API_KEY } from '../infrastructure/config/resend';
import { ResendNotificationAdapter } from '../infrastructure/adapters/ResendNotificationAdapter';
import { authenticate } from './shared/authorize';
import { handleError } from './shared/errorHandler';
import * as response from './shared/response';

type NotifyEvent = Partial<APIGatewayProxyEvent> & Partial<ScheduledEvent>;

export async function handler(event: NotifyEvent): Promise<APIGatewayProxyResult | void> {
  const isHttp = typeof event.httpMethod === 'string';
  const tenants = new DynamoDBTenantRepository(dynamoDBClient, APP_TABLE);
  const notifier = new ResendNotificationAdapter(RESEND_API_KEY, FROM_EMAIL);

  try {
    if (isHttp) {
      const tenant = await authenticate((event as APIGatewayProxyEvent).headers, tenants);
      if (!tenant) return response.unauthorized();
      const dryRun =
        (JSON.parse((event as APIGatewayProxyEvent).body ?? '{}') as { dryRun?: boolean }).dryRun === true;
      const repo = new DynamoDBReminderFeedRepository(dynamoDBClient, APP_TABLE, tenant.tenantId);
      const result = await new NotifyDueReminders(repo, notifier, tenant.email).execute(new Date(), dryRun);
      return response.ok(result);
    }

    for (const profile of await tenants.listProfiles()) {
      const repo = new DynamoDBReminderFeedRepository(dynamoDBClient, APP_TABLE, profile.tenantId);
      await new NotifyDueReminders(repo, notifier, profile.email).execute(new Date(), false);
    }
  } catch (error) {
    if (isHttp) return handleError(error);
    console.error('notifyScheduled failed:', error);
  }
}
```

### B6 — `scripts/create-tenant.ts`

```ts
import { randomBytes, randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { hashApiKey } from '../src/handlers/shared/authorize';

const email = process.argv.find((a) => a.startsWith('--email='))?.slice('--email='.length);
if (!email) {
  console.error('Uso: APP_TABLE=<tabla> npm run create-tenant -- --email=user@example.com');
  process.exit(1);
}
const tableName = process.env.APP_TABLE ?? (() => { throw new Error('APP_TABLE env required'); })();

const tenantId = randomUUID();
const rawKey = `tnt_${tenantId}_${randomBytes(24).toString('hex')}`;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' }));

await client.send(
  new PutCommand({
    TableName: tableName,
    Item: {
      pk: `TENANT#${tenantId}`,
      sk: 'PROFILE',
      tenantId,
      email,
      keyHash: hashApiKey(rawKey),
      createdAt: new Date().toISOString(),
    },
  }),
);

console.log(`Tenant creado: ${tenantId}`);
console.log(`Email del digest: ${email}`);
console.log('');
console.log('KEY (mostrar UNA sola vez):');
console.log(rawKey);
```

### A1 — puerto + adapter de config (app)

```ts
// src/domain/ports/outbound/tenant-config-repository.ts
export interface TenantConfig {
  apiUrl: string;
  apiKey: string;
}

export interface TenantConfigRepository {
  get(): Promise<TenantConfig | null>;
  save(config: TenantConfig): Promise<void>;
  clear(): Promise<void>;
}
```

```ts
// src/infrastructure/persistence/local/tenant-config-repository.ts
import type { TenantConfig, TenantConfigRepository } from '@/domain/ports/outbound/tenant-config-repository';

const STORAGE_KEY = 'campo.tenantConfig';

export class LocalTenantConfigRepository implements TenantConfigRepository {
  async get(): Promise<TenantConfig | null> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TenantConfig;
    } catch {
      return null;
    }
  }

  async save(config: TenantConfig): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }
}
```

### A2 — container.ts (cambios)

```ts
import { LocalTenantConfigRepository } from '@/infrastructure/persistence/local/tenant-config-repository';
import type { TenantConfig, TenantConfigRepository } from '@/domain/ports/outbound/tenant-config-repository';
// …interfaz Container suma:
getTenantConfig: () => Promise<TenantConfig | null>;
saveTenantConfig: (config: TenantConfig) => Promise<void>;
clearTenantConfig: () => Promise<void>;

// dentro de buildContainer:
const tenantConfigRepo = new LocalTenantConfigRepository();
const envFallback: TenantConfig | null =
  import.meta.env.VITE_REMINDERS_API_URL && import.meta.env.VITE_REMINDERS_API_KEY
    ? {
        apiUrl: import.meta.env.VITE_REMINDERS_API_URL as string,
        apiKey: import.meta.env.VITE_REMINDERS_API_KEY as string,
      }
    : null;

const syncPendingVisitsFeed = async (): Promise<void> => {
  const config = (await tenantConfigRepo.get()) ?? envFallback;
  if (!config) return;
  const sync = new SyncPendingVisitsFeed(visits, fields, new HttpReminderFeedRepository(config.apiUrl, config.apiKey));
  await sync.execute();
};

// en el objeto retornado:
getTenantConfig: () => tenantConfigRepo.get(),
saveTenantConfig: (config) => tenantConfigRepo.save(config),
clearTenantConfig: () => tenantConfigRepo.clear(),
syncPendingVisitsFeed,
```

### A3 — `src/ui/TenantConfigProvider.tsx`

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TenantConfig } from '@/domain/ports/outbound/tenant-config-repository';
import { useCampo } from '@/ui/CampoProvider';

interface TenantConfigContextValue {
  config: TenantConfig | null;
  loading: boolean;
  save: (config: TenantConfig) => Promise<void>;
  clear: () => Promise<void>;
}

const TenantConfigContext = createContext<TenantConfigContextValue | null>(null);

export function TenantConfigProvider({ children }: { children: ReactNode }) {
  const { getTenantConfig, saveTenantConfig, clearTenantConfig } = useCampo();
  const [config, setConfig] = useState<TenantConfig | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void getTenantConfig().then((c) => {
      if (!cancelled) setConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, [getTenantConfig]);

  const save = useCallback(
    async (next: TenantConfig) => {
      await saveTenantConfig(next);
      setConfig(next);
    },
    [saveTenantConfig],
  );

  const clear = useCallback(async () => {
    await clearTenantConfig();
    setConfig(null);
  }, [clearTenantConfig]);

  const value = useMemo(
    () => ({ config: config ?? null, loading: config === undefined, save, clear }),
    [config, save, clear],
  );

  return <TenantConfigContext.Provider value={value}>{children}</TenantConfigContext.Provider>;
}

export function useTenantConfig(): TenantConfigContextValue {
  const ctx = useContext(TenantConfigContext);
  if (!ctx) throw new Error('useTenantConfig must be used within a TenantConfigProvider');
  return ctx;
}
```

### A4 — `src/ui/screens/ConfigScreen.tsx` + `App.tsx`

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantConfig } from '@/ui/TenantConfigProvider';

export function ConfigScreen() {
  const { save } = useTenantConfig();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_REMINDERS_API_URL ?? '');
  const [localError, setLocalError] = useState<string | undefined>();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiUrl.trim()) {
      setLocalError('Completá la clave de acceso y la URL de la API.');
      return;
    }
    setLocalError(undefined);
    await save({ apiUrl: apiUrl.trim(), apiKey: apiKey.trim() });
    navigate('/', { replace: true });
  };

  return (
    <main className="screen">
      <h1 className="screen-title">Configuración</h1>
      <p className="field-sub">Pegá la clave de acceso que te pasaron para activar los recordatorios por email.</p>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">Clave de acceso</span>
          <input className="control" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span className="field-label">URL de la API</span>
          <input className="control" type="url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
        </label>
        {localError && (
          <p className="field-sub" role="alert">
            {localError}
          </p>
        )}
        <button className="btn-primary" type="submit">
          Guardar
        </button>
      </form>
    </main>
  );
}
```

```tsx
// src/ui/App.tsx — agregar ruta + gate
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useTenantConfig } from '@/ui/TenantConfigProvider';
import { ConfigScreen } from '@/ui/screens/ConfigScreen';

function ConfigGate() {
  const { config, loading } = useTenantConfig();
  if (loading) return null;
  if (!config) return <Navigate to="/configuracion" replace />;
  return <Outlet />;
}

// en <Routes>:
<Route path="/configuracion" element={<ConfigScreen />} />
<Route element={<ConfigGate />}>
  <Route element={<TabsLayout />}>{/* tabs existentes */}</Route>
  {/* resto de rutas existentes */}
</Route>
```

### A5 — `src/main.tsx`

```tsx
import { TenantConfigProvider } from '@/ui/TenantConfigProvider';
// …dentro de <CampoProvider>:
<CampoProvider container={container}>
  <TenantConfigProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </TenantConfigProvider>
</CampoProvider>
```
