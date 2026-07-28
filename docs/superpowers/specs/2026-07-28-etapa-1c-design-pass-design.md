# Etapa 1c — Pasada de diseño (estilo visual) — diseño

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para plan de implementación
**Depende de:** Etapa 1b (UI React funcional, 2 pantallas, sin CSS). Mergeada en `main`.

## Objetivo

Darle a las **dos pantallas existentes** (Buscar lote · Registrar visita) un estilo visual **funcional prolijo, mobile-first**, pensado para uso en el campo con el teléfono (a pleno sol, una mano). Es una pasada **presentacional**: no cambia comportamiento, lógica, ni el núcleo. Hoy la UI es HTML semántico crudo (se ve con estilos default del navegador); esta etapa la hace ver como un producto prolijo.

**Regla dura del proyecto:** ningún dato de dosis/agroquímicos entra al sistema (acá no aplica directamente, pero se respeta: no se agregan campos).

## Decisiones de diseño (cerradas una por una, con companion visual)

1. **Ambición — funcional prolijo, mobile-first.** Contraste alto, tipografía grande, áreas táctiles amplias, buen espaciado. Sin identidad de marca elaborada, sin animaciones. Base sobre la que se puede subir después.
2. **Enfoque CSS — CSS plano + custom properties.** Un stylesheet con variables CSS como design tokens. Cero dependencias, cero build config extra. Mantiene la UI como adaptador fino y reemplazable. Descartados: CSS Modules (scoping innecesario para 2 pantallas), Tailwind (dependencia + acople markup↔estilo, sobredimensionado).
3. **Paleta — "Campo" (verde agronómico), tema claro único.**
   - Fondo: `#f7f6f1` (blanco cálido) · Superficie (inputs/tarjetas): `#ffffff`
   - Tinta (texto principal): `#1c2a21` · Texto atenuado: `#5c6b5f`
   - Acento (verde): `#2f7d4f` · Texto sobre acento: `#ffffff`
   - Borde de input: `#cbd3c8` · Divisor de filas: `#eceadf` · Borde de header: `#e4e2d8`
   - Fondo del control segmentado: `#e7ebe4` · Placeholder: `#8a968b`
   - Error/peligro: `#b4231f` (para `role="alert"`)
4. **Tipografía — fuente del sistema** (`system-ui, -apple-system, Segoe UI, Roboto, sans-serif`). Cero webfonts: arranque instantáneo, nada que cachear (ideal offline-first), legibilidad nativa. Descartadas Inter / display webfont (suman peso y setup de auto-hospedaje para offline).
5. **Layout — mobile-first, columna centrada (máx. ~480px en desktop):**
   - **Buscar lote:** header con título + buscador **sticky** (siempre a mano al scrollear). Lista de filas altas y táctiles (~56px): nombre del lote en verde/negrita, `cliente · zona` debajo en atenuado, chevron `›` a la derecha, divisores sutiles entre filas.
   - **Registrar visita:** link "‹ Buscar lote" para volver arriba. Título. Campos Fecha y Notas. Sección "Próxima visita" como **control segmentado** de 3 opciones (En N días / En una fecha / Sin próxima) con los campos condicionales debajo. Botón primario "Registrar" grande al final.

## Alcance y límites (importante)

**Esta etapa es CSS + clases/markup mínimo. NO toca comportamiento ni lógica.**

- **Se agrega:** `src/ui/styles.css` (tokens + reset + componentes), su import en `main.tsx`, y `className`/markup mínimo en las dos pantallas + `App`.
- **NO se toca:** `src/domain/**`, `src/application/**`, `src/infrastructure/**`, `src/composition/**`, ni la lógica de los hooks ni el wiring. Los casos de uso, validaciones y flujo quedan idénticos.
- **Los 100 tests existentes deben seguir verdes.** Consultan roles/labels/nombres accesibles/hrefs, no estilos. El restyle **debe preservar** exactamente:
  - `h1` "Buscar lote" y "Registrar visita" (los tests los buscan por nombre de heading exacto).
  - `input aria-label="Buscar"` (getByLabelText('Buscar')).
  - Los `<Link>` de la lista: mismo `href` (`/field/:id/record`) y nombre accesible que incluye el nombre del lote.
  - Labels "Fecha", "Notas" y el radio "Sin próxima" (getByLabelText). El control segmentado se construye **conservando los `<input type="radio">` reales** (solo se ocultan visualmente y se estiliza el label), para no romper accesibilidad ni los tests.
  - `<p role="alert">` para errores de dominio.
  - `<button type="submit">` cuyo nombre contiene "Registrar".

## Detalle de componentes

### Design tokens (`:root` en `styles.css`)
Variables para colores (arriba), espaciado (escala 4/8/12/16/20/24), radios (`--radius-sm:8px`, `--radius:10px`, `--radius-lg:12px`, `--radius-xl:20px`), y **área táctil mínima 44px** en filas, inputs, segmentos y botones.

### Reset base
`box-sizing:border-box`, reset de márgenes, `body` con fondo `--bg`, tinta `--ink`, `font-family` del sistema, `-webkit-text-size-adjust:100%`. Anti-aliasing suave.

### Shell / layout
`main` (una por pantalla) se estiliza como columna centrada, `max-width:480px`, ancho completo en teléfono, con padding lateral.

### Buscar lote
- Header sticky (título + buscador). Buscador: input full-width con ícono de lupa **inline SVG** (self-contained, `aria-hidden`), placeholder atenuado, foco con anillo de acento.
- Lista: `ul` sin bullets; cada fila un `<Link>` en flex (nombre + sub a la izquierda, chevron a la derecha), min-height ~56px, divisor inferior, estados `:hover`/`:focus-visible`/`:active`.
- **Estado vacío** (mejora nueva, sin cambiar lógica): cuando hay query no vacío y 0 resultados, mostrar "No se encontró ningún lote." Se muestra solo con `query !== '' && results.length === 0` para no parpadear en el arranque.
- "Buscando…" (loading) estilizado discreto.

### Registrar visita
- Back link "‹ Buscar lote" (nuevo `<Link to="/">`, no rompe tests).
- Labels en minúscula-mayúscula pequeña (uppercase, letter-spacing), inputs/textarea con estilo de superficie, foco con anillo de acento.
- **Control segmentado** "Próxima visita": los 3 radios se mantienen en el DOM (ocultos con técnica accesible: posición absoluta + opacidad 0, no `display:none`), y cada `<label>` se estiliza como píldora dentro de un contenedor con fondo `--segment-bg`. La píldora activa usa el patrón CSS `input:checked + span` (el texto del label va envuelto en un `<span>`), sin depender de `:has`.
- Campos condicionales (Días / Fecha próxima / Avisar días antes) con el mismo estilo de input; se muestran según `kind` (lógica intacta).
- `role="alert"` estilizado con color/fondo de peligro suave.
- Botón primario "Registrar" full-width, alto (~48px), con estado `:disabled` (submitting) atenuado.

## Testing

- **Guardia principal:** los **100 tests existentes siguen verdes** (verifican que el restyle no rompió roles/labels/nombres accesibles). Ejecutar `npm test` y `npm run typecheck`.
- **Tests nuevos (comportamiento de elementos agregados, no estilos):**
  - Search: filtrando a 0 resultados con query no vacío se muestra "No se encontró ningún lote."; con query vacío NO se muestra.
  - Record: existe el link de volver "Buscar lote" (getByRole('link', { name: /Buscar lote/ })).
- **Verificación visual:** `npm run build` + levantar la app y sacar screenshot de ambas pantallas para confirmar el look (los estilos no se testean unitariamente).
- Accesibilidad: verificar contraste ≥ 4.5:1 para texto de cuerpo (atenuado sobre fondo, verde sobre fondo).

## Fuera de alcance (diferido, con motivo)

- **Subtítulo con el nombre del lote en "Registrar visita"** (ej. "El Alto · Est. Pérez"): se mostró en el mockup, pero requiere que la pantalla **cargue el field por id**, y hoy el container no expone esa lectura (haría falta un `GetField`/exponer `findById` → cambio en aplicación). Es una mejora funcional pequeña, no presentacional → se difiere a una tarea funcional aparte (o se pliega a Etapa 2). Anotado en `ROADMAP.md`.
- **Modo oscuro:** tema claro único por ahora (mejor legibilidad al sol). Diferido.
- **Íconos PWA reales** (192/512): siguen como placeholders 1×1 de Etapa 1b; reemplazo aparte antes de release.
- **Animaciones / micro-interacciones:** fuera del alcance "funcional prolijo".
