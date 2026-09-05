# Plan: Banner de actualización + versionado semver

**Rama:** `update-banner`
**Problema:** Cuando el service worker instala una nueva versión, el usuario no se entera. No hay feedback visual.

## Solución

Banner informativo que aparece al detectar que el SW se actualizó, mostrando la versión y un resumen de cambios. La versión viene de `package.json` (semver); el changelog se genera automáticamente al buildear parseando conventional commits del git log.

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `package.json` | **Editar** — agregar `"version": "0.1.0"` |
| `scripts/gen-changelog.js` | **Crear** — parsea git log, extrae conventional commits, escribe changelog al stdout |
| `vite.config.ts` | **Editar** — `define` inyecta `__APP_VERSION__` y `__CHANGELOG__` desde package.json + script |
| `src/ui/hooks/useSWUpdate.ts` | **Crear** — hook que escucha `controllerchange` y retorna `{ updated, dismiss }` |
| `src/ui/components/UpdateBanner.tsx` | **Crear** — banner informativo, estilo como `InstallBanner` |
| `src/ui/App.tsx` | **Editar** — agregar `<UpdateBanner />` en `TabsLayout` |
| `src/ui/styles.css` | **Editar** — agregar `.update-banner` (mismo patrón que `.install-banner`) |
| `tests/ui/update-banner.test.tsx` | **Crear** — tests del hook y componente |
| `.gitignore` | **Editar** — ignorar `src/changelog.json` (generado en build) |

## Decisiones de diseño

- **Versión**: `package.json` → `version` field (semver). Inyectada al bundle via Vite `define` como `__APP_VERSION__`.
- **Changelog**: generado al build por `scripts/gen-changelog.js`. Parsea `git log --oneline` desde el último tag `v*` (o últimos 20 commits si no hay tags). Extrae type/scope/description de conventional commits. Se inyecta como `__CHANGELOG__` (array de strings).
- **Detección de update**: hook `useSWUpdate` escucha `controllerchange` en `navigator`. Cuando dispara, setea `updated = true`.
- **Banner**: aparece arriba del contenido (mismo patrón que `InstallBanner`). Muestra "Campo se actualizó a vX.Y.Z" + lista de cambios. Botón X para cerrar. Solo informativo, no recarga.
- **Auto-update sigue activo**: el SW se aplica silenciosamente; el banner es solo notificación.

## Tareas (TDD)

### T1 — Version en package.json + gen-changelog script
- [ ] Agregar `"version": "0.1.0"` a `package.json`
- [ ] Crear `scripts/gen-changelog.js`:
  - Ejecuta `git log --oneline` desde último tag `v*` (o HEAD~20)
  - Parsea `<type>(<scope>): <description>`
  - Filtra solo `feat` y `fix` (skip `style`, `chore`, etc.)
  - Output JSON: `{ version: "0.1.0", entries: ["feat(ui): speed dial...", "fix(ui): borde..."] }`
  - Si no hay commits relevantes, output `{ version, entries: [] }`

### T2 — Vite define + tests del script
- [ ] Test del script gen-changelog: mockear `git log`, verificar output JSON
- [ ] En `vite.config.ts`, agregar `define: { __APP_VERSION__: ..., __CHANGELOG__: ... }`
- [ ] Tipar `__APP_VERSION__` y `__CHANGELOG__` en un `src/vite-env.d.ts` o augmentación de `ImportMeta`

### T3 — Hook useSWUpdate
- [ ] Tests: simular `controllerchange`, verificar `updated = true`; test de `dismiss`
- [ ] Implementar hook:
  ```ts
  export function useSWUpdate() {
    const [updated, setUpdated] = useState(false);
    useEffect(() => {
      const onControllerChange = () => setUpdated(true);
      navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
      return () => navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
    }, []);
    const dismiss = useCallback(() => setUpdated(false), []);
    return { updated, dismiss };
  }
  ```

### T4 — UpdateBanner component
- [ ] Tests: renderiza versión y changelog cuando `updated=true`; no renderiza cuando `false`; click en X llama `dismiss`
- [ ] Implementar componente:
  - Muestra `__APP_VERSION__` y `__CHANGELOG__` (los defines de Vite)
  - Mismo estilo que `InstallBanner` (fijo arriba, dismissable)
  - aria-live="polite" para accesibilidad

### T5 — Integrar en App + CSS
- [ ] Agregar `<UpdateBanner />` en `TabsLayout` de `App.tsx`, al lado de `<InstallBanner />`
- [ ] CSS `.update-banner` — mismo patrón que `.install-banner`, con color de acento para diferenciar
- [ ] `npm test` y `npm run typecheck` pasan

### T6 — Build script
- [ ] `package.json` scripts: `"prebuild": "node scripts/gen-changelog.js"`, el script escribe `src/changelog.json`
- [ ] `.gitignore`: agregar `src/changelog.json`
- [ ] `vite.config.ts`: `define` lee de `src/changelog.json` generado

## Verificación

```bash
npm test
npm run typecheck
npm run build  # debe generar changelog.json y completar el build
```
