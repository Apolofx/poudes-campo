# Etapa 1 — Núcleo de dominio y aplicación (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure domain and application core for HU5 (search fields) and HU1 (record visit), fully test-driven against in-memory adapters, with zero infrastructure (no IndexedDB, no UI, no server).

**Architecture:** Hexagonal. The `domain/` layer holds entities, value objects, outbound ports and pure services, and imports nothing from other layers. The `application/` layer holds use cases (`SearchFields`, `RecordVisit`) that depend only on domain ports. In-memory repositories and test doubles (`FixedClock`, `IncrementingIdGenerator`) implement the ports for tests. Dates enter only through the `Clock` port; day arithmetic goes through a deterministic UTC-based `date-utils`.

**Tech Stack:** TypeScript (strict), Vitest. No other runtime dependencies.

## Global Constraints

- **Language of code:** English identifiers only. `PascalCase` classes/types, `camelCase` methods/vars, `kebab-case` file/folder names. The ubiquitous-language glossary is binding: `Zone`, `Client`, `Field` (NOT `Plot`), `Visit`, `Reminder`, `Coordinates`, `Hectares`, `VisitInterval`, `VisitStatus` (`ACTIVE`/`CANCELLED`), `ReminderStatus` (`PENDING`/`SENT`/`CANCELLED`), `notes`, `nextVisitDate`.
- **No dose data, ever.** No field, property, parameter, column or type may hold agrochemical dose, product, or prescription data. If a task seems to need one, stop — it is out of scope by design.
- **Dependency rule:** `domain/` imports nothing from `application/` or `infrastructure/`. `application/` imports only from `domain/`. `infrastructure/` imports only from `domain/`. Tests may import from any layer.
- **Time:** the domain never reads the system clock. Current time is obtained only via the `Clock` port, injected into use cases. "Day" = 24h; all calendar-day math lives in `date-utils` and is UTC-based for deterministic tests.
- **Out of scope for this plan (later etapas):** `UrgencyCalculator`/`VisitUrgency` and the dashboard (Etapa 2); `DispatchDueReminders`/notifications (Etapa 3); `CancelVisit`, visit edit, catalog lifecycle CRUD (Etapa 4); sync/outbox/server (Etapa 5); IndexedDB adapter + React UI + PWA shell (Etapa 1b). This plan only *creates* reminders as records; it never dispatches them.
- **Tooling:** `npm test` must stay green after every task. Import from `src/` via the `@/` alias.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable Vitest toolchain; the `@/*` → `src/*` path alias used by every later task.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "campo",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
coverage/
```

- [ ] **Step 5: Write the smoke test** — `tests/smoke.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Install and run**

Run: `npm install && npm test`
Expected: PASS (1 test).

- [ ] **Step 7: Initialize repo and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold typescript + vitest toolchain"
```

---

### Task 2: Shared kernel (ids, errors, date-utils)

**Files:**
- Create: `src/domain/shared/ids.ts`
- Create: `src/domain/shared/errors.ts`
- Create: `src/domain/shared/date-utils.ts`
- Test: `tests/domain/shared/date-utils.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Id aliases: `ZoneId`, `ClientId`, `FieldId`, `VisitId`, `ReminderId` (all `string`).
  - Error classes (all extend `DomainError extends Error`): `EmptyName`, `MissingFieldReference`, `InvalidHectares`, `InvalidCoordinates`, `InvalidVisitInterval`, `IncompleteFollowUp`, `FieldNotFound`, `FutureVisitDate`, `DuplicateVisitForDay`.
  - `addDays(date: Date, days: number): Date` — 24h increments (negative allowed).
  - `isSameCalendarDay(a: Date, b: Date): boolean` — UTC year/month/day equality.
  - `daysBetween(from: Date, to: Date): number` — whole UTC calendar days, signed.

- [ ] **Step 1: Create `src/domain/shared/ids.ts`**

```typescript
export type ZoneId = string;
export type ClientId = string;
export type FieldId = string;
export type VisitId = string;
export type ReminderId = string;
```

- [ ] **Step 2: Create `src/domain/shared/errors.ts`**

```typescript
export class DomainError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class EmptyName extends DomainError {}
export class MissingFieldReference extends DomainError {}
export class InvalidHectares extends DomainError {}
export class InvalidCoordinates extends DomainError {}
export class InvalidVisitInterval extends DomainError {}
export class IncompleteFollowUp extends DomainError {}
export class FieldNotFound extends DomainError {}
export class FutureVisitDate extends DomainError {}
export class DuplicateVisitForDay extends DomainError {}
```

- [ ] **Step 3: Write the failing test** — `tests/domain/shared/date-utils.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { addDays, isSameCalendarDay, daysBetween } from '@/domain/shared/date-utils';

describe('addDays', () => {
  it('adds whole days in 24h increments', () => {
    const base = new Date('2026-07-27T10:00:00.000Z');
    expect(addDays(base, 7).toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });
  it('subtracts with negative days', () => {
    const base = new Date('2026-07-27T10:00:00.000Z');
    expect(addDays(base, -3).toISOString()).toBe('2026-07-24T10:00:00.000Z');
  });
});

describe('isSameCalendarDay', () => {
  it('is true for the same UTC date at different times', () => {
    expect(
      isSameCalendarDay(new Date('2026-07-27T01:00:00Z'), new Date('2026-07-27T23:00:00Z')),
    ).toBe(true);
  });
  it('is false across the UTC day boundary', () => {
    expect(
      isSameCalendarDay(new Date('2026-07-27T23:00:00Z'), new Date('2026-07-28T00:30:00Z')),
    ).toBe(false);
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days forward', () => {
    expect(daysBetween(new Date('2026-07-27T10:00:00Z'), new Date('2026-08-03T05:00:00Z'))).toBe(7);
  });
  it('is negative for a past target', () => {
    expect(daysBetween(new Date('2026-07-27T10:00:00Z'), new Date('2026-07-24T20:00:00Z'))).toBe(-3);
  });
  it('is zero within the same day', () => {
    expect(daysBetween(new Date('2026-07-27T01:00:00Z'), new Date('2026-07-27T23:00:00Z'))).toBe(0);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/domain/shared/date-utils`.

- [ ] **Step 5: Create `src/domain/shared/date-utils.ts`**

```typescript
const MS_PER_DAY = 86_400_000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function daysBetween(from: Date, to: Date): number {
  const startFrom = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const startTo = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((startTo - startFrom) / MS_PER_DAY);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/shared tests/domain/shared
git commit -m "feat: add shared kernel (ids, domain errors, deterministic date utils)"
```

---

### Task 3: Value objects (Hectares, Coordinates, VisitInterval)

**Files:**
- Create: `src/domain/value-objects/hectares.ts`
- Create: `src/domain/value-objects/coordinates.ts`
- Create: `src/domain/value-objects/visit-interval.ts`
- Test: `tests/domain/value-objects/value-objects.test.ts`

**Interfaces:**
- Consumes: errors from Task 2.
- Produces:
  - `Hectares.of(value: number): Hectares` with `.value: number`.
  - `Coordinates.of(latitude: number, longitude: number): Coordinates` with `.latitude`, `.longitude`.
  - `VisitInterval.ofDays(days: number): VisitInterval` with `.days: number`.

- [ ] **Step 1: Write the failing test** — `tests/domain/value-objects/value-objects.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Hectares } from '@/domain/value-objects/hectares';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { InvalidHectares, InvalidCoordinates, InvalidVisitInterval } from '@/domain/shared/errors';

describe('Hectares', () => {
  it('accepts a positive value', () => {
    expect(Hectares.of(12.5).value).toBe(12.5);
  });
  it('rejects zero and negatives', () => {
    expect(() => Hectares.of(0)).toThrow(InvalidHectares);
    expect(() => Hectares.of(-1)).toThrow(InvalidHectares);
  });
});

describe('Coordinates', () => {
  it('accepts in-range lat/lng', () => {
    const c = Coordinates.of(-36.5, -61.2);
    expect(c.latitude).toBe(-36.5);
    expect(c.longitude).toBe(-61.2);
  });
  it('rejects out-of-range values', () => {
    expect(() => Coordinates.of(-91, 0)).toThrow(InvalidCoordinates);
    expect(() => Coordinates.of(0, 181)).toThrow(InvalidCoordinates);
  });
});

describe('VisitInterval', () => {
  it('accepts a positive integer of days', () => {
    expect(VisitInterval.ofDays(7).days).toBe(7);
  });
  it('rejects zero, negatives and non-integers', () => {
    expect(() => VisitInterval.ofDays(0)).toThrow(InvalidVisitInterval);
    expect(() => VisitInterval.ofDays(-5)).toThrow(InvalidVisitInterval);
    expect(() => VisitInterval.ofDays(7.5)).toThrow(InvalidVisitInterval);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve value-object modules.

- [ ] **Step 3: Create `src/domain/value-objects/hectares.ts`**

```typescript
import { InvalidHectares } from '@/domain/shared/errors';

export class Hectares {
  private constructor(readonly value: number) {}

  static of(value: number): Hectares {
    if (!Number.isFinite(value) || value <= 0) {
      throw new InvalidHectares(`hectares must be > 0, got ${value}`);
    }
    return new Hectares(value);
  }
}
```

- [ ] **Step 4: Create `src/domain/value-objects/coordinates.ts`**

```typescript
import { InvalidCoordinates } from '@/domain/shared/errors';

export class Coordinates {
  private constructor(
    readonly latitude: number,
    readonly longitude: number,
  ) {}

  static of(latitude: number, longitude: number): Coordinates {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new InvalidCoordinates(`latitude out of range: ${latitude}`);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new InvalidCoordinates(`longitude out of range: ${longitude}`);
    }
    return new Coordinates(latitude, longitude);
  }
}
```

- [ ] **Step 5: Create `src/domain/value-objects/visit-interval.ts`**

```typescript
import { InvalidVisitInterval } from '@/domain/shared/errors';

export class VisitInterval {
  private constructor(readonly days: number) {}

  static ofDays(days: number): VisitInterval {
    if (!Number.isInteger(days) || days <= 0) {
      throw new InvalidVisitInterval(`interval days must be a positive integer, got ${days}`);
    }
    return new VisitInterval(days);
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/value-objects tests/domain/value-objects
git commit -m "feat: add Hectares, Coordinates and VisitInterval value objects"
```

---

### Task 4: Catalog entities (Zone, Client, Field)

**Files:**
- Create: `src/domain/entities/zone.ts`
- Create: `src/domain/entities/client.ts`
- Create: `src/domain/entities/field.ts`
- Test: `tests/domain/entities/catalog.test.ts`

**Interfaces:**
- Consumes: ids and errors (Task 2); `Coordinates`, `Hectares` (Task 3).
- Produces:
  - `new Zone(id: ZoneId, name: string)` with `.id`, `.name`.
  - `new Client(id: ClientId, name: string)` with `.id`, `.name`.
  - `interface FieldProps { id: FieldId; name: string; clientId: ClientId; zoneId: ZoneId; coordinates?: Coordinates; hectares?: Hectares; crop?: string }`
  - `new Field(props: FieldProps)` exposing all props as readonly members.

- [ ] **Step 1: Write the failing test** — `tests/domain/entities/catalog.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { Hectares } from '@/domain/value-objects/hectares';
import { EmptyName, MissingFieldReference } from '@/domain/shared/errors';

describe('Zone', () => {
  it('constructs with id and name', () => {
    expect(new Zone('z1', 'Quiroga').name).toBe('Quiroga');
  });
  it('rejects an empty name', () => {
    expect(() => new Zone('z1', '   ')).toThrow(EmptyName);
  });
});

describe('Client', () => {
  it('rejects an empty name', () => {
    expect(() => new Client('c1', '')).toThrow(EmptyName);
  });
});

describe('Field', () => {
  it('constructs with required client and zone references', () => {
    const f = new Field({ id: 'f1', name: 'Centenario', clientId: 'c1', zoneId: 'z1' });
    expect(f.clientId).toBe('c1');
    expect(f.zoneId).toBe('z1');
  });
  it('rejects an empty name', () => {
    expect(() => new Field({ id: 'f1', name: '', clientId: 'c1', zoneId: 'z1' })).toThrow(EmptyName);
  });
  it('rejects a missing client or zone reference', () => {
    expect(() => new Field({ id: 'f1', name: 'X', clientId: '', zoneId: 'z1' })).toThrow(MissingFieldReference);
    expect(() => new Field({ id: 'f1', name: 'X', clientId: 'c1', zoneId: '' })).toThrow(MissingFieldReference);
  });
  it('accepts optional coordinates and hectares', () => {
    const f = new Field({
      id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1',
      coordinates: Coordinates.of(-36, -61), hectares: Hectares.of(50),
    });
    expect(f.hectares?.value).toBe(50);
    expect(f.coordinates?.latitude).toBe(-36);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve entity modules.

- [ ] **Step 3: Create `src/domain/entities/zone.ts`**

```typescript
import type { ZoneId } from '@/domain/shared/ids';
import { EmptyName } from '@/domain/shared/errors';

export class Zone {
  constructor(
    readonly id: ZoneId,
    readonly name: string,
  ) {
    if (name.trim() === '') throw new EmptyName('Zone name must not be empty');
  }
}
```

- [ ] **Step 4: Create `src/domain/entities/client.ts`**

```typescript
import type { ClientId } from '@/domain/shared/ids';
import { EmptyName } from '@/domain/shared/errors';

export class Client {
  constructor(
    readonly id: ClientId,
    readonly name: string,
  ) {
    if (name.trim() === '') throw new EmptyName('Client name must not be empty');
  }
}
```

- [ ] **Step 5: Create `src/domain/entities/field.ts`**

```typescript
import type { FieldId, ClientId, ZoneId } from '@/domain/shared/ids';
import { EmptyName, MissingFieldReference } from '@/domain/shared/errors';
import type { Coordinates } from '@/domain/value-objects/coordinates';
import type { Hectares } from '@/domain/value-objects/hectares';

export interface FieldProps {
  id: FieldId;
  name: string;
  clientId: ClientId;
  zoneId: ZoneId;
  coordinates?: Coordinates;
  hectares?: Hectares;
  crop?: string;
}

export class Field {
  readonly id: FieldId;
  readonly name: string;
  readonly clientId: ClientId;
  readonly zoneId: ZoneId;
  readonly coordinates?: Coordinates;
  readonly hectares?: Hectares;
  readonly crop?: string;

  constructor(props: FieldProps) {
    if (props.name.trim() === '') throw new EmptyName('Field name must not be empty');
    if (!props.clientId) throw new MissingFieldReference('Field must reference a client');
    if (!props.zoneId) throw new MissingFieldReference('Field must reference a zone');

    this.id = props.id;
    this.name = props.name;
    this.clientId = props.clientId;
    this.zoneId = props.zoneId;
    this.coordinates = props.coordinates;
    this.hectares = props.hectares;
    this.crop = props.crop;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/entities tests/domain/entities
git commit -m "feat: add Zone, Client and Field catalog entities with invariants"
```

---

### Task 5: Visit entity

**Files:**
- Create: `src/domain/entities/visit.ts`
- Test: `tests/domain/entities/visit.test.ts`

**Interfaces:**
- Consumes: ids, errors (Task 2); `VisitInterval` (Task 3).
- Produces:
  - `type VisitStatus = 'ACTIVE' | 'CANCELLED'`
  - `interface FollowUp { nextVisitDate: Date; interval: VisitInterval }`
  - `interface VisitProps { id: VisitId; fieldId: FieldId; visitDate: Date; createdAt: Date; notes?: string; followUp?: FollowUp; status?: VisitStatus }`
  - `new Visit(props: VisitProps)` exposing `id`, `fieldId`, `visitDate`, `createdAt`, `notes?`, `followUp?`, and `status` (defaults to `'ACTIVE'`).

- [ ] **Step 1: Write the failing test** — `tests/domain/entities/visit.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Visit } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { IncompleteFollowUp } from '@/domain/shared/errors';

const base = {
  id: 'v1',
  fieldId: 'f1',
  visitDate: new Date('2026-07-27T10:00:00Z'),
  createdAt: new Date('2026-07-27T10:00:00Z'),
};

describe('Visit', () => {
  it('defaults to ACTIVE status', () => {
    expect(new Visit({ ...base }).status).toBe('ACTIVE');
  });
  it('stores optional free-text notes', () => {
    expect(new Visit({ ...base, notes: 'soja en V4, todo ok' }).notes).toBe('soja en V4, todo ok');
  });
  it('accepts a complete follow-up', () => {
    const v = new Visit({
      ...base,
      followUp: { nextVisitDate: new Date('2026-08-03T10:00:00Z'), interval: VisitInterval.ofDays(7) },
    });
    expect(v.followUp?.interval.days).toBe(7);
    expect(v.followUp?.nextVisitDate.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });
  it('has no follow-up when omitted', () => {
    expect(new Visit({ ...base }).followUp).toBeUndefined();
  });
  it('rejects a partial follow-up', () => {
    expect(
      () => new Visit({ ...base, followUp: { nextVisitDate: new Date('2026-08-03T10:00:00Z') } as never }),
    ).toThrow(IncompleteFollowUp);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/domain/entities/visit`.

- [ ] **Step 3: Create `src/domain/entities/visit.ts`**

```typescript
import type { VisitId, FieldId } from '@/domain/shared/ids';
import type { VisitInterval } from '@/domain/value-objects/visit-interval';
import { IncompleteFollowUp } from '@/domain/shared/errors';

export type VisitStatus = 'ACTIVE' | 'CANCELLED';

export interface FollowUp {
  nextVisitDate: Date;
  interval: VisitInterval;
}

export interface VisitProps {
  id: VisitId;
  fieldId: FieldId;
  visitDate: Date;
  createdAt: Date;
  notes?: string;
  followUp?: FollowUp;
  status?: VisitStatus;
}

export class Visit {
  readonly id: VisitId;
  readonly fieldId: FieldId;
  readonly visitDate: Date;
  readonly createdAt: Date;
  readonly notes?: string;
  readonly followUp?: FollowUp;
  readonly status: VisitStatus;

  constructor(props: VisitProps) {
    if (props.followUp && (!props.followUp.nextVisitDate || !props.followUp.interval)) {
      throw new IncompleteFollowUp('follow-up requires both nextVisitDate and interval');
    }

    this.id = props.id;
    this.fieldId = props.fieldId;
    this.visitDate = props.visitDate;
    this.createdAt = props.createdAt;
    this.notes = props.notes;
    this.followUp = props.followUp;
    this.status = props.status ?? 'ACTIVE';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/visit.ts tests/domain/entities/visit.test.ts
git commit -m "feat: add Visit entity with follow-up co-presence invariant"
```

---

### Task 6: Reminder entity

**Files:**
- Create: `src/domain/entities/reminder.ts`
- Test: `tests/domain/entities/reminder.test.ts`

**Interfaces:**
- Consumes: ids (Task 2).
- Produces:
  - `type ReminderStatus = 'PENDING' | 'SENT' | 'CANCELLED'`
  - `interface ReminderProps { id: ReminderId; visitId: VisitId; fieldId: FieldId; remindAt: Date; status?: ReminderStatus }`
  - `new Reminder(props)` with readonly `id`, `visitId`, `fieldId`, `remindAt`; a `status` getter (defaults `'PENDING'`); and `cancel(): void` (idempotent; `PENDING`/`SENT` → `CANCELLED`).

- [ ] **Step 1: Write the failing test** — `tests/domain/entities/reminder.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Reminder } from '@/domain/entities/reminder';

const base = { id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: new Date('2026-08-03T10:00:00Z') };

describe('Reminder', () => {
  it('defaults to PENDING', () => {
    expect(new Reminder({ ...base }).status).toBe('PENDING');
  });
  it('cancel moves PENDING to CANCELLED', () => {
    const r = new Reminder({ ...base });
    r.cancel();
    expect(r.status).toBe('CANCELLED');
  });
  it('cancel is idempotent', () => {
    const r = new Reminder({ ...base });
    r.cancel();
    r.cancel();
    expect(r.status).toBe('CANCELLED');
  });
  it('cancel works from SENT too', () => {
    const r = new Reminder({ ...base, status: 'SENT' });
    r.cancel();
    expect(r.status).toBe('CANCELLED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/domain/entities/reminder`.

- [ ] **Step 3: Create `src/domain/entities/reminder.ts`**

```typescript
import type { ReminderId, VisitId, FieldId } from '@/domain/shared/ids';

export type ReminderStatus = 'PENDING' | 'SENT' | 'CANCELLED';

export interface ReminderProps {
  id: ReminderId;
  visitId: VisitId;
  fieldId: FieldId;
  remindAt: Date;
  status?: ReminderStatus;
}

export class Reminder {
  readonly id: ReminderId;
  readonly visitId: VisitId;
  readonly fieldId: FieldId;
  readonly remindAt: Date;
  private _status: ReminderStatus;

  constructor(props: ReminderProps) {
    this.id = props.id;
    this.visitId = props.visitId;
    this.fieldId = props.fieldId;
    this.remindAt = props.remindAt;
    this._status = props.status ?? 'PENDING';
  }

  get status(): ReminderStatus {
    return this._status;
  }

  cancel(): void {
    if (this._status === 'CANCELLED') return;
    this._status = 'CANCELLED';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/reminder.ts tests/domain/entities/reminder.test.ts
git commit -m "feat: add Reminder entity with idempotent cancel"
```

---

### Task 7: Field search service, FieldRepository port, in-memory repo

**Files:**
- Create: `src/domain/services/field-search.ts`
- Create: `src/domain/ports/outbound/field-repository.ts`
- Create: `src/infrastructure/persistence/in-memory/in-memory-field-repository.ts`
- Test: `tests/domain/services/field-search.test.ts`
- Test: `tests/infrastructure/in-memory-field-repository.test.ts`

**Interfaces:**
- Consumes: `Field` (Task 4), `Zone`/`Client` (Task 4), ids (Task 2).
- Produces:
  - `interface FieldSearchResult { field: Field; clientName: string; zoneName: string }`
  - `fieldMatchesQuery(result: FieldSearchResult, query: string): boolean` — trimmed, case-insensitive substring across field/client/zone names; empty query matches everything.
  - `interface FieldRepository { save(field: Field): Promise<void>; findById(id: FieldId): Promise<Field | null>; listAllWithHierarchy(): Promise<FieldSearchResult[]> }`
  - `new InMemoryFieldRepository(zones: Map<ZoneId, Zone>, clients: Map<ClientId, Client>, fields?: Field[])`

- [ ] **Step 1: Write the failing test** — `tests/domain/services/field-search.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Field } from '@/domain/entities/field';
import { fieldMatchesQuery, type FieldSearchResult } from '@/domain/services/field-search';

const result = (name: string, clientName: string, zoneName: string): FieldSearchResult => ({
  field: new Field({ id: 'f', name, clientId: 'c', zoneId: 'z' }),
  clientName,
  zoneName,
});

describe('fieldMatchesQuery', () => {
  it('matches a partial field name, case-insensitive', () => {
    expect(fieldMatchesQuery(result('Centenario', 'Perez', 'Quiroga'), 'cent')).toBe(true);
  });
  it('matches by client name', () => {
    expect(fieldMatchesQuery(result('X', 'Martinez', 'Quiroga'), 'marti')).toBe(true);
  });
  it('matches by zone name', () => {
    expect(fieldMatchesQuery(result('X', 'Perez', 'Bellocq'), 'bello')).toBe(true);
  });
  it('returns false when nothing matches', () => {
    expect(fieldMatchesQuery(result('X', 'Perez', 'Quiroga'), 'zzz')).toBe(false);
  });
  it('treats an empty query as matching everything', () => {
    expect(fieldMatchesQuery(result('X', 'Perez', 'Quiroga'), '   ')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/domain/services/field-search`.

- [ ] **Step 3: Create `src/domain/services/field-search.ts`**

```typescript
import type { Field } from '@/domain/entities/field';

export interface FieldSearchResult {
  field: Field;
  clientName: string;
  zoneName: string;
}

export function fieldMatchesQuery(result: FieldSearchResult, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return [result.field.name, result.clientName, result.zoneName].some((value) =>
    value.toLowerCase().includes(q),
  );
}
```

- [ ] **Step 4: Create `src/domain/ports/outbound/field-repository.ts`**

```typescript
import type { Field } from '@/domain/entities/field';
import type { FieldId } from '@/domain/shared/ids';
import type { FieldSearchResult } from '@/domain/services/field-search';

export interface FieldRepository {
  save(field: Field): Promise<void>;
  findById(id: FieldId): Promise<Field | null>;
  listAllWithHierarchy(): Promise<FieldSearchResult[]>;
}
```

- [ ] **Step 5: Write the failing test** — `tests/infrastructure/in-memory-field-repository.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';

describe('InMemoryFieldRepository', () => {
  it('resolves hierarchy names for every field', async () => {
    const zones = new Map([['z1', new Zone('z1', 'Quiroga')]]);
    const clients = new Map([['c1', new Client('c1', 'Martinez')]]);
    const repo = new InMemoryFieldRepository(zones, clients, [
      new Field({ id: 'f1', name: 'Centenario', clientId: 'c1', zoneId: 'z1' }),
    ]);
    const all = await repo.listAllWithHierarchy();
    expect(all).toHaveLength(1);
    expect(all[0].clientName).toBe('Martinez');
    expect(all[0].zoneName).toBe('Quiroga');
  });
  it('finds by id and returns null when absent', async () => {
    const repo = new InMemoryFieldRepository(new Map(), new Map(), []);
    expect(await repo.findById('nope')).toBeNull();
  });
  it('accepts fields saved after construction', async () => {
    const zones = new Map([['z1', new Zone('z1', 'Bellocq')]]);
    const clients = new Map([['c1', new Client('c1', 'Perez')]]);
    const repo = new InMemoryFieldRepository(zones, clients, []);
    await repo.save(new Field({ id: 'f9', name: 'La Nueva', clientId: 'c1', zoneId: 'z1' }));
    expect((await repo.findById('f9'))?.name).toBe('La Nueva');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/infrastructure/persistence/in-memory/in-memory-field-repository`.

- [ ] **Step 7: Create `src/infrastructure/persistence/in-memory/in-memory-field-repository.ts`**

```typescript
import type { Field } from '@/domain/entities/field';
import type { Zone } from '@/domain/entities/zone';
import type { Client } from '@/domain/entities/client';
import type { FieldId, ZoneId, ClientId } from '@/domain/shared/ids';
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { FieldSearchResult } from '@/domain/services/field-search';

export class InMemoryFieldRepository implements FieldRepository {
  private readonly fields = new Map<FieldId, Field>();

  constructor(
    private readonly zones: Map<ZoneId, Zone>,
    private readonly clients: Map<ClientId, Client>,
    fields: Field[] = [],
  ) {
    for (const field of fields) this.fields.set(field.id, field);
  }

  async save(field: Field): Promise<void> {
    this.fields.set(field.id, field);
  }

  async findById(id: FieldId): Promise<Field | null> {
    return this.fields.get(id) ?? null;
  }

  async listAllWithHierarchy(): Promise<FieldSearchResult[]> {
    return [...this.fields.values()].map((field) => ({
      field,
      clientName: this.clients.get(field.clientId)?.name ?? '',
      zoneName: this.zones.get(field.zoneId)?.name ?? '',
    }));
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/domain/services src/domain/ports src/infrastructure tests/domain/services tests/infrastructure
git commit -m "feat: add field search matcher, FieldRepository port and in-memory adapter"
```

---

### Task 8: SearchFields use case (HU5)

**Files:**
- Create: `src/application/use-cases/search-fields.ts`
- Test: `tests/application/search-fields.test.ts`

**Interfaces:**
- Consumes: `FieldRepository` (Task 7), `fieldMatchesQuery`/`FieldSearchResult` (Task 7).
- Produces: `new SearchFields(fields: FieldRepository)` with `execute(query: string): Promise<FieldSearchResult[]>`.

- [ ] **Step 1: Write the failing test** — `tests/application/search-fields.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SearchFields } from '@/application/use-cases/search-fields';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';

function repoWithSeed(): InMemoryFieldRepository {
  const zones = new Map([
    ['z1', new Zone('z1', 'Quiroga')],
    ['z2', new Zone('z2', 'Bellocq')],
  ]);
  const clients = new Map([
    ['c1', new Client('c1', 'Martinez')],
    ['c2', new Client('c2', 'Perez')],
  ]);
  const fields = [
    new Field({ id: 'f1', name: 'Centenario', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'La Esperanza', clientId: 'c2', zoneId: 'z2' }),
  ];
  return new InMemoryFieldRepository(zones, clients, fields);
}

describe('SearchFields', () => {
  it('finds by a partial field name', async () => {
    const results = await new SearchFields(repoWithSeed()).execute('esper');
    expect(results.map((r) => r.field.id)).toEqual(['f2']);
  });
  it('finds by zone name', async () => {
    const results = await new SearchFields(repoWithSeed()).execute('quiroga');
    expect(results.map((r) => r.field.id)).toEqual(['f1']);
  });
  it('returns all results on an empty query', async () => {
    expect(await new SearchFields(repoWithSeed()).execute('')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/application/use-cases/search-fields`.

- [ ] **Step 3: Create `src/application/use-cases/search-fields.ts`**

```typescript
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import { fieldMatchesQuery, type FieldSearchResult } from '@/domain/services/field-search';

export class SearchFields {
  constructor(private readonly fields: FieldRepository) {}

  async execute(query: string): Promise<FieldSearchResult[]> {
    const all = await this.fields.listAllWithHierarchy();
    return all.filter((result) => fieldMatchesQuery(result, query));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/search-fields.ts tests/application/search-fields.test.ts
git commit -m "feat: add SearchFields use case (HU5)"
```

---

### Task 9: Clock/IdGenerator ports, test doubles, Visit & Reminder repositories

**Files:**
- Create: `src/domain/ports/outbound/clock.ts`
- Create: `src/domain/ports/outbound/id-generator.ts`
- Create: `src/domain/ports/outbound/visit-repository.ts`
- Create: `src/domain/ports/outbound/reminder-repository.ts`
- Create: `src/infrastructure/persistence/in-memory/in-memory-visit-repository.ts`
- Create: `src/infrastructure/persistence/in-memory/in-memory-reminder-repository.ts`
- Create: `tests/support/fixed-clock.ts`
- Create: `tests/support/incrementing-id-generator.ts`
- Test: `tests/infrastructure/in-memory-repositories.test.ts`

**Interfaces:**
- Consumes: `Visit`/`VisitStatus` (Task 5), `Reminder` (Task 6), ids (Task 2), `isSameCalendarDay` (Task 2).
- Produces:
  - `interface Clock { now(): Date }`
  - `interface IdGenerator { next(): string }`
  - `interface VisitRepository { save(visit: Visit): Promise<void>; findById(id: VisitId): Promise<Visit | null>; findActiveByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null>; listByField(fieldId: FieldId): Promise<Visit[]> }`
  - `interface ReminderRepository { save(reminder: Reminder): Promise<void>; findPendingByField(fieldId: FieldId): Promise<Reminder[]> }`
  - `new FixedClock(current: Date)` with `now()` and `set(date: Date)`.
  - `new IncrementingIdGenerator(prefix?: string)` with `next()` → `"${prefix}-${n}"`.
  - `new InMemoryVisitRepository()`, `new InMemoryReminderRepository()`.

- [ ] **Step 1: Create `src/domain/ports/outbound/clock.ts`**

```typescript
export interface Clock {
  now(): Date;
}
```

- [ ] **Step 2: Create `src/domain/ports/outbound/id-generator.ts`**

```typescript
export interface IdGenerator {
  next(): string;
}
```

- [ ] **Step 3: Create `src/domain/ports/outbound/visit-repository.ts`**

```typescript
import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';

export interface VisitRepository {
  save(visit: Visit): Promise<void>;
  findById(id: VisitId): Promise<Visit | null>;
  findActiveByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null>;
  listByField(fieldId: FieldId): Promise<Visit[]>;
}
```

- [ ] **Step 4: Create `src/domain/ports/outbound/reminder-repository.ts`**

```typescript
import type { Reminder } from '@/domain/entities/reminder';
import type { FieldId } from '@/domain/shared/ids';

export interface ReminderRepository {
  save(reminder: Reminder): Promise<void>;
  findPendingByField(fieldId: FieldId): Promise<Reminder[]>;
}
```

- [ ] **Step 5: Create the test doubles**

`tests/support/fixed-clock.ts`:

```typescript
import type { Clock } from '@/domain/ports/outbound/clock';

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  set(date: Date): void {
    this.current = date;
  }
}
```

`tests/support/incrementing-id-generator.ts`:

```typescript
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';

export class IncrementingIdGenerator implements IdGenerator {
  private n = 0;

  constructor(private readonly prefix = 'id') {}

  next(): string {
    this.n += 1;
    return `${this.prefix}-${this.n}`;
  }
}
```

- [ ] **Step 6: Write the failing test** — `tests/infrastructure/in-memory-repositories.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { Visit, type VisitStatus } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';

describe('FixedClock', () => {
  it('returns the configured instant and can be advanced', () => {
    const clock = new FixedClock(new Date('2026-07-27T10:00:00Z'));
    expect(clock.now().toISOString()).toBe('2026-07-27T10:00:00.000Z');
    clock.set(new Date('2026-07-28T10:00:00Z'));
    expect(clock.now().toISOString()).toBe('2026-07-28T10:00:00.000Z');
  });
});

describe('IncrementingIdGenerator', () => {
  it('produces unique sequential ids', () => {
    const gen = new IncrementingIdGenerator('v');
    expect([gen.next(), gen.next()]).toEqual(['v-1', 'v-2']);
  });
});

describe('InMemoryVisitRepository', () => {
  const day = new Date('2026-07-27T10:00:00Z');
  const visit = (id: string, status: VisitStatus = 'ACTIVE') =>
    new Visit({ id, fieldId: 'f1', visitDate: day, createdAt: day, status });

  it('finds an active visit on the same calendar day regardless of time', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit('v1'));
    const found = await repo.findActiveByFieldOnDay('f1', new Date('2026-07-27T23:00:00Z'));
    expect(found?.id).toBe('v1');
  });
  it('ignores cancelled visits for the day check', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit('v1', 'CANCELLED'));
    expect(await repo.findActiveByFieldOnDay('f1', day)).toBeNull();
  });
  it('lists visits by field', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit('v1'));
    expect(await repo.listByField('f1')).toHaveLength(1);
  });
});

describe('InMemoryReminderRepository', () => {
  it('returns only pending reminders for the field', async () => {
    const repo = new InMemoryReminderRepository();
    await repo.save(new Reminder({ id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: new Date('2026-08-03T10:00:00Z') }));
    const cancelled = new Reminder({ id: 'r2', visitId: 'v2', fieldId: 'f1', remindAt: new Date('2026-08-04T10:00:00Z') });
    cancelled.cancel();
    await repo.save(cancelled);
    const pending = await repo.findPendingByField('f1');
    expect(pending.map((r) => r.id)).toEqual(['r1']);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve the in-memory Visit/Reminder repositories.

- [ ] **Step 8: Create `src/infrastructure/persistence/in-memory/in-memory-visit-repository.ts`**

```typescript
import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import { isSameCalendarDay } from '@/domain/shared/date-utils';

export class InMemoryVisitRepository implements VisitRepository {
  private readonly visits = new Map<VisitId, Visit>();

  async save(visit: Visit): Promise<void> {
    this.visits.set(visit.id, visit);
  }

  async findById(id: VisitId): Promise<Visit | null> {
    return this.visits.get(id) ?? null;
  }

  async findActiveByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null> {
    for (const visit of this.visits.values()) {
      if (
        visit.fieldId === fieldId &&
        visit.status === 'ACTIVE' &&
        isSameCalendarDay(visit.visitDate, day)
      ) {
        return visit;
      }
    }
    return null;
  }

  async listByField(fieldId: FieldId): Promise<Visit[]> {
    return [...this.visits.values()].filter((visit) => visit.fieldId === fieldId);
  }
}
```

- [ ] **Step 9: Create `src/infrastructure/persistence/in-memory/in-memory-reminder-repository.ts`**

```typescript
import type { Reminder } from '@/domain/entities/reminder';
import type { ReminderId, FieldId } from '@/domain/shared/ids';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';

export class InMemoryReminderRepository implements ReminderRepository {
  private readonly reminders = new Map<ReminderId, Reminder>();

  async save(reminder: Reminder): Promise<void> {
    this.reminders.set(reminder.id, reminder);
  }

  async findPendingByField(fieldId: FieldId): Promise<Reminder[]> {
    return [...this.reminders.values()].filter(
      (reminder) => reminder.fieldId === fieldId && reminder.status === 'PENDING',
    );
  }
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/domain/ports/outbound src/infrastructure/persistence/in-memory tests/support tests/infrastructure/in-memory-repositories.test.ts
git commit -m "feat: add Clock/IdGenerator ports, test doubles and Visit/Reminder repositories"
```

---

### Task 10: RecordVisit use case — happy paths (HU1 + HU2)

**Files:**
- Create: `src/application/use-cases/record-visit.ts`
- Create: `tests/support/record-visit-harness.ts`
- Test: `tests/application/record-visit.happy.test.ts`

**Interfaces:**
- Consumes: `FieldRepository`, `VisitRepository`, `ReminderRepository`, `Clock`, `IdGenerator` (Tasks 7 & 9); `Visit`/`FollowUp` (Task 5), `Reminder` (Task 6), `VisitInterval` (Task 3); `addDays`/`daysBetween` (Task 2); errors (Task 2).
- Produces:
  - `type FollowUpInput = { kind: 'interval'; days: number; reminderLeadDays?: number } | { kind: 'date'; date: Date; reminderLeadDays?: number } | { kind: 'none' }`
  - `interface RecordVisitInput { fieldId: FieldId; visitDate: Date; notes?: string; followUp: FollowUpInput }`
  - `interface RecordVisitResult { visitId: VisitId; reminderId?: ReminderId }`
  - `new RecordVisit(fields, visits, reminders, clock, ids)` with `execute(input): Promise<RecordVisitResult>`.
  - `makeRecordVisitHarness(now?: Date)` returning `{ uc, fields, visits, reminders, clock, ids }`, seeded with one field `f1` in zone `z1` / client `c1`.

**Behavior specification (implemented here; edge rejections are covered in Task 11):**
1. Resolve `now = clock.now()`.
2. `field = fields.findById(input.fieldId)`; if missing → `FieldNotFound`.
3. If `input.visitDate > now` → `FutureVisitDate`.
4. If an ACTIVE visit already exists for the field on `input.visitDate`'s day → `DuplicateVisitForDay`.
5. Resolve the follow-up:
   - `kind: 'interval'` → `nextVisitDate = addDays(now, days)`, `interval = VisitInterval.ofDays(days)`.
   - `kind: 'date'` → `nextVisitDate = date`, `interval = VisitInterval.ofDays(daysBetween(now, date))` (a today/past date yields `days <= 0` → `InvalidVisitInterval`).
   - `kind: 'none'` → no follow-up.
6. Create and save the `Visit` (`ACTIVE`, `createdAt = now`).
7. **Always** cancel every currently PENDING reminder for the field and save them (recording any visit supersedes prior pending reminders).
8. If there is a follow-up, create and save a `Reminder` with `remindAt = addDays(nextVisitDate, -leadDays)` (`leadDays` defaults to `0`); return its id.

- [ ] **Step 1: Create the shared harness** — `tests/support/record-visit-harness.ts`

```typescript
import { RecordVisit } from '@/application/use-cases/record-visit';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { FixedClock } from './fixed-clock';
import { IncrementingIdGenerator } from './incrementing-id-generator';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';

export function makeRecordVisitHarness(now = new Date('2026-07-27T10:00:00Z')) {
  const zones = new Map([['z1', new Zone('z1', 'Quiroga')]]);
  const clients = new Map([['c1', new Client('c1', 'Martinez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'Centenario', clientId: 'c1', zoneId: 'z1' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const reminders = new InMemoryReminderRepository();
  const clock = new FixedClock(now);
  const ids = new IncrementingIdGenerator('id');
  const uc = new RecordVisit(fields, visits, reminders, clock, ids);
  return { uc, fields, visits, reminders, clock, ids };
}
```

- [ ] **Step 2: Write the failing test** — `tests/application/record-visit.happy.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { makeRecordVisitHarness } from '../support/record-visit-harness';

describe('RecordVisit — happy paths', () => {
  it('records a visit with no follow-up and creates no reminder', async () => {
    const { uc, visits, reminders } = makeRecordVisitHarness();
    const res = await uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      notes: 'ok',
      followUp: { kind: 'none' },
    });
    const saved = await visits.findById(res.visitId);
    expect(saved?.status).toBe('ACTIVE');
    expect(saved?.notes).toBe('ok');
    expect(saved?.followUp).toBeUndefined();
    expect(res.reminderId).toBeUndefined();
    expect(await reminders.findPendingByField('f1')).toHaveLength(0);
  });

  it('records a 7-day interval and schedules a reminder on the due date', async () => {
    const { uc, visits, reminders } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    const res = await uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      followUp: { kind: 'interval', days: 7 },
    });
    const saved = await visits.findById(res.visitId);
    expect(saved?.followUp?.interval.days).toBe(7);
    expect(saved?.followUp?.nextVisitDate.toISOString()).toBe('2026-08-03T10:00:00.000Z');
    const pending = await reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].remindAt.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });

  it('anchors the next visit to now, not to a retroactive visit date', async () => {
    const { uc, visits } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    const res = await uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-20T09:00:00Z'),
      followUp: { kind: 'interval', days: 7 },
    });
    const saved = await visits.findById(res.visitId);
    expect(saved?.followUp?.nextVisitDate.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });

  it('applies a reminder lead so it fires before the due date', async () => {
    const { uc, reminders } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      followUp: { kind: 'interval', days: 7, reminderLeadDays: 3 },
    });
    const pending = await reminders.findPendingByField('f1');
    expect(pending[0].remindAt.toISOString()).toBe('2026-07-31T10:00:00.000Z');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/application/use-cases/record-visit`.

- [ ] **Step 4: Create `src/application/use-cases/record-visit.ts`**

```typescript
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { FieldId, VisitId, ReminderId } from '@/domain/shared/ids';
import { Visit, type FollowUp } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { addDays, daysBetween } from '@/domain/shared/date-utils';
import { FieldNotFound, FutureVisitDate, DuplicateVisitForDay } from '@/domain/shared/errors';

export type FollowUpInput =
  | { kind: 'interval'; days: number; reminderLeadDays?: number }
  | { kind: 'date'; date: Date; reminderLeadDays?: number }
  | { kind: 'none' };

export interface RecordVisitInput {
  fieldId: FieldId;
  visitDate: Date;
  notes?: string;
  followUp: FollowUpInput;
}

export interface RecordVisitResult {
  visitId: VisitId;
  reminderId?: ReminderId;
}

export class RecordVisit {
  constructor(
    private readonly fields: FieldRepository,
    private readonly visits: VisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RecordVisitInput): Promise<RecordVisitResult> {
    const now = this.clock.now();

    const field = await this.fields.findById(input.fieldId);
    if (!field) throw new FieldNotFound(`unknown field ${input.fieldId}`);

    if (input.visitDate.getTime() > now.getTime()) {
      throw new FutureVisitDate('visit date cannot be in the future');
    }

    const clash = await this.visits.findActiveByFieldOnDay(input.fieldId, input.visitDate);
    if (clash) throw new DuplicateVisitForDay(`field ${input.fieldId} already has a visit that day`);

    const followUp = this.resolveFollowUp(input.followUp, now);

    const visit = new Visit({
      id: this.ids.next(),
      fieldId: input.fieldId,
      visitDate: input.visitDate,
      createdAt: now,
      notes: input.notes,
      followUp,
    });
    await this.visits.save(visit);

    // Recording any visit supersedes prior pending reminders for the field.
    const pending = await this.reminders.findPendingByField(input.fieldId);
    for (const reminder of pending) {
      reminder.cancel();
      await this.reminders.save(reminder);
    }

    if (!followUp) return { visitId: visit.id };

    const leadDays = input.followUp.kind === 'none' ? 0 : input.followUp.reminderLeadDays ?? 0;
    const reminder = new Reminder({
      id: this.ids.next(),
      visitId: visit.id,
      fieldId: input.fieldId,
      remindAt: addDays(followUp.nextVisitDate, -leadDays),
    });
    await this.reminders.save(reminder);

    return { visitId: visit.id, reminderId: reminder.id };
  }

  private resolveFollowUp(input: FollowUpInput, now: Date): FollowUp | undefined {
    if (input.kind === 'interval') {
      return { nextVisitDate: addDays(now, input.days), interval: VisitInterval.ofDays(input.days) };
    }
    if (input.kind === 'date') {
      return { nextVisitDate: input.date, interval: VisitInterval.ofDays(daysBetween(now, input.date)) };
    }
    return undefined;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/record-visit.ts tests/support/record-visit-harness.ts tests/application/record-visit.happy.test.ts
git commit -m "feat: add RecordVisit use case happy paths (HU1 + HU2)"
```

---

### Task 11: RecordVisit use case — rules and edge cases

**Files:**
- Test: `tests/application/record-visit.rules.test.ts`

**Interfaces:**
- Consumes: `makeRecordVisitHarness` (Task 10); errors `FutureVisitDate`, `DuplicateVisitForDay`, `FieldNotFound`, `InvalidVisitInterval` (Task 2).
- Produces: nothing new — this task hardens `RecordVisit` behavior already implemented in Task 10. No production code should change; if a test fails, fix `record-visit.ts` minimally.

- [ ] **Step 1: Write the failing test** — `tests/application/record-visit.rules.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { makeRecordVisitHarness } from '../support/record-visit-harness';
import {
  FutureVisitDate,
  DuplicateVisitForDay,
  FieldNotFound,
  InvalidVisitInterval,
} from '@/domain/shared/errors';

describe('RecordVisit — rules and edges', () => {
  it('rejects a future visit date', async () => {
    const { uc } = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await expect(
      uc.execute({ fieldId: 'f1', visitDate: new Date('2026-07-28T10:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toThrow(FutureVisitDate);
  });

  it('rejects a second active visit on the same day', async () => {
    const { uc } = makeRecordVisitHarness(new Date('2026-07-27T20:00:00Z'));
    await uc.execute({ fieldId: 'f1', visitDate: new Date('2026-07-27T09:00:00Z'), followUp: { kind: 'none' } });
    await expect(
      uc.execute({ fieldId: 'f1', visitDate: new Date('2026-07-27T15:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toThrow(DuplicateVisitForDay);
  });

  it('rejects recording against an unknown field', async () => {
    const { uc } = makeRecordVisitHarness();
    await expect(
      uc.execute({ fieldId: 'ghost', visitDate: new Date('2026-07-27T10:00:00Z'), followUp: { kind: 'none' } }),
    ).rejects.toThrow(FieldNotFound);
  });

  it('cancels the previous pending reminder when a new visit is recorded', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await h.uc.execute({ fieldId: 'f1', visitDate: new Date('2026-07-27T10:00:00Z'), followUp: { kind: 'interval', days: 7 } });
    expect(await h.reminders.findPendingByField('f1')).toHaveLength(1);

    h.clock.set(new Date('2026-07-28T10:00:00Z'));
    await h.uc.execute({ fieldId: 'f1', visitDate: new Date('2026-07-28T10:00:00Z'), followUp: { kind: 'interval', days: 10 } });

    const pending = await h.reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].remindAt.toISOString()).toBe('2026-08-07T10:00:00.000Z');
  });

  it('records a manual next-visit date and derives the interval from today', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    const res = await h.uc.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      followUp: { kind: 'date', date: new Date('2026-08-05T10:00:00Z') },
    });
    const saved = await h.visits.findById(res.visitId);
    expect(saved?.followUp?.nextVisitDate.toISOString()).toBe('2026-08-05T10:00:00.000Z');
    expect(saved?.followUp?.interval.days).toBe(9);
  });

  it('rejects a manual next-visit date that is today or in the past', async () => {
    const h = makeRecordVisitHarness(new Date('2026-07-27T10:00:00Z'));
    await expect(
      h.uc.execute({
        fieldId: 'f1',
        visitDate: new Date('2026-07-27T10:00:00Z'),
        followUp: { kind: 'date', date: new Date('2026-07-27T20:00:00Z') },
      }),
    ).rejects.toThrow(InvalidVisitInterval);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all rules already implemented in Task 10). If any case fails, adjust `src/application/use-cases/record-visit.ts` minimally to satisfy it, then re-run.

- [ ] **Step 3: Full typecheck + suite**

Run: `npm run typecheck && npm test`
Expected: no type errors; all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/application/record-visit.rules.test.ts src/application/use-cases/record-visit.ts
git commit -m "test: cover RecordVisit rules (future date, same-day, supersede reminder, manual date)"
```

---

## Self-Review

**Spec coverage:**
- HU5 (search by field/client/zone, partial match, full hierarchy in results) → Tasks 7 & 8. ✔
- HU1 (record visit: date default+editable/retroactive, free-text notes, optional follow-up) → Tasks 5, 10, 11. ✔
- HU2 (interval selection saved with the visit; quick 7/10/15 or manual number/date) → `FollowUpInput` in Task 10; interval stored on `Visit.followUp`. ✔ (No `Settings`/`ConfigureVisitIntervals` port — deliberately dropped per decision.)
- Reminder created (not dispatched) with `remindAt = nextVisitDate − reminderLeadDays` → Task 10. ✔
- "Recording a visit supersedes prior pending reminders" → Tasks 10 & 11. ✔
- Temporal model (nextVisitDate anchored to `now`; three distinct concepts nextVisitDate / intervalDays / remindAt) → Tasks 10 & 11. ✔
- Invariants split (constructor vs use case) → Tasks 3–6 (constructor) and Task 10 (Clock/collection rules). ✔
- Determinism via `Clock` + in-memory repos only → Tasks 9, 10. ✔
- No dose data → no such field defined anywhere; global constraint. ✔
- Explicitly deferred: urgency/dashboard (Etapa 2), dispatch/notifications (Etapa 3), cancel/edit/catalog CRUD (Etapa 4), sync (Etapa 5), IndexedDB+UI (Etapa 1b). Documented in Global Constraints.

**Placeholder scan:** none — every step ships real code or a concrete command.

**Type consistency:** `FieldSearchResult`, `FollowUp`, `FollowUpInput`, `RecordVisitInput`/`RecordVisitResult`, repository method names (`listAllWithHierarchy`, `findActiveByFieldOnDay`, `findPendingByField`), and test-double APIs (`FixedClock.set`, `IncrementingIdGenerator.next`) are defined once and referenced identically across tasks.
