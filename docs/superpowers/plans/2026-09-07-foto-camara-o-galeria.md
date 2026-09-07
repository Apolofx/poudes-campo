# Plan: Elegir entre cámara o galería al adjuntar foto

**Rama:** `foto-camara-o-galeria`
**Problema:** La sección de adjuntos ofrece un solo botón "Foto" cuyo `<input type="file">` sin
`capture` abre en el Redmi 11 el chooser de Google Photos sin CTA de cámara. El usuario no puede
sacar una foto en el momento.

## Solución

Dos botones de imagen explícitos en `MediaGallery`:

- **Cámara** → `<input type="file" accept="image/*" capture="environment">` (una foto por apertura).
- **Galería** → `<input type="file" accept="image/*" multiple>` (el input actual, sin `capture`).

Ambos comparten el mismo handler `onFiles` (procesa con `captureImage` y agrega al preview
pendiente). No se toca dominio ni application.

## Archivos a modificar/crear

| Archivo | Acción |
|---|---|
| `src/ui/components/MediaGallery.tsx` | **Editar** — duplicar el input de imagen y reemplazar el botón único "Foto" por "Cámara" y "Galería" |
| `src/ui/media-gallery.css` (si existe) / estilos del componente | **Editar** — layout de dos botones si hace falta |
| `tests/ui/media-gallery.test.tsx` | **Editar** — tests de los dos botones/inputs |

## Tareas (TDD)

### T1 — Tests: dos botones y dos inputs
Ampliar `tests/ui/media-gallery.test.tsx`:
- [ ] Renderiza botones **"Cámara"** y **"Galería"** (y ya no un "Foto" único)
- [ ] El input activado por "Cámara" tiene `attr capture="environment"` y **no** `multiple`
- [ ] El input de "Galería" **no** tiene `capture` y **sí** `multiple`
- [ ] `readOnly`/`busy` deshabilitan ambos botones (igual que hoy)

### T2 — Implementar inputs + botones en MediaGallery
Editar `src/ui/components/MediaGallery.tsx`:
- [ ] Segundo input `cameraInputRef` con `accept="image/*" capture="environment"` (sin `multiple`), junto al `galleryInputRef` actual (sin `capture`, con `multiple`)
- [ ] Botón **"Cámara"** (icono `Camera` de lucide-react) → `cameraInputRef.click()`
- [ ] Botón **"Galería"** (icono `Images` de lucide-react) → `galleryInputRef.click()`
- [ ] Reemplazar el botón único "Foto" (`ImagePlus`) por los dos de arriba
- [ ] Ambos inputs usan el mismo `onFiles` existente (sin cambios en el pipeline)

### T3 — Estilos si el layout lo pide
- [ ] Si el contenedor `media-capture` no acomoda dos botones en fila, ajustar el CSS del componente (flex/gap) sin romper el botón de voz

### T4 — Verificación
- [ ] `npm test`
- [ ] `npm run typecheck`

## Fallback (no implementado en esta etapa)

Si en el Redmi 11 `capture="environment"` no abre la cámara: fallback a `getUserMedia`
(`navigator.mediaDevices.getUserMedia({ video: true })` + canvas snapshot, mismo patrón que
`useVoiceCapture`). Documentado como riesgo; se implementa solo si la validación en el teléfono real
lo requiere.

## No se toca

- `src/domain/**`, `src/application/**` — sin cambios
- `AttachMediaToVisit`, `captureImage`, persistencia, flags, error-messages — sin cambios

## Verificación

```bash
npm test
npm run typecheck
```