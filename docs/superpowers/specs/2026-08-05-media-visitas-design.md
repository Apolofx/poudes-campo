# Etapa — Adjuntos de visita: fotos y nota de voz (gateado por flag)

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Fecha: 2026-08-05.

## Contexto y alcance

Registrar una visita realizada hoy deja solo texto (notas). Un asesor que recorre lotes necesita
dejar **evidencia**: fotos del estado del lote y una nota de voz grabada ahí mismo. Esta etapa
agrega **adjuntos de visita (imágenes + nota de voz)** a las **visitas realizadas (DONE)**,
offline-first, comprimidos en cliente, **gateados por el feature flag de Vercel `mediaVisitas`**.
Se prende para probar y se apaga y todo vuelve a comportarse como hoy — mismo patrón de knob que
`onboardingNuevo`.

Regla dura vigente: ningún dato de dosis/agroquímicos/prescripciones. Esta etapa no agrega campos de
ese tipo. Tocar `src/domain` (entidad + puerto nuevos) y `src/application` (casos de uso nuevos) es
la **intención explícita** del usuario (regla 2 de AGENTS).

## Decisiones tomadas (brainstorming)

1. **Modelo único discriminado por `kind`.** Foto y voz son lo mismo a nivel de datos: **un blob
   binario + metadatos**. Una sola entidad `VisitMedia` con `kind: 'image' | 'voice'`, un solo
   object store `media` (índice por `visitId`), una sola migración idb (**v3→v4**). El dominio
   trata el `blob` como **payload opaco** (nunca lo lee); la diferencia real (comprimir imagen vs
   grabar audio) vive en el adaptador de captura, no en el modelo.
2. **Persistencia post-registro, idempotente.** El flujo de `RecordVisit` queda **intacto** (guarda
   la visita como hoy). Al confirmar "Registrar", la UI adjunta el media pendiente con
   `AttachMediaToVisit` por cada blob. Además se puede **agregar/quitar** adjuntos desde el detalle
   de una DONE. Si el usuario sale sin registrar, el media en memoria se descarta — no hay visita
   creada. Alternativa descartada: adjuntos en el mismo submit transaccional (acopla `RecordVisit`
   al media y arriesga perder capturas largas).
3. **Solo en visitas realizadas.** `AttachMediaToVisit` rechaza visitas inexistentes y no-DONE
   (`VisitNotFound` / error nuevo `MediaRequiresDoneVisit`). Cancelar es **baja lógica**: no borra
   adjuntos, y la vista read-only de una cancelada **muestra la galería sin edición**. `clearAllData`
   limpia el store `media`.
4. **Compresión en cliente.** Imágenes → redimensionadas a **1600px por el lado largo**, JPEG
   calidad ~0.8 (≈300 KB), respetando la **orientación EXIF** (fotos de celular rotadas): se decodifica
   con `createImageBitmap(file, { imageOrientation: 'from-image' })`. Voz → `MediaRecorder`
   (`audio/webm;codecs=opus`, ≈0,3 MB/min), **máx. 5 min** de grabación.
5. **Riesgo de almacenamiento aceptado explícitamente.** El media vive solo en el dispositivo,
   comprimido; se pide `navigator.storage.persist()` (best-effort) y se acepta que el navegador
   pueda evacuar datos bajo presión. **Sin medidor de uso** (YAGNI) y **sin backup**: la
   sincronización a la nube es Etapa 5.
6. **Captura en utilidades inyectables** (`captureImage`, `captureVoice`). Los tests jsdom mockean
   la utilidad, no necesitan cámara/canvas/`MediaRecorder` reales.
7. **Flag `mediaVisitas`** + generalizar `api/flags.ts` para evaluar una **lista** de flags (hoy solo
   `onboardingNuevo`).

## 1. Entidad `VisitMedia` (`src/domain/entities/visit-media.ts`)

```ts
export type MediaKind = 'image' | 'voice';

export class VisitMedia {
  readonly id: string;
  readonly visitId: string;
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
  readonly blob: Blob;

  constructor(params: {
    id: string;
    visitId: string;
    kind: MediaKind;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    blob: Blob;
  }) {
    this.id = params.id;
    this.visitId = params.visitId;
    this.kind = params.kind;
    this.mimeType = params.mimeType;
    this.sizeBytes = params.sizeBytes;
    this.createdAt = params.createdAt;
    this.blob = params.blob;
  }

  get isImage(): boolean { return this.kind === 'image'; }
  get isVoice(): boolean { return this.kind === 'voice'; }
}
```

`Blob` se usa como tipo de payload porque mapea 1:1 a IndexedDB (guarda blobs nativos) y a
`URL.createObjectURL` para previsualización. El dominio nunca lo lee. Disponible en Node 18+ (los
tests corren sin jsdom) y en el navegador.

Nuevo id en `src/domain/shared/ids.ts`: `export type MediaId = string;`.
Nuevos errores en `src/domain/shared/errors.ts`: `MediaRequiresDoneVisit`, `MediaTooLarge`.

## 2. Puerto `MediaRepository` (`src/domain/ports/outbound/media-repository.ts`)

```ts
export interface MediaRepository {
  save(media: VisitMedia): Promise<void>;
  listByVisit(visitId: VisitId): Promise<VisitMedia[]>;
  delete(id: MediaId): Promise<void>;
}
```

## 3. Casos de uso (`src/application/use-cases/`)

- **`AttachMediaToVisit`** (`attach-media.ts`): input `{ visitId, kind, mimeType, blob }`. Valida:
  la visita existe (`VisitNotFound`), su `status === 'DONE'` (`MediaRequiresDoneVisit`), y el tamaño
  entra en el tope del kind (`MediaTooLarge`; defensivo: imagen ≤ 5 MB, voz ≤ 8 MB — el límite real
  de duración lo pone la UI). `sizeBytes = blob.size`, `createdAt = clock.now()`, `id = ids.next()`
  (UUIDv7). Guarda y devuelve el `VisitMedia` creado.
- **`RemoveMediaFromVisit`** (`remove-media.ts`): input `{ mediaId }`. `delete` idempotente (borrar
  un id inexistente no falla).
- **`ListVisitMedia`** (`list-visit-media.ts`): input `{ visitId }` → `VisitMedia[]` ordenados por
  `createdAt` ascendente.

Ninguno toca `Visit`/`Reminder`: son agregados independientes referenciados por id.

## 4. Infraestructura

- **idb**: en `records.ts`, `MediaRecord { id, visitId, kind, mimeType, sizeBytes, createdAt, blob }`
  + `toMediaRecord`/`fromMediaRecord`. En `open-campo-db.ts`, **schema v4**: store `media`
  (`keyPath: 'id'`) con índice `by-visit` sobre `visitId`; crearlo en el bloque `< 1` y en un
  `if (oldVersion < 4)` nuevo (cubre upgrades 1/2/3). `IdbMediaRepository` (`idb-media-repository.ts`)
  persistiendo el blob tal cual.
- **Reset**: `IdbDataReset.STORES` suma `'media'`.
- **In-memory**: `InMemoryMediaRepository` + su `clear()` en el `DataReset` de
  `wireCatalogUseCases`/`makeInMemoryContainer`.

## 5. UI

- **`MediaCaptureSection`** (`src/ui/components/`): estado **pendiente** (no persistido) — lista
  `{ tempId, kind, mimeType, blob, previewUrl }`. Botón "Agregar foto" → `<input type="file"
  accept="image/*" multiple>` → `captureImage(file)` por cada archivo. Botón "Grabar nota" → micrófono
  con `captureVoice` (grabar/detener + timer). Preview: miniatura `<img>` para fotos, `<audio
  controls>` para voz. Botón quitar por item. Los `object URLs` se **revocan** al quitar/desmontar.
- **`captureImage`/`captureVoice`** (`src/ui/media/`): utilidades puras sobre APIs del navegador,
  mockeables en tests. `captureImage` usa `createImageBitmap` con `imageOrientation: 'from-image'`,
  canvas `toBlob('image/jpeg', 0.8)` a máx 1600px. `captureVoice` envuelve `MediaRecorder` con
  estados `idle | recording | done` y corte a los 5 min.
- **Hooks** (`src/ui/hooks/`): `useAttachMedia`, `useRemoveMedia`, `useVisitMedia(visitId)` (lista,
  con `loading`), siguiendo el patrón submit/error/done de los hooks existentes.
- **`RecordVisitScreen`**: si `useFlag('mediaVisitas')`, muestra `MediaCaptureSection` (título
  "Fotos y nota de voz"). En `onSubmit`, tras el éxito de `RecordVisit` (`result.visitId`), adjunta
  cada blob pendiente con `useAttachMedia` y luego navega a Inicio como hoy. Si un attach falla, se
  muestra el error del dominio en el alert existente (la visita ya quedó guardada; el media se puede
  reintentar desde el detalle).
- **`VisitDetailScreen`**:
  - DONE → debajo del form de edición, galería persistida (`useVisitMedia`) + "Agregar"
    (`MediaCaptureSection` reutilizado, attach directo) + **quitar** individual con `ConfirmDialog`
    (borrado permanente).
  - CANCELLED → galería **read-only** (sin agregar/quitar).
  - PENDING → sin sección.

## 6. Gating

- `useFlag('mediaVisitas')` en `RecordVisitScreen` y `VisitDetailScreen` (sección oculta si el flag
  está apagado).
- `api/flags.ts` generalizado:

```ts
const FLAGS = ['onboardingNuevo', 'mediaVisitas'] as const;
type FlagName = (typeof FLAGS)[number];
const DEFAULTS: Record<FlagName, boolean> = { onboardingNuevo: false, mediaVisitas: false };
// handler: evalúa cada flag con flagsClient.evaluate(name, false); ante cualquier error responde DEFAULTS.
```

## 7. Wiring

- `Container` (`src/composition/container.ts`): `attachMedia`, `removeMedia`, `listVisitMedia`
  (idb). Espejo en `makeInMemoryContainer` (`tests/support/in-memory-container.ts`).
- `src/ui/error-messages.ts`: mensajes para `MediaRequiresDoneVisit` ("Los adjuntos solo se agregan a
  visitas realizadas.") y `MediaTooLarge` ("El archivo es demasiado grande."); `VisitNotFound` ya
  está mapeado.

## Fuera de alcance (diferido)

- Sincronizar/backupear adjuntos a la nube → Etapa 5.
- Miniaturas o "hay adjuntos" en Agenda / historial de lote (YAGNI).
- Reemplazar un adjunto (se borra y se vuelve a agregar).
- Adjuntos en visitas programadas (PENDING).
- Medidor de uso de storage.
- Voz: sin transcripción ni reproducción en background.
- Edición de foto en cliente (recortar, rotar).

## Plan de tests (TDD)

- `tests/application/attach-media.test.ts`: adjunta a una DONE existente (guarda blob, calcula
  `sizeBytes`, genera id); rechaza visita inexistente (`VisitNotFound`) y no-DONE
  (`MediaRequiresDoneVisit`); rechaza imagen > 5 MB y voz > 8 MB (`MediaTooLarge`).
- `tests/application/list-visit-media.test.ts`: lista vacía; orden `createdAt` asc; solo las de esa
  visita.
- `tests/application/remove-media.test.ts`: borra; borrar id inexistente es no-op.
- `tests/infrastructure/idb/idb-media-repository.test.ts`: round-trip de blobs (image + audio) idb;
  `listByVisit` por índice; `delete`.
- `tests/infrastructure/idb/open-campo-db.test.ts` (ampliar): v3→v4 conserva zones/clients/fields/
  visits/reminders y agrega store `media` vacío.
- `tests/infrastructure/idb/idb-data-reset.test.ts` (ampliar): `clearAll` también limpia `media`.
- `tests/ui/media-capture.test.tsx`: `captureImage` respeta 1600px/EXIF (canvas fake) y `captureVoice`
  pasa por estados idle→recording→done con corte a 5 min (MediaRecorder fake).
- `tests/ui/record-visit-screen.test.tsx` (ampliar): con flag on, captura fotos/voz pendientes y al
  "Registrar" adjunta al resultado; si un attach falla muestra el error y la visita quedó guardada;
  con flag off la sección no existe.
- `tests/ui/visit-detail-screen.test.tsx` (ampliar): galería de una DONE con agregar/quitar
  (confirm); read-only en CANCELLED; sin sección en PENDING; oculta sin flag.
- `tests/api/flags.test.ts` (ampliar): responde `{ onboardingNuevo, mediaVisitas }` con defaults.
