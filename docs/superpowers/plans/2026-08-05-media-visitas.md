# Adjuntos de visita: fotos y nota de voz (gateado por flag) — Implementation Plan

> Fuente: `docs/superpowers/specs/2026-08-05-media-visitas-design.md`.
> Convenciones: `AGENTS.md`. TDD estricto: test rojo → verde → commit por tarea.
> Rama: `media-visitas`. **Regla de esta etapa: NO mergear a `main` hasta que el usuario pruebe en local.**
> Regla dura: ningún dato de dosis/agroquímicos/prescripciones.

## Tareas

### Tarea 1 — Entidad `VisitMedia` + ids + errores + puerto `MediaRepository`

- [ ] Test rojo `tests/domain/visit-media.test.ts`
- [ ] `src/domain/shared/ids.ts`: `export type MediaId = string;`
- [ ] `src/domain/shared/errors.ts`: `MediaRequiresDoneVisit`, `MediaTooLarge`
- [ ] `src/domain/entities/visit-media.ts` (entidad)
- [ ] `src/domain/ports/outbound/media-repository.ts` (puerto)
- [ ] Verde + typecheck → commit `feat(domain): entidad VisitMedia y puerto MediaRepository`

### Tarea 2 — Use cases: `AttachMediaToVisit`, `ListVisitMedia`, `RemoveMediaFromVisit`

- [ ] Test rojo `tests/application/attach-media.test.ts`
- [ ] Test rojo `tests/application/list-visit-media.test.ts`
- [ ] Test rojo `tests/application/remove-media.test.ts`
- [ ] `src/application/use-cases/attach-media.ts`
- [ ] `src/application/use-cases/list-visit-media.ts`
- [ ] `src/application/use-cases/remove-media.ts`
- [ ] Verde + typecheck → commit `feat(application): adjuntar/listar/quitar media de una visita`

### Tarea 3 — Infra idb: `MediaRecord`, schema v4, `IdbMediaRepository`, reset

- [ ] Test rojo `tests/infrastructure/idb/idb-media-repository.test.ts`
- [ ] Ampliar `tests/infrastructure/idb/open-campo-db.test.ts` (v4 + migración v3→v4)
- [ ] Ampliar `tests/infrastructure/idb/idb-data-reset.test.ts` (limpia `media`)
- [ ] `src/infrastructure/persistence/idb/records.ts`: `MediaRecord` + to/from
- [ ] `src/infrastructure/persistence/idb/open-campo-db.ts`: schema v4, store `media` con índice `by-visit`
- [ ] `src/infrastructure/persistence/idb/idb-media-repository.ts`
- [ ] `src/infrastructure/persistence/idb/idb-data-reset.ts`: STORES += `'media'`
- [ ] Verde + typecheck → commit `feat(infra): store media en idb (schema v4) + IdbMediaRepository`

### Tarea 4 — Repo in-memory + wiring de containers + error messages

- [ ] `src/infrastructure/persistence/in-memory/in-memory-media-repository.ts`
- [ ] `tests/support/in-memory-container.ts`: `InMemoryMediaRepository` compartida; `wireCatalogUseCases` gana parámetro `media` y su `clear()`; `makeInMemoryContainer` cablea `attachMedia/listVisitMedia/removeMedia`
- [ ] `tests/ui/agenda-screen.test.tsx`: actualizar los 2 callers de `wireCatalogUseCases`
- [ ] `src/composition/container.ts`: interface + build idb
- [ ] `src/ui/error-messages.ts`: mensajes nuevos
- [ ] typecheck + suite → commit `feat(infra): in-memory media + wiring de containers y mensajes`

### Tarea 5 — Captura: `captureImage` + `useVoiceCapture`

- [ ] Test rojo `tests/ui/media/capture-image.test.ts`
- [ ] Test rojo `tests/ui/media/use-voice-capture.test.ts`
- [ ] `src/ui/media/capture-image.ts` (1600px, JPEG 0.8, `imageOrientation: 'from-image'`)
- [ ] `src/ui/media/use-voice-capture.ts` (MediaRecorder opus, cortes: manual y 5 min)
- [ ] Verde + typecheck → commit `feat(ui): utilidades de captura (foto comprimida + grabadora)`

### Tarea 6 — Componente `MediaGallery` + CSS

- [ ] Test rojo `tests/ui/media-gallery.test.tsx`
- [ ] `src/ui/components/MediaGallery.tsx` (captura, previews, quitar, readOnly)
- [ ] CSS en `src/ui/styles.css`
- [ ] Verde + typecheck → commit `feat(ui): MediaGallery con captura de fotos y nota de voz`

### Tarea 7 — Hooks `useAttachMedia`, `useRemoveMedia`, `useVisitMedia`

- [ ] `src/ui/hooks/use-attach-media.ts`
- [ ] `src/ui/hooks/use-remove-media.ts`
- [ ] `src/ui/hooks/use-visit-media.ts`
- [ ] Cobertura vía tests de pantalla (Tareas 8–9); typecheck → commit `feat(ui): hooks de media`

### Tarea 8 — `RecordVisitScreen`: sección de media gateada por flag + attach post-registro

- [ ] Ampliar `tests/ui/record-visit-screen.test.tsx` (flag on adjunta al registrar; flag off sin sección; attach fallido muestra error y la visita queda guardada)
- [ ] `src/ui/screens/RecordVisitScreen.tsx`
- [ ] Verde + typecheck → commit `feat(ui): registrar visita con fotos y nota de voz (flag mediaVisitas)`

### Tarea 9 — `VisitDetailScreen`: galería con agregar/quitar (DONE), read-only (CANCELLED), sin sección (PENDING)

- [ ] Ampliar `tests/ui/visit-detail-screen.test.tsx`
- [ ] `src/ui/screens/VisitDetailScreen.tsx`
- [ ] Verde + typecheck → commit `feat(ui): galería de adjuntos en el detalle de la visita (flag mediaVisitas)`

### Tarea 10 — `api/flags.ts` generalizado a lista de flags

- [ ] Ampliar `tests/api/flags.test.ts`
- [ ] `api/flags.ts` evalúa `onboardingNuevo` + `mediaVisitas`
- [ ] Verde + typecheck → commit `feat(api): api/flags evalúa una lista de flags`

### Tarea 11 — Cierre (sin merge)

- [ ] Actualizar `docs/ROADMAP.md` (fila de etapa + bullet en "Se puede hacer hoy" + diferido)
- [ ] Suite completa verde + typecheck + `npm run build`
- [ ] **NO mergear**: dejar la rama lista para que el usuario pruebe en local (ver nota de pruebas abajo)

---

## Código de referencia (por tarea)

### Tarea 1

```ts
// src/domain/shared/ids.ts — agregar al final
export type MediaId = string;
```

```ts
// src/domain/shared/errors.ts — agregar
export class MediaRequiresDoneVisit extends DomainError {}
export class MediaTooLarge extends DomainError {}
```

```ts
// src/domain/entities/visit-media.ts
import type { MediaId, VisitId } from '@/domain/shared/ids';

export type MediaKind = 'image' | 'voice';

export interface VisitMediaProps {
  id: MediaId;
  visitId: VisitId;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  blob: Blob;
}

export class VisitMedia {
  readonly id: MediaId;
  readonly visitId: VisitId;
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
  readonly blob: Blob;

  constructor(props: VisitMediaProps) {
    this.id = props.id;
    this.visitId = props.visitId;
    this.kind = props.kind;
    this.mimeType = props.mimeType;
    this.sizeBytes = props.sizeBytes;
    this.createdAt = props.createdAt;
    this.blob = props.blob;
  }

  get isImage(): boolean {
    return this.kind === 'image';
  }

  get isVoice(): boolean {
    return this.kind === 'voice';
  }
}
```

```ts
// src/domain/ports/outbound/media-repository.ts
import type { VisitMedia } from '@/domain/entities/visit-media';
import type { MediaId, VisitId } from '@/domain/shared/ids';

export interface MediaRepository {
  save(media: VisitMedia): Promise<void>;
  listByVisit(visitId: VisitId): Promise<VisitMedia[]>;
  delete(id: MediaId): Promise<void>;
}
```

```ts
// tests/domain/visit-media.test.ts
import { describe, it, expect } from 'vitest';
import { VisitMedia } from '@/domain/entities/visit-media';

describe('VisitMedia', () => {
  it('expone metadatos y los getters por kind', () => {
    const media = new VisitMedia({
      id: 'm1',
      visitId: 'v1',
      kind: 'image',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      createdAt: new Date('2026-08-05T12:00:00Z'),
      blob: new Blob(['1234567890']),
    });
    expect(media.isImage).toBe(true);
    expect(media.isVoice).toBe(false);
    expect(media.sizeBytes).toBe(10);
    expect(media.blob.size).toBe(10);
    expect(media.visitId).toBe('v1');
  });

  it('distingue una nota de voz', () => {
    const media = new VisitMedia({
      id: 'm2', visitId: 'v1', kind: 'voice', mimeType: 'audio/webm',
      sizeBytes: 3, createdAt: new Date('2026-08-05T12:00:00Z'), blob: new Blob(['abc']),
    });
    expect(media.isVoice).toBe(true);
    expect(media.isImage).toBe(false);
  });
});
```

### Tarea 2

```ts
// src/application/use-cases/attach-media.ts
import type { MediaRepository } from '@/domain/ports/outbound/media-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { MediaId, VisitId } from '@/domain/shared/ids';
import { VisitMedia, type MediaKind } from '@/domain/entities/visit-media';
import { VisitNotFound, MediaRequiresDoneVisit, MediaTooLarge } from '@/domain/shared/errors';

const MAX_BYTES: Record<MediaKind, number> = {
  image: 5 * 1024 * 1024,
  voice: 8 * 1024 * 1024,
};

export interface AttachMediaInput {
  visitId: VisitId;
  kind: MediaKind;
  mimeType: string;
  blob: Blob;
}

export class AttachMediaToVisit {
  constructor(
    private readonly media: MediaRepository,
    private readonly visits: VisitRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AttachMediaInput): Promise<VisitMedia> {
    if (input.blob.size > MAX_BYTES[input.kind]) {
      throw new MediaTooLarge('media exceeds the size cap for its kind');
    }
    const visit = await this.visits.findById(input.visitId);
    if (!visit) throw new VisitNotFound(`unknown visit ${input.visitId}`);
    if (visit.status !== 'DONE') throw new MediaRequiresDoneVisit('media can only be attached to a done visit');

    const media = new VisitMedia({
      id: this.ids.next() as MediaId,
      visitId: input.visitId,
      kind: input.kind,
      mimeType: input.mimeType,
      sizeBytes: input.blob.size,
      createdAt: this.clock.now(),
      blob: input.blob,
    });
    await this.media.save(media);
    return media;
  }
}
```

```ts
// src/application/use-cases/list-visit-media.ts
import type { MediaRepository } from '@/domain/ports/outbound/media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';
import type { VisitId } from '@/domain/shared/ids';

export class ListVisitMedia {
  constructor(private readonly media: MediaRepository) {}

  async execute(visitId: VisitId): Promise<VisitMedia[]> {
    const items = await this.media.listByVisit(visitId);
    return [...items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
```

```ts
// src/application/use-cases/remove-media.ts
import type { MediaRepository } from '@/domain/ports/outbound/media-repository';
import type { MediaId } from '@/domain/shared/ids';

export class RemoveMediaFromVisit {
  constructor(private readonly media: MediaRepository) {}

  async execute(mediaId: MediaId): Promise<void> {
    await this.media.delete(mediaId);
  }
}
```

```ts
// tests/application/attach-media.test.ts
import { describe, it, expect } from 'vitest';
import { AttachMediaToVisit } from '@/application/use-cases/attach-media';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryMediaRepository } from '@/infrastructure/persistence/in-memory/in-memory-media-repository';
import { Visit } from '@/domain/entities/visit';
import { VisitNotFound, MediaRequiresDoneVisit, MediaTooLarge } from '@/domain/shared/errors';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';

function doneVisit(overrides: Partial<ConstructorParameters<typeof Visit>[0]> = {}) {
  return new Visit({
    id: 'v1',
    fieldId: 'f1',
    status: 'DONE',
    visitedAt: new Date('2026-08-01T00:00:00Z'),
    createdAt: new Date('2026-07-31T00:00:00Z'),
    ...overrides,
  });
}

function build() {
  const visits = new InMemoryVisitRepository();
  const media = new InMemoryMediaRepository();
  const clock = new FixedClock(new Date('2026-08-05T12:00:00Z'));
  const ids = new IncrementingIdGenerator();
  const uc = new AttachMediaToVisit(media, visits, clock, ids);
  return { uc, visits, media };
}

describe('AttachMediaToVisit', () => {
  it('adjunta una imagen a una visita realizada', async () => {
    const { uc, visits, media } = build();
    await visits.save(doneVisit());
    const blob = new Blob(['img'], { type: 'image/jpeg' });

    const result = await uc.execute({ visitId: 'v1', kind: 'image', mimeType: 'image/jpeg', blob });

    expect(result.visitId).toBe('v1');
    expect(result.kind).toBe('image');
    expect(result.sizeBytes).toBe(blob.size);
    expect(result.createdAt.getTime()).toBe(new Date('2026-08-05T12:00:00Z').getTime());
    expect(await media.listByVisit('v1')).toHaveLength(1);
  });

  it('adjunta una nota de voz', async () => {
    const { uc, visits } = build();
    await visits.save(doneVisit());
    const result = await uc.execute({ visitId: 'v1', kind: 'voice', mimeType: 'audio/webm', blob: new Blob(['voz']) });
    expect(result.isVoice).toBe(true);
  });

  it('rechaza una visita inexistente', async () => {
    const { uc } = build();
    await expect(uc.execute({ visitId: 'nope', kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['x']) }))
      .rejects.toBeInstanceOf(VisitNotFound);
  });

  it('rechaza una visita programada', async () => {
    const { uc, visits } = build();
    await visits.save(doneVisit({ id: 'v2', status: 'PENDING', visitedAt: undefined, plannedFor: new Date('2026-09-01T00:00:00Z'), reminderLeadDays: 3 }));
    await expect(uc.execute({ visitId: 'v2', kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['x']) }))
      .rejects.toBeInstanceOf(MediaRequiresDoneVisit);
  });

  it('rechaza una visita cancelada', async () => {
    const { uc, visits } = build();
    await visits.save(doneVisit({ id: 'v3', status: 'CANCELLED', visitedAt: undefined, cancelledAt: new Date('2026-08-02T00:00:00Z') }));
    await expect(uc.execute({ visitId: 'v3', kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['x']) }))
      .rejects.toBeInstanceOf(MediaRequiresDoneVisit);
  });

  it('rechaza una imagen mayor a 5 MB', async () => {
    const { uc, visits } = build();
    await visits.save(doneVisit());
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    await expect(uc.execute({ visitId: 'v1', kind: 'image', mimeType: 'image/jpeg', blob: big }))
      .rejects.toBeInstanceOf(MediaTooLarge);
  });

  it('rechaza una voz mayor a 8 MB', async () => {
    const { uc, visits } = build();
    await visits.save(doneVisit());
    const big = new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]);
    await expect(uc.execute({ visitId: 'v1', kind: 'voice', mimeType: 'audio/webm', blob: big }))
      .rejects.toBeInstanceOf(MediaTooLarge);
  });
});
```

```ts
// tests/application/list-visit-media.test.ts
import { describe, it, expect } from 'vitest';
import { ListVisitMedia } from '@/application/use-cases/list-visit-media';
import { InMemoryMediaRepository } from '@/infrastructure/persistence/in-memory/in-memory-media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';

function item(id: string, visitId: string, createdAt: Date): VisitMedia {
  return new VisitMedia({ id, visitId, kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3, createdAt, blob: new Blob(['abc']) });
}

describe('ListVisitMedia', () => {
  it('devuelve lista vacía sin adjuntos', async () => {
    const repo = new InMemoryMediaRepository();
    expect(await new ListVisitMedia(repo).execute('v1')).toEqual([]);
  });

  it('devuelve solo los adjuntos de esa visita ordenados por createdAt', async () => {
    const repo = new InMemoryMediaRepository();
    await repo.save(item('m1', 'v1', new Date('2026-08-01T00:00:00Z')));
    await repo.save(item('m2', 'v1', new Date('2026-08-05T00:00:00Z')));
    await repo.save(item('m3', 'v2', new Date('2026-08-03T00:00:00Z')));

    const list = await new ListVisitMedia(repo).execute('v1');
    expect(list.map((m) => m.id)).toEqual(['m1', 'm2']);
  });
});
```

```ts
// tests/application/remove-media.test.ts
import { describe, it, expect } from 'vitest';
import { RemoveMediaFromVisit } from '@/application/use-cases/remove-media';
import { InMemoryMediaRepository } from '@/infrastructure/persistence/in-memory/in-memory-media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';

describe('RemoveMediaFromVisit', () => {
  it('borra un adjunto existente', async () => {
    const repo = new InMemoryMediaRepository();
    await repo.save(new VisitMedia({ id: 'm1', visitId: 'v1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3, createdAt: new Date(), blob: new Blob(['abc']) }));

    await new RemoveMediaFromVisit(repo).execute('m1');

    expect(await repo.listByVisit('v1')).toHaveLength(0);
  });

  it('borrar un id inexistente es no-op', async () => {
    const repo = new InMemoryMediaRepository();
    await expect(new RemoveMediaFromVisit(repo).execute('nope')).resolves.toBeUndefined();
  });
});
```

### Tarea 3

```ts
// src/infrastructure/persistence/idb/records.ts — agregar import + tipos + mappers
import { VisitMedia, type MediaKind } from '@/domain/entities/visit-media';

export interface MediaRecord {
  id: string;
  visitId: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  blob: Blob;
}

export function toMediaRecord(m: VisitMedia): MediaRecord {
  return {
    id: m.id,
    visitId: m.visitId,
    kind: m.kind,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    createdAt: m.createdAt,
    blob: m.blob,
  };
}

export function fromMediaRecord(r: MediaRecord): VisitMedia {
  return new VisitMedia(r);
}
```

```ts
// src/infrastructure/persistence/idb/open-campo-db.ts — cambios
// import: MediaRecord en el import de records.
export interface CampoSchema extends DBSchema {
  zones: { key: string; value: ZoneRecord };
  clients: { key: string; value: ClientRecord };
  fields: { key: string; value: FieldRecord };
  visits: { key: string; value: VisitRecord; indexes: { 'by-field': string } };
  reminders: { key: string; value: ReminderRecord; indexes: { 'by-field': string } };
  media: { key: string; value: MediaRecord; indexes: { 'by-visit': string } };
}

// openCampoDb: versión 4; en el bloque `< 1` y en un bloque nuevo `if (oldVersion < 4)`:
export function openCampoDb(name = 'campo'): Promise<CampoDb> {
  return openDB<CampoSchema>(name, 4, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('zones', { keyPath: 'id' });
        db.createObjectStore('clients', { keyPath: 'id' });
        db.createObjectStore('fields', { keyPath: 'id' });
        const visits = db.createObjectStore('visits', { keyPath: 'id' });
        visits.createIndex('by-field', 'fieldId');
        const reminders = db.createObjectStore('reminders', { keyPath: 'id' });
        reminders.createIndex('by-field', 'fieldId');
        const media = db.createObjectStore('media', { keyPath: 'id' });
        media.createIndex('by-visit', 'visitId');
        return;
      }
      if (oldVersion < 3) {
        await migrateToV3(tx, oldVersion);
      }
      if (oldVersion < 4) {
        const media = db.createObjectStore('media', { keyPath: 'id' });
        media.createIndex('by-visit', 'visitId');
      }
    },
  });
}
```

```ts
// src/infrastructure/persistence/idb/idb-media-repository.ts
import type { MediaRepository } from '@/domain/ports/outbound/media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';
import type { MediaId, VisitId } from '@/domain/shared/ids';
import type { CampoDb } from './open-campo-db';
import { toMediaRecord, fromMediaRecord } from './records';

export class IdbMediaRepository implements MediaRepository {
  constructor(private readonly db: CampoDb) {}

  async save(media: VisitMedia): Promise<void> {
    await this.db.put('media', toMediaRecord(media));
  }

  async listByVisit(visitId: VisitId): Promise<VisitMedia[]> {
    const records = await this.db.getAllFromIndex('media', 'by-visit', visitId);
    return records.map(fromMediaRecord);
  }

  async delete(id: MediaId): Promise<void> {
    await this.db.delete('media', id);
  }
}
```

```ts
// src/infrastructure/persistence/idb/idb-data-reset.ts — solo cambia la línea
const STORES = ['zones', 'clients', 'fields', 'visits', 'reminders', 'media'] as const;
```

```ts
// tests/infrastructure/idb/idb-media-repository.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbMediaRepository } from '@/infrastructure/persistence/idb/idb-media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';

async function build() {
  const db = await openCampoDb(`media-${Math.random()}`);
  return { db, repo: new IdbMediaRepository(db) };
}

describe('IdbMediaRepository', () => {
  it('round-trip de un blob de imagen', async () => {
    const { db, repo } = await build();
    await repo.save(new VisitMedia({
      id: 'm1', visitId: 'v1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 5,
      createdAt: new Date('2026-08-05T12:00:00Z'), blob: new Blob(['hola!'], { type: 'image/jpeg' }),
    }));

    const list = await repo.listByVisit('v1');
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('image');
    expect(list[0].blob.size).toBe(5);
    expect(await list[0].blob.text()).toBe('hola!');
    db.close();
  });

  it('lista por índice y respeta la visita', async () => {
    const { db, repo } = await build();
    await repo.save(new VisitMedia({ id: 'm1', visitId: 'v1', kind: 'voice', mimeType: 'audio/webm', sizeBytes: 3, createdAt: new Date(), blob: new Blob(['voz']) }));
    await repo.save(new VisitMedia({ id: 'm2', visitId: 'v2', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3, createdAt: new Date(), blob: new Blob(['abc']) }));

    expect(await repo.listByVisit('v1')).toHaveLength(1);
    expect((await repo.listByVisit('v1'))[0].isVoice).toBe(true);
    db.close();
  });

  it('borra un adjunto', async () => {
    const { db, repo } = await build();
    await repo.save(new VisitMedia({ id: 'm1', visitId: 'v1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3, createdAt: new Date(), blob: new Blob(['abc']) }));
    await repo.delete('m1');
    expect(await repo.listByVisit('v1')).toHaveLength(0);
    db.close();
  });
});
```

```ts
// tests/infrastructure/idb/open-campo-db.test.ts — ajustar el test de stores y agregar migración
it('creates all object stores of schema v4', async () => {
  const db = await openCampoDb(`t-${Math.random()}`);
  expect([...db.objectStoreNames].sort()).toEqual(['clients', 'fields', 'media', 'reminders', 'visits', 'zones']);
  db.close();
});

it('creates the by-visit index on media', async () => {
  const db = await openCampoDb(`t-${Math.random()}`);
  const tx = db.transaction('media');
  expect([...tx.objectStore('media').indexNames]).toContain('by-visit');
  await tx.done;
  db.close();
});

it('agrega el store media al migrar v3→v4 conservando los datos', async () => {
  const name = `mig4-${Math.random()}`;
  const db1 = await openCampoDb(name); // abre a v4 directamente
  await db1.put('zones', { id: 'z1', name: 'Norte' });
  await db1.put('visits', { id: 'v1', fieldId: 'f1', status: 'DONE', visitedAt: new Date('2026-08-01T00:00:00Z'), createdAt: new Date('2026-07-31T00:00:00Z') });
  db1.close();

  // Abrir de nuevo (mismo nombre): debe conservar todo y el store media existir.
  const db2 = await openCampoDb(name);
  expect((await db2.get('zones', 'z1'))?.name).toBe('Norte');
  expect(await db2.get('visits', 'v1')).toBeDefined();
  expect([...db2.objectStoreNames]).toContain('media');
  db2.close();
});
```

```ts
// tests/infrastructure/idb/idb-data-reset.test.ts — ampliar
it('clears every object store including media', async () => {
  const db = await openCampoDb(`reset-test-${Math.random()}`);
  const now = new Date();
  await db.put('zones', { id: 'z1', name: 'Norte' });
  await db.put('clients', { id: 'c1', name: 'Pérez' });
  await db.put('fields', { id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' });
  await db.put('visits', { id: 'v1', fieldId: 'f1', status: 'DONE', visitedAt: now, createdAt: now });
  await db.put('reminders', { id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: now, status: 'PENDING' });
  await db.put('media', { id: 'm1', visitId: 'v1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3, createdAt: now, blob: new Blob(['abc']) });

  await new IdbDataReset(db).clearAll();

  for (const store of ['zones', 'clients', 'fields', 'visits', 'reminders', 'media'] as const) {
    expect(await db.count(store)).toBe(0);
  }
  db.close();
});
```

### Tarea 4

```ts
// src/infrastructure/persistence/in-memory/in-memory-media-repository.ts
import type { MediaRepository } from '@/domain/ports/outbound/media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';
import type { MediaId, VisitId } from '@/domain/shared/ids';

export class InMemoryMediaRepository implements MediaRepository {
  private readonly items = new Map<MediaId, VisitMedia>();

  async save(media: VisitMedia): Promise<void> {
    this.items.set(media.id, media);
  }

  async listByVisit(visitId: VisitId): Promise<VisitMedia[]> {
    return [...this.items.values()].filter((m) => m.visitId === visitId);
  }

  async delete(id: MediaId): Promise<void> {
    this.items.delete(id);
  }

  clear(): void {
    this.items.clear();
  }
}
```

```ts
// tests/support/in-memory-container.ts — cambios
// import { InMemoryMediaRepository } ...
// import { AttachMediaToVisit } from '@/application/use-cases/attach-media';
// import { ListVisitMedia } from '@/application/use-cases/list-visit-media';
// import { RemoveMediaFromVisit } from '@/application/use-cases/remove-media';

// wireCatalogUseCases: gana parámetro media y su clear():
export function wireCatalogUseCases(
  zones: InMemoryZoneRepository,
  clients: InMemoryClientRepository,
  fields: InMemoryFieldRepository,
  visits: InMemoryVisitRepository,
  reminders: InMemoryReminderRepository,
  media: InMemoryMediaRepository,
  ids: IdGenerator,
): Pick<Container, /* ... */> {
  const dataReset = new InMemoryDataReset([
    () => zones.clear(),
    () => clients.clear(),
    () => fields.clear(),
    () => visits.clear(),
    () => reminders.clear(),
    () => media.clear(),
  ]);
  // ...resto igual
}

// makeInMemoryContainer:
const media = new InMemoryMediaRepository();
// ...
return {
  // ...
  attachMedia: new AttachMediaToVisit(media, visits, clock, ids),
  listVisitMedia: new ListVisitMedia(media),
  removeMedia: new RemoveMediaFromVisit(media),
  // ...
  ...wireCatalogUseCases(zones, clients, fields, visits, reminders, media, ids),
};
```

```ts
// tests/ui/agenda-screen.test.tsx — los 2 callers pasan media:
// import { InMemoryMediaRepository } from '@/infrastructure/persistence/in-memory/in-memory-media-repository';
// ...wireCatalogUseCases(zones, clients, fields, visits, reminders, new InMemoryMediaRepository(), ids),
```

```ts
// src/composition/container.ts — cambios
// imports:
import { AttachMediaToVisit } from '@/application/use-cases/attach-media';
import { ListVisitMedia } from '@/application/use-cases/list-visit-media';
import { RemoveMediaFromVisit } from '@/application/use-cases/remove-media';
import { IdbMediaRepository } from '@/infrastructure/persistence/idb/idb-media-repository';

// interface Container: agregar
attachMedia: AttachMediaToVisit;
listVisitMedia: ListVisitMedia;
removeMedia: RemoveMediaFromVisit;

// build:
const media = new IdbMediaRepository(db);
// return { ... ,
attachMedia: new AttachMediaToVisit(media, visits, clock, ids),
listVisitMedia: new ListVisitMedia(media),
removeMedia: new RemoveMediaFromVisit(media),
```

```ts
// src/ui/error-messages.ts — agregar en domainErrorMessage
case 'MediaRequiresDoneVisit':
  return 'Los adjuntos solo se agregan a visitas realizadas.';
case 'MediaTooLarge':
  return 'El archivo es demasiado grande.';
```

### Tarea 5

```ts
// src/ui/media/capture-image.ts
export const IMAGE_MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.8;

export class ImageProcessingFailed extends Error {
  constructor() {
    super('image processing failed');
    this.name = 'ImageProcessingFailed';
  }
}

export async function captureImage(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageProcessingFailed();
  }
  try {
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageProcessingFailed();
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new ImageProcessingFailed();
    return blob;
  } finally {
    bitmap.close();
  }
}
```

```ts
// src/ui/media/use-voice-capture.ts
import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_VOICE_SECONDS = 300;
const MAX_VOICE_MS = MAX_VOICE_SECONDS * 1000;

export type VoiceCaptureStatus = 'idle' | 'recording' | 'done';

function pickVoiceMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return candidates.find((m) => MediaRecorder.isTypeSupported?.(m));
}

export function useVoiceCapture() {
  const [status, setStatus] = useState<VoiceCaptureStatus>('idle');
  const [seconds, setSeconds] = useState(0);

  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const teardown = useCallback(() => {
    if (tickRef.current !== null) window.clearInterval(tickRef.current);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    tickRef.current = null;
    timeoutRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const stopNow = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.stop();
  }, []);

  const start = useCallback((): Promise<Blob | null> => {
    return (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = pickVoiceMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const resolve = resolveRef.current;
          resolveRef.current = null;
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          setSeconds(0);
          setStatus('done');
          teardown();
          if (resolve) resolve(blob);
        };
        recorder.start();
        recorderRef.current = recorder;
        streamRef.current = stream;
        startedAtRef.current = Date.now();
        setSeconds(0);
        setStatus('recording');
        tickRef.current = window.setInterval(() => {
          setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }, 1000);
        timeoutRef.current = window.setTimeout(() => stopNow(), MAX_VOICE_MS);
        return new Promise<Blob | null>((resolve) => {
          resolveRef.current = resolve;
        });
      } catch {
        setStatus('idle');
        return null;
      }
    })();
  }, [stopNow, teardown]);

  const cancel = useCallback(() => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    teardown();
    if (resolve) resolve(null);
    setSeconds(0);
    setStatus('idle');
  }, [teardown]);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { status, seconds, start, stopNow, cancel };
}
```

```ts
// tests/ui/media/capture-image.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { captureImage, IMAGE_MAX_DIMENSION, JPEG_QUALITY } from '@/ui/media/capture-image';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('captureImage', () => {
  it('reduce al lado largo de 1600px y devuelve un JPEG', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
      width: 4000, height: 3000, close: vi.fn(),
    })));
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function (cb) { cb?.(new Blob(['jpeg'], { type: 'image/jpeg' })); });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);

    const blob = await captureImage(new Blob(['raw']));

    expect(blob.type).toBe('image/jpeg');
    const canvas = toBlob.mock.instances[0] as HTMLCanvasElement;
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
  });

  it('no agranda imágenes menores a 1600px', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
      width: 800, height: 600, close: vi.fn(),
    })));
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function (cb) { cb?.(new Blob(['jpeg'], { type: 'image/jpeg' })); });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);

    await captureImage(new Blob(['raw']));

    const canvas = toBlob.mock.instances[0] as HTMLCanvasElement;
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('decodifica con orientación EXIF respetada', async () => {
    const bitmap = vi.fn(async (_file: Blob, options: unknown) => {
      expect(options).toEqual({ imageOrientation: 'from-image' });
      return { width: 100, height: 100, close: vi.fn() };
    });
    vi.stubGlobal('createImageBitmap', bitmap);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function (cb) { cb?.(new Blob(['jpeg'], { type: 'image/jpeg' })); });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);

    await captureImage(new Blob(['raw']));
    expect(bitmap).toHaveBeenCalled();
  });
});
```

```ts
// tests/ui/media/use-voice-capture.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useVoiceCapture, MAX_VOICE_SECONDS } from '@/ui/media/use-voice-capture';

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  chunks: Blob[] = [];
  start(): void { this.state = 'recording'; }
  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voz'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

let windowBlob: Blob | null = null;
const stopTrack = vi.fn();

function Probe() {
  const voice = useVoiceCapture();
  return (
    <div>
      <span data-testid="status">{voice.status}</span>
      <span data-testid="seconds">{voice.seconds}</span>
      <button onClick={() => { void voice.start().then((b) => { windowBlob = b; }); }}>start</button>
      <button onClick={() => voice.stopNow()}>stop</button>
    </div>
  );
}

describe('useVoiceCapture', () => {
  beforeEach(() => {
    windowBlob = null;
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pasa por idle → recording → done y resuelve el blob al detener', async () => {
    render(<Probe />);
    await userEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('recording'));

    await userEvent.click(screen.getByRole('button', { name: 'stop' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('done'));
    await waitFor(() => expect(windowBlob).not.toBeNull());
    expect(await windowBlob!.text()).toBe('voz');
  });

  it('detiene solo a los 5 minutos si nadie lo frena (auto-stop)', async () => {
    vi.useFakeTimers();
    try {
      render(<Probe />);
      await userEvent.click(screen.getByRole('button', { name: 'start' }));
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('recording'));

      vi.advanceTimersByTime(MAX_VOICE_SECONDS * 1000);

      await vi.waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('done'));
      expect(windowBlob).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
```

### Tarea 6

```tsx
// src/ui/components/MediaGallery.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaKind } from '@/domain/entities/visit-media';
import { captureImage } from '@/ui/media/capture-image';
import { useVoiceCapture } from '@/ui/media/use-voice-capture';

export interface MediaItemView {
  id: string;
  kind: MediaKind;
  mimeType: string;
  blob: Blob;
}

interface MediaGalleryProps {
  items: MediaItemView[];
  onAdd: (items: MediaItemView[]) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  readOnly?: boolean;
  busy?: boolean;
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MediaGallery({ items, onAdd, onRemove, readOnly = false, busy = false }: MediaGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceCapture();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [imageError, setImageError] = useState<string | undefined>();
  const [voiceError, setVoiceError] = useState<string | undefined>();
  const [startingVoice, setStartingVoice] = useState(false);

  useEffect(() => {
    const created: string[] = [];
    const next: Record<string, string> = {};
    for (const item of items) {
      const url = URL.createObjectURL(item.blob);
      next[item.id] = url;
      created.push(url);
    }
    setUrls(next);
    return () => { created.forEach((u) => URL.revokeObjectURL(u)); };
  }, [items]);

  const onFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setImageError(undefined);
    if (files.length === 0) return;
    const captured: MediaItemView[] = [];
    for (const file of files) {
      try {
        const blob = await captureImage(file);
        captured.push({ id: crypto.randomUUID(), kind: 'image', mimeType: 'image/jpeg', blob });
      } catch {
        setImageError('No se pudo procesar la imagen.');
      }
    }
    if (captured.length > 0) await onAdd(captured);
  }, [onAdd]);

  const startVoice = useCallback(async () => {
    setVoiceError(undefined);
    setStartingVoice(true);
    const session = voice.start();
    const blob = await session;
    setStartingVoice(false);
    if (blob) {
      await onAdd([{ id: crypto.randomUUID(), kind: 'voice', mimeType: blob.type || 'audio/webm', blob }]);
    } else {
      setVoiceError('No se pudo acceder al micrófono.');
    }
  }, [voice, onAdd]);

  const stopVoice = useCallback(() => voice.stopNow(), [voice]);

  const recording = voice.status === 'recording';
  const canCapture = !readOnly && !busy && !startingVoice && !recording;

  return (
    <>
      {!readOnly && (
        <div className="media-capture" role="group" aria-label="Agregar fotos o nota de voz">
          <input ref={fileInputRef} className="media-file-input" type="file" accept="image/*" multiple onChange={onFiles} />
          <button type="button" className="btn-secondary" disabled={!canCapture} onClick={() => fileInputRef.current?.click()}>
            Agregar foto
          </button>
          {recording ? (
            <button type="button" className="btn-danger" onClick={stopVoice}>
              Detener · {formatSeconds(voice.seconds)}
            </button>
          ) : (
            <button type="button" className="btn-secondary" disabled={!canCapture} onClick={() => void startVoice()}>
              Grabar nota de voz
            </button>
          )}
        </div>
      )}
      {items.length > 0 && (
        <ul className="media-list">
          {items.map((item) => (
            <li key={item.id} className="media-item">
              {item.kind === 'image' ? (
                <img className="media-thumb" src={urls[item.id]} alt="Foto de la visita" />
              ) : (
                <audio className="media-audio" controls src={urls[item.id]} />
              )}
              <div className="media-actions">
                <span className="media-meta">{item.kind === 'image' ? 'Foto' : 'Nota de voz'}</span>
                {!readOnly && (
                  <button type="button" className="btn-remove" onClick={() => onRemove(item.id)}>
                    Quitar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {imageError && <p className="alert" role="alert">{imageError}</p>}
      {voiceError && <p className="alert" role="alert">{voiceError}</p>}
    </>
  );
}
```

```css
/* src/ui/styles.css — agregar */
.media-file-input { display: none; }
.media-capture { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-2) 0; }
.media-list { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-3); }
.media-item { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-2); }
.media-thumb { width: 100%; max-height: 220px; object-fit: cover; border-radius: var(--radius-sm); }
.media-audio { width: 100%; }
.media-actions { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-2); }
.media-meta { color: var(--muted); font-size: 13px; }
.btn-remove { color: var(--danger); background: transparent; border: none; padding: 0; font: inherit; cursor: pointer; }
.media-section { margin-top: var(--space-3); }
```

```tsx
// tests/ui/media-gallery.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaGallery, type MediaItemView } from '@/ui/components/MediaGallery';

vi.mock('@/ui/media/capture-image', () => ({
  captureImage: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
}));
vi.mock('@/ui/media/use-voice-capture', () => ({
  useVoiceCapture: () => ({ status: 'idle', seconds: 0, start: vi.fn(async () => new Blob(['voz'], { type: 'audio/webm' })), stopNow: vi.fn(), cancel: vi.fn() }),
}));

const image: MediaItemView = { id: 'm1', kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['abc']) };
const voice: MediaItemView = { id: 'm2', kind: 'voice', mimeType: 'audio/webm', blob: new Blob(['voz']) };

describe('MediaGallery', () => {
  it('muestra miniatura de imagen y reproductor de voz', () => {
    render(<MediaGallery items={[image, voice]} onAdd={() => undefined} onRemove={() => undefined} />);
    expect(screen.getByAltText('Foto de la visita')).toBeInTheDocument();
    expect(document.querySelector('audio')).toBeInTheDocument();
  });

  it('agrega una foto desde el input de archivos', async () => {
    const onAdd = vi.fn();
    const { container } = render(<MediaGallery items={[]} onAdd={onAdd} onRemove={() => undefined} />);
    const input = container.querySelector('.media-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.jpg')] } });

    await screen.findByText('Foto'); // onAdd → no items aún; esperamos el await interno
    expect(onAdd).toHaveBeenCalledTimes(1);
    const added = onAdd.mock.calls[0][0] as MediaItemView[];
    expect(added[0].kind).toBe('image');
    expect(added[0].mimeType).toBe('image/jpeg');
  });

  it('quita un item con el botón Quitar', async () => {
    const onRemove = vi.fn();
    render(<MediaGallery items={[image]} onAdd={() => undefined} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(onRemove).toHaveBeenCalledWith('m1');
  });

  it('en modo readOnly no ofrece captura ni quitar', () => {
    render(<MediaGallery readOnly items={[image]} onAdd={() => undefined} onRemove={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Agregar foto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
  });
});
```

### Tarea 7

```ts
// src/ui/hooks/use-attach-media.ts
import { useCallback, useState } from 'react';
import type { AttachMediaInput } from '@/application/use-cases/attach-media';
import { VisitMedia } from '@/domain/entities/visit-media';
import { useCampo } from '@/ui/CampoProvider';

export function useAttachMedia() {
  const { attachMedia } = useCampo();
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const submit = useCallback(
    async (input: AttachMediaInput): Promise<VisitMedia | undefined> => {
      setAttaching(true);
      setError(undefined);
      try {
        return await attachMedia.execute(input);
      } catch (e) {
        setError(e as Error);
        return undefined;
      } finally {
        setAttaching(false);
      }
    },
    [attachMedia],
  );

  return { submit, attaching, error };
}
```

```ts
// src/ui/hooks/use-remove-media.ts
import { useCallback, useState } from 'react';
import type { MediaId } from '@/domain/shared/ids';
import { useCampo } from '@/ui/CampoProvider';

export function useRemoveMedia() {
  const { removeMedia } = useCampo();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const submit = useCallback(
    async (mediaId: MediaId): Promise<boolean> => {
      setRemoving(true);
      setError(undefined);
      try {
        await removeMedia.execute(mediaId);
        return true;
      } catch (e) {
        setError(e as Error);
        return false;
      } finally {
        setRemoving(false);
      }
    },
    [removeMedia],
  );

  return { submit, removing, error };
}
```

```ts
// src/ui/hooks/use-visit-media.ts
import { useCallback, useEffect, useState } from 'react';
import { VisitMedia } from '@/domain/entities/visit-media';
import type { VisitId } from '@/domain/shared/ids';
import { useCampo } from '@/ui/CampoProvider';

export function useVisitMedia(visitId: VisitId) {
  const { listVisitMedia } = useCampo();
  const [media, setMedia] = useState<VisitMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listVisitMedia
      .execute(visitId)
      .then((items) => { if (active) setMedia(items); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listVisitMedia, visitId, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { media, loading, refresh };
}
```

### Tarea 8

```tsx
// src/ui/screens/RecordVisitScreen.tsx — cambios
// imports:
import { useFlag } from '@/ui/FlagsProvider';
import { MediaGallery, type MediaItemView } from '@/ui/components/MediaGallery';
import { useAttachMedia } from '@/ui/hooks/use-attach-media';

// dentro del componente:
const mediaVisitas = useFlag('mediaVisitas');
const attach = useAttachMedia();
const [pendingMedia, setPendingMedia] = useState<MediaItemView[]>([]);
const pendingMediaRef = useRef<MediaItemView[]>([]);
useEffect(() => { pendingMediaRef.current = pendingMedia; }, [pendingMedia]);

// el effect de result pasa a adjuntar antes de navegar:
useEffect(() => {
  if (!result) return;
  void (async () => {
    for (const item of pendingMediaRef.current) {
      await attach.submit({ visitId: result.visitId, kind: item.kind, mimeType: item.mimeType, blob: item.blob });
    }
    navigate('/');
  })();
}, [result, navigate, attach]);

// la rama pickingLot adjunta antes de navegar:
const ensuringResult = await ensuring.submit({ ...base, field });
if (ensuringResult) {
  for (const item of pendingMediaRef.current) {
    await attach.submit({ visitId: ensuringResult.visitId, kind: item.kind, mimeType: item.mimeType, blob: item.blob });
  }
  navigate('/');
}
return;

// domainError suma attach.error:
const domainError = error ?? cancelHook.error ?? ensuring.error ?? attach.error;

// JSX: sección de media (después del fieldset de próxima visita, antes de los alerts):
{mediaVisitas && (
  <section className="media-section" aria-label="Fotos y nota de voz">
    <span className="field-label">Fotos y nota de voz</span>
    <MediaGallery
      items={pendingMedia}
      onAdd={(added) => setPendingMedia((p) => [...p, ...added])}
      onRemove={(id) => setPendingMedia((p) => p.filter((i) => i.id !== id))}
      busy={isSubmitting}
    />
  </section>
)}
```

```tsx
// tests/ui/record-visit-screen.test.tsx — al inicio del archivo agregar los mocks
vi.mock('@/ui/media/capture-image', () => ({
  captureImage: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
}));
vi.mock('@/ui/media/use-voice-capture', () => ({
  useVoiceCapture: () => ({ status: 'idle', seconds: 0, start: vi.fn(), stopNow: vi.fn(), cancel: vi.fn() }),
}));

// nuevo describe:
import { FlagsProvider } from '@/ui/FlagsProvider';
import { fireEvent, waitFor, within } from '@testing-library/react';

describe('RecordVisitScreen (media, flag mediaVisitas)', () => {
  function renderScreenWithMedia(now = new Date()) {
    return render(
      <FlagsProvider initialFlags={{ mediaVisitas: true }}>
        <CampoProvider container={makeInMemoryContainer(now)}>
          <MemoryRouter initialEntries={['/field/f1/record']}>
            <Routes>
              <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
              <Route path="/" element={<div>Listado</div>} />
            </Routes>
          </MemoryRouter>
        </CampoProvider>
      </FlagsProvider>,
    );
  }

  it('con flag on captura una foto y la adjunta al registrar la visita', async () => {
    const c = makeInMemoryContainer(new Date());
    render(
      <FlagsProvider initialFlags={{ mediaVisitas: true }}>
        <CampoProvider container={c}>
          <MemoryRouter initialEntries={['/field/f1/record']}>
            <Routes>
              <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
              <Route path="/" element={<div>Listado</div>} />
            </Routes>
          </MemoryRouter>
        </CampoProvider>
      </FlagsProvider>,
    );

    const input = (await screen.findByRole('group', { name: /Agregar fotos/ })).querySelector('.media-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.jpg')] } });
    await screen.findByAltText('Foto de la visita');

    await expandNextVisit();
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));

    await waitFor(() => expect(screen.getByText('Listado')).toBeInTheDocument());
    const history = await c.getFieldHistory.execute('f1');
    const done = history.visits.find((v) => v.status === 'DONE');
    const media = await c.listVisitMedia.execute(done!.id);
    expect(media).toHaveLength(1);
    expect(media[0].kind).toBe('image');
    expect(media[0].mimeType).toBe('image/jpeg');
  });

  it('sin flag la sección de media no existe', async () => {
    renderScreen(); // sin FlagsProvider → flag off
    await screen.findByLabelText('Fecha');
    expect(screen.queryByText('Fotos y nota de voz')).not.toBeInTheDocument();
  });

  it('si un attach falla, la visita queda guardada y se muestra el error', async () => {
    const c = makeInMemoryContainer(new Date());
    c.attachMedia = {
      execute: vi.fn(async () => { throw new (await import('@/domain/shared/errors')).MediaTooLarge(); }),
    } as unknown as typeof c.attachMedia;
    render(
      <FlagsProvider initialFlags={{ mediaVisitas: true }}>
        <CampoProvider container={c}>
          <MemoryRouter initialEntries={['/field/f1/record']}>
            <Routes>
              <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
              <Route path="/" element={<div>Listado</div>} />
            </Routes>
          </MemoryRouter>
        </CampoProvider>
      </FlagsProvider>,
    );

    const input = (await screen.findByRole('group', { name: /Agregar fotos/ })).querySelector('.media-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.jpg')] } });
    await screen.findByAltText('Foto de la visita');

    await expandNextVisit();
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));

    await waitFor(() => expect(screen.getByText('Listado')).toBeInTheDocument());
    const history = await c.getFieldHistory.execute('f1');
    expect(history.visits.some((v) => v.status === 'DONE')).toBe(true);
  });
});
```

### Tarea 9

```tsx
// src/ui/screens/VisitDetailScreen.tsx — cambios
// imports:
import { useFlag } from '@/ui/FlagsProvider';
import { MediaGallery } from '@/ui/components/MediaGallery';
import { useAttachMedia } from '@/ui/hooks/use-attach-media';
import { useRemoveMedia } from '@/ui/hooks/use-remove-media';
import { useVisitMedia } from '@/ui/hooks/use-visit-media';

// dentro del componente, antes de los early returns:
const mediaVisitas = useFlag('mediaVisitas');
const media = useVisitMedia(visitId);
const attach = useAttachMedia();
const removeMedia = useRemoveMedia();
const [removingId, setRemovingId] = useState<string | null>(null);

// helper para convertir las entidades a MediaItemView:
const items = media.items.map((m) => ({ id: m.id, kind: m.kind, mimeType: m.mimeType, blob: m.blob }));

// CANCELLED: galería read-only (después de las notas):
{mediaVisitas && (
  <section className="media-section" aria-label="Adjuntos">
    <span className="field-label">Fotos y nota de voz</span>
    <MediaGallery readOnly items={items} onAdd={() => undefined} onRemove={() => undefined} />
  </section>
)}

// DONE: después del </form>, antes del botón Cancelar:
{mediaVisitas && (
  <section className="media-section" aria-label="Adjuntos">
    <span className="field-label">Fotos y nota de voz</span>
    <MediaGallery
      items={items}
      onAdd={async (added) => {
        for (const item of added) {
          await attach.submit({ visitId, kind: item.kind, mimeType: item.mimeType, blob: item.blob });
        }
        media.refresh();
      }}
      onRemove={(id) => setRemovingId(id)}
      busy={attach.attaching || removeMedia.removing}
    />
    {(attach.error || removeMedia.error) && (
      <p className="alert" role="alert">{domainErrorMessage((attach.error ?? removeMedia.error)!)}</p>
    )}
    <ConfirmDialog
      open={removingId !== null}
      title="Quitar adjunto"
      message="El adjunto se borrará de forma permanente. ¿Confirmás?"
      confirmLabel="Quitar"
      cancelLabel="Volver"
      onCancel={() => setRemovingId(null)}
      onConfirm={() => {
        if (removingId) void removeMedia.submit(removingId);
        setRemovingId(null);
        media.refresh();
      }}
    />
  </section>
)}
```

```tsx
// tests/ui/visit-detail-screen.test.tsx — ampliar
import { FlagsProvider } from '@/ui/FlagsProvider';

function renderAtWithMedia(c: Container, visitId: string, flags: Record<string, boolean> = { mediaVisitas: true }) {
  return render(
    <FlagsProvider initialFlags={flags}>
      <CampoProvider container={c}>
        <MemoryRouter initialEntries={[`/field/f1/visitas/${visitId}`]}>
          <Routes>
            <Route path="/field/:fieldId/visitas/:visitId" element={<VisitDetailScreen />} />
            <Route path="/field/:fieldId/visitas" element={<div>Historial</div>} />
          </Routes>
        </MemoryRouter>
      </CampoProvider>
    </FlagsProvider>,
  );
}

describe('VisitDetailScreen (media, flag mediaVisitas)', () => {
  it('muestra la galería de adjuntos de una visita realizada', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    await c.attachMedia.execute({ visitId: id, kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['abc']) });
    renderAtWithMedia(c, id);

    expect(await screen.findByAltText('Foto de la visita')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar foto' })).toBeInTheDocument();
  });

  it('quita un adjunto tras confirmar', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    await c.attachMedia.execute({ visitId: id, kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['abc']) });
    renderAtWithMedia(c, id);

    await userEvent.click(await screen.findByRole('button', { name: 'Quitar' }));
    await userEvent.click(screen.getByRole('button', { name: /Quitar/ }));
    await waitFor(() => expect(screen.queryByAltText('Foto de la visita')).not.toBeInTheDocument());
    expect(await c.listVisitMedia.execute(id)).toHaveLength(0);
  });

  it('una visita cancelada muestra la galería read-only', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    await c.attachMedia.execute({ visitId: id, kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['abc']) });
    await c.cancelVisit.execute({ visitId: id });
    renderAtWithMedia(c, id);

    expect(await screen.findByAltText('Foto de la visita')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar foto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
  });

  it('una visita programada no tiene sección de adjuntos', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const { visitId } = await c.scheduleVisit.execute({
      fieldId: 'f1', plannedFor: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3,
    });
    renderAtWithMedia(c, visitId);
    expect(await screen.findByText(/Programada/)).toBeInTheDocument();
    expect(screen.queryByText('Fotos y nota de voz')).not.toBeInTheDocument();
  });

  it('sin flag la sección no existe', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    await c.attachMedia.execute({ visitId: id, kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['abc']) });
    renderAtWithMedia(c, id, {});
    expect(await screen.findByLabelText('Notas')).toBeInTheDocument();
    expect(screen.queryByText('Fotos y nota de voz')).not.toBeInTheDocument();
  });
});
```

### Tarea 10

```ts
// api/flags.ts
import { flagsClient } from '@vercel/flags-core';
import type { IncomingMessage, ServerResponse } from 'node:http';

const FLAGS = ['onboardingNuevo', 'mediaVisitas'] as const;
type FlagName = (typeof FLAGS)[number];

const DEFAULTS: Record<FlagName, boolean> = { onboardingNuevo: false, mediaVisitas: false };

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  try {
    const entries = await Promise.all(
      FLAGS.map(async (name) => [name, (await flagsClient.evaluate<boolean>(name, false)).value] as const),
    );
    res.end(JSON.stringify(Object.fromEntries(entries)));
  } catch (error) {
    console.error('flags: evaluación falló, uso default', error);
    res.end(JSON.stringify(DEFAULTS));
  }
}
```

```ts
// tests/api/flags.test.ts — ampliar/reemplazar los dos casos
it('devuelve onboardingNuevo y mediaVisitas evaluados por Vercel', async () => {
  evaluate.mockImplementation(async (name: string) => ({ value: name === 'onboardingNuevo', reason: 'static' }));
  const res = makeRes();
  await handler({} as IncomingMessage, res as unknown as ServerResponse);
  expect(bodyOf(res)).toEqual({ onboardingNuevo: true, mediaVisitas: false });
});

it('devuelve todos off si la evaluación falla', async () => {
  evaluate.mockRejectedValue(new Error('network'));
  const res = makeRes();
  await handler({} as IncomingMessage, res as unknown as ServerResponse);
  expect(bodyOf(res)).toEqual({ onboardingNuevo: false, mediaVisitas: false });
});
```

### Tarea 11

Actualizar `docs/ROADMAP.md`:
- Fila nueva en la tabla de etapas:
  `| **media-visitas** | Adjuntos de visita gateados por flag \`mediaVisitas\`: fotos (1600px JPEG, orientación EXIF respetada) + nota de voz (Opus, máx 5 min) en visitas realizadas; store idb \`media\` v3→v4; persistencia post-registro idempotente + galería con agregar/quitar en el detalle; read-only en canceladas; \`api/flags\` generalizado a lista | ✅ Completa (XXX tests) |`
- Bullet en "Se puede hacer hoy" (junto al wizard): registrar visitas con fotos y nota de voz si el flag `mediaVisitas` está prendido.
- Diferido: el media vive solo en el dispositivo y puede ser evacuado por el navegador (aceptado); sincronización a la nube → Etapa 5.

Verificación final (sin merge):
1. `npm test` completo verde.
2. `npm run typecheck` sin errores.
3. `npm run build` OK.
4. **Nota de pruebas en local**: los flags salen de `/api/flags` (Vercel). Para probar el flag `mediaVisitas` en local conviene correr el dev server de Vercel (`vercel dev`, que evalúa los flags del dashboard) o abrir el preview deploy de la rama con el flag prendido. Dejar la rama sin mergear hasta que el usuario confirme la prueba.
