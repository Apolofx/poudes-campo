# Etapa 1c — Pasada de diseño (estilo visual) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar estilo visual (funcional prolijo, mobile-first, paleta "Campo") a las dos pantallas existentes (Buscar lote · Registrar visita), sin cambiar comportamiento ni lógica, manteniendo los 100 tests verdes.

**Architecture:** CSS plano con custom properties (design tokens) en un único `src/ui/styles.css` importado una vez en `main.tsx`. Las pantallas reciben `className`/markup mínimo. Cero dependencias nuevas. La UI sigue siendo un adaptador presentacional fino.

**Tech Stack:** CSS3 (custom properties, flexbox, `position:sticky`), React 18 + TypeScript existente. Vitest + Testing Library para no romper accesibilidad.

## Global Constraints

- **NO tocar** `src/domain/**`, `src/application/**`, `src/infrastructure/**`, `src/composition/**`, ni la lógica de los hooks ni el wiring. Solo `src/ui/**` (estilos + clases/markup) y el import del CSS en `src/main.tsx`.
- **Ningún dato de dosis/agroquímicos** (no se agregan campos).
- **Preservar exactamente** estos nombres accesibles (los tests dependen de ellos):
  - `h1` con texto exacto "Buscar lote" y "Registrar visita".
  - `input aria-label="Buscar"`.
  - Los `<Link>` de la lista: mismo `href` (`/field/:id/record`) y nombre accesible que incluye el nombre del lote.
  - Labels "Fecha", "Notas" y el radio "Sin próxima" (asociación label↔control intacta).
  - `<p role="alert">` para errores.
  - `<button type="submit">` cuyo nombre contiene "Registrar".
- Tema **claro único**. Fuente del **sistema** (sin webfonts). Área táctil mínima **44px**.
- **TDD donde aplica** (elementos con comportamiento nuevo: estado vacío, back link). El CSS puro no se testea unitariamente; se valida con `npm test` verde + verificación visual. Commits frecuentes.
- Paleta (tokens): bg `#f7f6f1`, surface `#ffffff`, ink `#1c2a21`, muted `#5c6b5f`, accent `#2f7d4f`, accent-ink `#ffffff`, border `#cbd3c8`, divider `#eceadf`, header-border `#e4e2d8`, segment-bg `#e7ebe4`, placeholder `#8a968b`, danger `#b4231f`.

---

## File Structure

**Nuevos:**
- `src/ui/styles.css` — design tokens (`:root`), reset base, y clases de componentes para ambas pantallas.

**Modificados:**
- `src/main.tsx` — agregar `import '@/ui/styles.css';`.
- `src/ui/screens/SearchScreen.tsx` — `className`/markup: header sticky, ícono de búsqueda inline SVG, filas con nombre/sub/chevron, estado vacío.
- `src/ui/screens/RecordVisitScreen.tsx` — `className`/markup: back link, labels, control segmentado (radios ocultos accesiblemente + span de texto), campos, botón.
- `tests/ui/search-screen.test.tsx` — agregar test de estado vacío.
- `tests/ui/record-visit-screen.test.tsx` — agregar test del back link.

**Sin cambios:** `App.tsx`, hooks, `CampoProvider`, `error-messages.ts`, y todo fuera de `src/ui`.

---

## Task 1: Design tokens, reset y import del stylesheet

**Files:**
- Create: `src/ui/styles.css`
- Modify: `src/main.tsx` (agregar import)

**Interfaces:**
- Consumes: nada.
- Produces: `src/ui/styles.css` cargado globalmente, con tokens `:root` y clases base. Las Tasks 2 y 3 usan estas clases y variables.

- [ ] **Step 1: Crear `src/ui/styles.css` con tokens + reset + shell**

```css
:root {
  /* colores — paleta Campo (tema claro) */
  --bg: #f7f6f1;
  --surface: #ffffff;
  --ink: #1c2a21;
  --muted: #5c6b5f;
  --accent: #2f7d4f;
  --accent-ink: #ffffff;
  --border: #cbd3c8;
  --divider: #eceadf;
  --header-border: #e4e2d8;
  --segment-bg: #e7ebe4;
  --placeholder: #8a968b;
  --danger: #b4231f;
  --danger-bg: #fbeceb;

  /* espaciado */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;

  /* radios */
  --radius-sm: 8px;
  --radius: 10px;
  --radius-lg: 12px;
  --radius-xl: 20px;

  /* área táctil mínima */
  --touch: 44px;

  --font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

* { box-sizing: border-box; }

html, body { margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font);
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  line-height: 1.4;
}

/* shell: columna centrada, ancho completo en teléfono */
.screen {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--bg);
}

/* foco accesible global */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Importar el stylesheet en `src/main.tsx`**

Agregar como primera línea de imports de `src/main.tsx`:

```ts
import '@/ui/styles.css';
```

(Va antes de los demás imports; Vite lo resuelve como side-effect import de CSS.)

- [ ] **Step 3: Verificar que compila y los tests siguen verdes**

Run: `npm run typecheck`
Expected: sin errores.

Run: `npm test`
Expected: 100 tests verdes (el CSS no afecta el comportamiento; jsdom ignora estilos).

- [ ] **Step 4: Verificar el build**

Run: `npm run build`
Expected: build OK; el CSS queda incluido en el bundle.

- [ ] **Step 5: Commit**

```bash
git add src/ui/styles.css src/main.tsx
git commit -m "feat(ui): design tokens, base reset and stylesheet wiring"
```

---

## Task 2: Restyle "Buscar lote" + estado vacío

**Files:**
- Modify: `src/ui/screens/SearchScreen.tsx`
- Modify: `src/ui/styles.css` (agregar clases de esta pantalla)
- Test: `tests/ui/search-screen.test.tsx` (agregar test de estado vacío)

**Interfaces:**
- Consumes: tokens/clases de Task 1; hook `useSearchFields` (sin cambios).
- Produces: `SearchScreen` estilizado. No cambia su API ni su comportamiento.

- [ ] **Step 1: Escribir el test que falla (estado vacío)**

Agregar a `tests/ui/search-screen.test.tsx` (dentro del `describe` existente):

```tsx
  it('shows an empty message when a non-empty query matches nothing', async () => {
    renderScreen();
    await screen.findByText(/Lote El Alto/);
    await userEvent.type(screen.getByLabelText('Buscar'), 'zzzznomatch');
    expect(await screen.findByText('No se encontró ningún lote.')).toBeInTheDocument();
  });

  it('does not show the empty message on initial empty query', async () => {
    renderScreen();
    await screen.findByText(/Lote El Alto/);
    expect(screen.queryByText('No se encontró ningún lote.')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Verificar que el primer test falla**

Run: `npx vitest run tests/ui/search-screen.test.tsx -t "empty message"`
Expected: FAIL — no existe el texto "No se encontró ningún lote." todavía.

- [ ] **Step 3: Reescribir `SearchScreen.tsx` con markup/clases + estado vacío**

Reemplazar el `return (...)` de `src/ui/screens/SearchScreen.tsx` por:

```tsx
  return (
    <main className="screen search">
      <header className="search-header">
        <h1 className="screen-title">Buscar lote</h1>
        <div className="search-box">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            className="search-input"
            aria-label="Buscar"
            value={query}
            onChange={onChange}
            placeholder="Lote, cliente o zona"
          />
        </div>
      </header>

      {loading && <p className="hint">Buscando…</p>}

      {query !== '' && !loading && results.length === 0 ? (
        <p className="empty">No se encontró ningún lote.</p>
      ) : (
        <ul className="field-list">
          {results.map((r) => (
            <li key={r.field.id}>
              <Link className="field-row" to={`/field/${r.field.id}/record`}>
                <span className="field-text">
                  <span className="field-name">{r.field.name}</span>
                  <span className="field-sub">{r.clientName} · {r.zoneName}</span>
                </span>
                <span className="chevron" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
```

Nota: el nombre accesible del `<Link>` sigue conteniendo `field.name` (+ cliente + zona), y el `href` no cambia → los tests existentes (`getByRole('link', { name: /El Alto/ })` y filtrado) siguen pasando.

- [ ] **Step 4: Agregar las clases de "Buscar lote" a `src/ui/styles.css`**

Anexar al final de `src/ui/styles.css`:

```css
/* ---- Buscar lote ---- */
.search-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg);
  padding: var(--space-4) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--header-border);
}

.screen-title {
  margin: 0 0 var(--space-3);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  padding: 0 var(--space-3);
}

.search-box:focus-within { border-color: var(--accent); }

.search-icon { color: var(--placeholder); flex: none; }

.search-input {
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  color: var(--ink);
  padding: var(--space-3) 0;
  min-height: var(--touch);
}

.search-input::placeholder { color: var(--placeholder); }

.hint, .empty {
  color: var(--muted);
  padding: var(--space-4);
  margin: 0;
}

.field-list { list-style: none; margin: 0; padding: 0; }

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 56px;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--divider);
  text-decoration: none;
  color: inherit;
}

.field-row:active { background: var(--divider); }

.field-text { display: flex; flex-direction: column; gap: 2px; }

.field-name { font-weight: 700; font-size: 15px; color: var(--accent); }

.field-sub { font-size: 12.5px; color: var(--muted); }

.chevron { color: #b7c0b6; font-size: 20px; line-height: 1; flex: none; }
```

- [ ] **Step 5: Verificar tests verdes (nuevos + existentes)**

Run: `npx vitest run tests/ui/search-screen.test.tsx`
Expected: PASS — incluidos los dos tests nuevos de estado vacío y los existentes (filtrado, links, href).

Run: `npm test`
Expected: 102 tests verdes.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/SearchScreen.tsx src/ui/styles.css tests/ui/search-screen.test.tsx
git commit -m "feat(ui): style Buscar lote screen with sticky search and empty state"
```

---

## Task 3: Restyle "Registrar visita" + back link + control segmentado

**Files:**
- Modify: `src/ui/screens/RecordVisitScreen.tsx`
- Modify: `src/ui/styles.css` (agregar clases de esta pantalla)
- Test: `tests/ui/record-visit-screen.test.tsx` (agregar test del back link)

**Interfaces:**
- Consumes: tokens/clases de Task 1; hook `useRecordVisit`, `domainErrorMessage` (sin cambios).
- Produces: `RecordVisitScreen` estilizado. Comportamiento y lógica idénticos.

- [ ] **Step 1: Escribir el test que falla (back link)**

Agregar a `tests/ui/record-visit-screen.test.tsx` (dentro del `describe` existente):

```tsx
  it('renders a back link to the search list', async () => {
    renderScreen();
    const back = await screen.findByRole('link', { name: /Buscar lote/ });
    expect(back).toHaveAttribute('href', '/');
  });
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/ui/record-visit-screen.test.tsx -t "back link"`
Expected: FAIL — no existe el link "Buscar lote" todavía.

- [ ] **Step 3: Reescribir el markup de `RecordVisitScreen.tsx`**

En `src/ui/screens/RecordVisitScreen.tsx`:

Agregar `Link` al import de react-router-dom (línea 2):

```tsx
import { Link, useNavigate, useParams } from 'react-router-dom';
```

Reemplazar el `return (...)` por:

```tsx
  return (
    <main className="screen record">
      <Link className="back-link" to="/">‹ Buscar lote</Link>
      <h1 className="screen-title">Registrar visita</h1>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">Fecha</span>
          <input
            className="control"
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Notas</span>
          <textarea
            className="control textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <fieldset className="field fieldset">
          <legend className="field-label">Próxima visita</legend>
          <div className="segmented">
            <label className="segment">
              <input type="radio" name="kind" checked={kind === 'interval'} onChange={() => setKind('interval')} />
              <span>En N días</span>
            </label>
            <label className="segment">
              <input type="radio" name="kind" checked={kind === 'date'} onChange={() => setKind('date')} />
              <span>En una fecha</span>
            </label>
            <label className="segment">
              <input type="radio" name="kind" checked={kind === 'none'} onChange={() => setKind('none')} />
              <span>Sin próxima</span>
            </label>
          </div>
          <div className="conditional-row">
            {kind === 'interval' && (
              <label className="field">
                <span className="field-label">Días</span>
                <input
                  className="control"
                  type="number"
                  min="1"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value))}
                />
              </label>
            )}
            {kind === 'date' && (
              <label className="field">
                <span className="field-label">Fecha próxima</span>
                <input
                  className="control"
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                />
              </label>
            )}
            {kind !== 'none' && (
              <label className="field">
                <span className="field-label">Avisar días antes</span>
                <input
                  className="control"
                  type="number"
                  min="0"
                  value={leadDays}
                  onChange={(e) => setLeadDays(Number(e.target.value))}
                />
              </label>
            )}
          </div>
        </fieldset>
        {error && <p className="alert" role="alert">{domainErrorMessage(error)}</p>}
        <button className="btn-primary" type="submit" disabled={submitting}>
          Registrar
        </button>
      </form>
    </main>
  );
```

Notas de preservación: los tres `<input type="radio">` siguen presentes y asociados a su label (el texto va en un `<span>` hermano) → `getByLabelText(/Sin próxima/)` sigue funcionando. `role="alert"` y el botón "Registrar" no cambian. Las labels "Fecha"/"Notas" siguen envolviendo su control (asociación implícita intacta).

- [ ] **Step 4: Agregar las clases de "Registrar visita" a `src/ui/styles.css`**

Anexar al final de `src/ui/styles.css`:

```css
/* ---- Registrar visita ---- */
.record { padding: var(--space-4); }

.back-link {
  display: inline-block;
  color: var(--accent);
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  margin-bottom: var(--space-2);
  min-height: var(--touch);
  line-height: var(--touch);
}

.form { display: flex; flex-direction: column; gap: var(--space-4); margin-top: var(--space-2); }

.field { display: flex; flex-direction: column; gap: var(--space-1); border: 0; padding: 0; margin: 0; }

.field-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.control {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  padding: 0 var(--space-3);
  min-height: var(--touch);
  font: inherit;
  color: var(--ink);
}

.control:focus { outline: none; border-color: var(--accent); }

.textarea { min-height: 88px; padding: var(--space-3); resize: vertical; }

.fieldset { gap: var(--space-2); }

/* control segmentado: radios ocultos accesiblemente + label como píldora */
.segmented {
  display: flex;
  background: var(--segment-bg);
  border-radius: var(--radius);
  padding: 3px;
}

.segment {
  flex: 1;
  position: relative;
  text-align: center;
}

/* radio oculto pero accesible (no display:none) */
.segment input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  margin: 0;
}

.segment span {
  display: block;
  padding: 9px 0;
  min-height: 40px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
}

/* píldora activa: patrón input:checked + span (sin :has) */
.segment input:checked + span {
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 700;
}

.segment input:focus-visible + span {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.conditional-row { display: flex; gap: var(--space-3); margin-top: var(--space-3); }
.conditional-row .field { flex: 1; }

.alert {
  margin: 0;
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--danger-bg);
  color: var(--danger);
  font-size: 13.5px;
}

.btn-primary {
  border: 0;
  background: var(--accent);
  color: var(--accent-ink);
  border-radius: var(--radius-lg);
  min-height: 48px;
  font: inherit;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}

.btn-primary:disabled { opacity: 0.6; cursor: default; }
```

- [ ] **Step 5: Verificar tests verdes (nuevos + existentes)**

Run: `npx vitest run tests/ui/record-visit-screen.test.tsx`
Expected: PASS — el back link nuevo y los existentes (registrar navega, error futuro muestra alerta en español, guards de NaN, atributos min).

Run: `npm test`
Expected: 103 tests verdes.

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Verificación visual + build**

Run: `npm run build`
Expected: build OK con el CSS incluido.

(Verificación visual manual: levantar la app y confirmar el look de ambas pantallas; los estilos no se testean unitariamente.)

- [ ] **Step 7: Commit**

```bash
git add src/ui/screens/RecordVisitScreen.tsx src/ui/styles.css tests/ui/record-visit-screen.test.tsx
git commit -m "feat(ui): style Registrar visita with back link and segmented follow-up"
```

---

## Self-Review

**Spec coverage:**
- Tokens + reset + import → Task 1. ✅
- Paleta Campo (todos los tokens del spec) → Task 1 `:root`. ✅
- Fuente del sistema → Task 1 `--font`/`body`. ✅
- Shell columna centrada máx 480px → Task 1 `.screen`. ✅
- Buscar lote: header sticky + buscador + ícono SVG + filas táctiles + chevron + divisores → Task 2. ✅
- Estado vacío → Task 2 (con guarda `query !== '' && !loading && results.length === 0`). ✅
- Registrar visita: back link + labels + control segmentado (radios preservados) + campos condicionales + botón + alert → Task 3. ✅
- Área táctil 44px → `--touch` en inputs/segment/botón/filas (56px). ✅
- Preservar nombres accesibles (h1, aria-label, links+href, labels, role=alert, botón) → notas en Tasks 2 y 3 + Global Constraints. ✅
- No tocar dominio/aplicación/infra/composición/hooks → solo `src/ui/**` + import en `main.tsx`. ✅
- Subtítulo del lote / modo oscuro / íconos reales → fuera de alcance (spec), no en el plan. ✅

**Placeholder scan:** sin TBD/TODO; todo el CSS y el JSX están completos.

**Type consistency:** clases usadas en el JSX (`screen`, `screen-title`, `search-header`, `search-box`, `search-icon`, `search-input`, `hint`, `empty`, `field-list`, `field-row`, `field-text`, `field-name`, `field-sub`, `chevron`, `back-link`, `form`, `field`, `field-label`, `control`, `textarea`, `fieldset`, `segmented`, `segment`, `conditional-row`, `alert`, `btn-primary`) están todas definidas en `styles.css` a través de las Tasks 1-3. El patrón `input:checked + span` coincide con el markup (input seguido de span dentro de `.segment`).

**Nota de conteo de tests:** el total sube de 100 → 103 (2 nuevos en Task 2, 1 en Task 3). Ajustar el número esperado si se corre parcialmente.

**Cierre de etapa (fuera de las tareas de código):** al mergear, actualizar `docs/ROADMAP.md` — marcar Etapa 1c completa y registrar el subtítulo del lote como ítem funcional diferido.
