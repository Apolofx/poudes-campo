# Plan: FAB con dos acciones (Registrar / Programar)

**Rama:** `fab-registrar-visita`
**Problema:** Desde Inicio no hay acceso directo a "Registrar visita" para un lote sin visita programada. El FAB solo programa. La única ruta es Buscar → lote → historial → registrar (3 pasos).

## Solución

SpeedDial: el FAB al tocar expande dos botones flotantes con labels ("Registrar visita" / "Programar visita"). Click fuera cierra.

## Archivos a modificar/crear

| Archivo | Acción |
|---|---|
| `src/ui/components/SpeedDial.tsx` | **Crear** — componente reutilizable |
| `src/ui/styles.css` | **Editar** — agregar estilos `.speed-dial` |
| `src/ui/screens/AgendaScreen.tsx` | **Editar** — reemplazar `<Link class="fab">` por `<SpeedDial>` |
| `tests/ui/speed-dial.test.tsx` | **Crear** — tests del componente |
| `tests/ui/agenda-screen.test.tsx` | **Editar** — adaptar tests que asumen el FAB viejo |

## Tareas (TDD)

### T1 — Tests del SpeedDial
Crear `tests/ui/speed-dial.test.tsx`:
- [ ] Renderiza el FAB principal con aria-label
- [ ] Al clickear el FAB, aparecen los dos actions ("Registrar visita" / "Programar visita")
- [ ] Cada action tiene el href correcto (`/registrar`, `/programar`)
- [ ] Al clickear fuera (click en backdrop), el menú se cierra
- [ ] Al tocar Escape, el menú se cierra
- [ ] El FAB principal rota el icono cuando está abierto
- [ ] `aria-expanded` refleja el estado

### T2 — Implementar SpeedDial
Crear `src/ui/components/SpeedDial.tsx`:
- Props: `actions: Array<{ label: string; to: string; icon: ReactNode }>`, `ariaLabel: string`
- Estado: `open` (boolean)
- Click en FAB principal → toggle `open`
- Click en backdrop (div overlay transparente, `position: fixed; inset: 0`) → cierra
- Keydown Escape → cierra
- Cada action es un `<Link>` con icono + label visible
- FAB principal muestra `X` cuando abierto, icono original cuando cerrado

### T3 — CSS del SpeedDial
En `src/ui/styles.css`, agregar:
- `.speed-dial` — contenedor del FAB principal (reapura posición de `.fab`)
- `.speed-dial-actions` — contenedor de los actions, `position: absolute`, bottom +56px, flex column con gap
- `.speed-dial-action` — cada action: chip con label + icono, animación de apertura (opacity + translateY)
- `.speed-dial-backdrop` — overlay transparente para click-outside
- Transiciones suaves (150-200ms)

### T4 — Integrar en AgendaScreen
Editar `src/ui/screens/AgendaScreen.tsx`:
- Importar `SpeedDial`
- Reemplazar el `<Link className="fab" to="/programar">` por:
  ```tsx
  <SpeedDial
    actions={[
      { label: 'Registrar visita', to: '/registrar', icon: <ClipboardPlus /> },
      { label: 'Programar visita', to: '/programar', icon: <CalendarPlus /> },
    ]}
    ariaLabel="Acciones de visita"
  />
  ```
- Agregar import de `ClipboardPlus` de lucide-react

### T5 — Adaptar tests de AgendaScreen
Editar `tests/ui/agenda-screen.test.tsx`:
- Test "muestra el FAB para programar cuando hay visitas" → ahora busca el botón principal del SpeedDial, no un link a `/programar`
- Test "muestra estado vacío..." → ajustar assertion del FAB (ya no es un link directo)
- Verificar que los tests existentes pasan con la nueva implementación

## No se toca

- `src/domain/**`, `src/application/**` — sin cambios
- La funcionalidad de programar/registrar no cambia, solo la UI de acceso

## Verificación

```bash
npm test
npm run typecheck
```
