# Etapa — Elegir entre cámara o galería al adjuntar foto

> Spec de diseño. Fuente del backlog: [`docs/ROADMAP.md`](../../ROADMAP.md). Convenciones: [`AGENTS.md`](../../../AGENTS.md).
> Fecha: 2026-09-07.

## Contexto y alcance

Al registrar una visita con el flag `mediaVisitas` activo, la sección de adjuntos ofrece un único
botón **"Foto"** que abre `<input type="file" accept="image/*">` **sin** `capture`. En el teléfono
del usuario (Xiaomi Redmi 11) ese input abre el chooser de Google Photos **sin ningún CTA de
cámara**: solo galería. El usuario no puede sacar una foto en el momento desde la app.

Esta etapa agrega **dos botones de imagen explícitos**:

- **Cámara** → `<input type="file" accept="image/*" capture="environment">`, abre la cámara del
  dispositivo.
- **Galería** → `<input type="file" accept="image/*" multiple>` (input actual, sin `capture`), abre
  el chooser de archivos (Google Photos en el Redmi 11).

El usuario **conserva ambas opciones en todo momento**: s**e elige explícitamente cámara o galería
por foto**. El blob que salga de cualquiera de las dos pasa por el mismo pipeline (`captureImage` →
preview → `AttachMediaToVisit` al registrar) sin ningún cambio aguas abajo.

Regla dura vigente: ningún dato de dosis/agroquímicos/prescripciones. **No** se toca `src/domain` ni
`src/application`: es un cambio puramente de UI (`src/ui/`) y sus tests (`tests/ui/`).

## Decisiones tomadas (brainstorming)

1. **Dos inputs, dos botones, mismo handler.** Un input `gallery` (actual, sin `capture`) y uno
   `camera` con `accept="image/*" capture="environment"`. Ambos comparten el mismo `onFiles` de hoy
   (procesa con `captureImage`, agrega al preview pendiente). El origen (cámara o galería) no se
   persiste: `captureImage` ya es agnóstica al origen del blob.
2. **`multiple` solo en Galería.** Elegir varias fotos de una sola vez desde la galería; la cámara
   saca **una** foto por apertura (behavior estándar de la cámara del SO). Si después se quiere más,
   se vuelve a tocar "Cámara".
3. **`capture="environment"` como mecanismo primario, `getUserMedia` como fallback documentado (no
   implementado en esta etapa).** `capture` es HTML Media Capture puro: no requiere permisos extra de
   la app (el SO pide el suyo la primera vez) y es el cambio mínimo. Riesgo conocido: en algunos
   dispositivos/PWA instaladas `capture` puede no abrir la cámara. El plan deja anotado el fallback a
   `getUserMedia` (mismo patrón que `useVoiceCapture`) pero **no se implementa por YAGNI** hasta
   validar en el teléfono real.
4. **Etiquetas explícitas, no solo icono.** Los botones llevan **texto + icono SVG** (lucide-react).
   El botón actual "Foto" se **renombra y divide**: "Cámara" (icono `Camera`) y "Galería" (icono
   `Images`). Sin emoji como iconos.
5. **Sin cambios en dominio ni application.** `AttachMediaToVisit` sigue validando tamaño ("imagen ≤
   5 MB", y el límite defensivo en el kind). Los errores y los textos ya están mapeados.

## 1. UI — `src/ui/components/MediaGallery.tsx`

Estado pendiente (sin persistir): lista `MediaItemView` tal como hoy. Se mantiene el patrón de
**inputs ocultos** activados por botón (`ref.click()`), ya existente en el componente:

- `galleryInputRef` + botón **"Galería"** → `accept="image/*" multiple` (sin `capture`).
- `cameraInputRef` + botón **"Cámara"** → `accept="image/*" capture="environment"` (sin `multiple`).

Ambos inputs disparan el mismo `onFiles`. El botón único actual `Foto` (icono `ImagePlus`) se
reemplaza por dos botones:

```tsx
<input ref={galleryInputRef} className="media-file-input" type="file" accept="image/*" multiple onChange={onFiles} />
<input ref={cameraInputRef} className="media-file-input" type="file" accept="image/*" capture="environment" onChange={onFiles} />

<button type="button" className="capture-btn" disabled={!canCapture} onClick={() => cameraInputRef.current?.click()}>
  <span className="capture-icon"><Camera size={22} strokeWidth={2} aria-hidden="true" /></span>
  <span className="capture-label">Cámara</span>
</button>

<button type="button" className="capture-btn" disabled={!canCapture} onClick={() => galleryInputRef.current?.click()}>
  <span className="capture-icon"><Images size={22} strokeWidth={2} aria-hidden="true" /></span>
  <span className="capture-label">Galería</span>
</button>
```

El resto del componente (previews, voz, errores, readOnly, busy) queda **igual**.

## 2. Tests — `tests/ui/media-gallery.test.tsx` (ampliar)

- El componente expone dos botones de imagen: **"Cámara"** y **"Galería"** (y ya no un botón "Foto"
  único).
- El input de **cámara** tiene `attr capture="environment"` y **no** `multiple`.
- El input de **galería** **no** tiene `capture` y **sí** `multiple`.
- Elegir archivos desde **galería** procesa y agrega al preview (comportamiento actual).
- Elegir archivos desde **cámara** procesa y agrega al preview (mismo pipeline).
- Botones deshabilitados por `readOnly` / `busy`, igual que hoy.

`captureImage` ya está cubierto en `tests/ui/media/capture-image.test.ts` — no se repite.

## 3. Estilos — `src/ui/media-gallery.css` (si existe) / bloque del componente

Los botones `capture-btn` ya existen y se reutilizan tal cual; solo cambia su cantidad (de uno de
imagen a dos) y sus etiquetas/iconos. No se agrega CSS nuevo salvo que el layout de dos botones en
fila lo requiera (flex existente del contenedor `media-capture`).

## Fuera de alcance (diferido)

- Fallback `getUserMedia` para captura de foto (solo validar en teléfono real; se implementa si
  `capture="environment"` falla).
- Edición de foto en cliente (recortar, rotar).
- Medidor de uso de storage / backup en la nube (Etapa 5).
- Adjuntos en visitas programadas (PENDING).
- Persistir el origen (cámara vs galería) del adjunto.

## Plan de tests (TDD)

Ampliar `tests/ui/media-gallery.test.tsx` (ver sección 2). Sin cambios en dominio, application o
infraestructura: no hay nuevos tests de unidad de esas capas.

## Wiring

Sin cambios en `Container`, flags, ni `error-messages` (los errores de `captureImage` ya se muestran
como `alert`). La sección sigue gateada por `mediaVisitas`.

## Riesgo

`capture="environment"` no es 100% confiable en todos los dispositivos/PWAs instaladas. Mitigación
documentada: fallback a `getUserMedia` (patrón de `useVoiceCapture`) en una etapa futura si el Redmi
11 no abre la cámara.