# Etapa 2 — Panel de urgencia (Inicio / agenda) — diseño

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para plan de implementación
**Depende de:** Etapa 1c (UI React con estilo, 2 pantallas, 103 tests). Mergeada en `main`.

## Objetivo

Darle al agrónomo la **otra mitad del propósito** del producto: no solo registrar visitas, sino **saber cuándo volver**. Se agrega una pantalla **Inicio** que es la nueva de arranque: lista las **próximas visitas ordenadas por urgencia**, con lo vencido/inminente arriba e imposible de ignorar, para que ningún lote se escape. Buscar lote pasa a ser el segundo destino (para llegar a cualquier lote, tenga o no visita agendada).

**Regla dura del proyecto:** ningún dato de dosis/agroquímicos entra al sistema. Acá no aplica directamente (no se agregan campos de ese tipo), pero se respeta.

## Cambios conscientes respecto del ROADMAP

El roadmap describía la Etapa 2 como "semáforo/urgencia **por zona**, **proporcional al intervalo** del lote". El brainstorming (pensando como el agrónomo, con companion visual) lo reencuadró en dos puntos, asentados acá:

1. **La zona no es la estructura fija; el agrupamiento es dinámico.** Lo primario es la lista ordenada por urgencia. Zona/Cliente son vistas alternativas (un toggle), no la columna vertebral. (Aclaración de dominio: "Zona" = paraje / agrupador local con sentido para el usuario, ej. "El Séptimo" — no punto cardinal.)
2. **La urgencia se mide absoluta (cuándo vence), no proporcional al intervalo.** El agrónomo ya fijó la fecha al registrar; esa fecha *es* la promesa. Lo proporcional era una inteligencia invisible y difícil de explicar en la fila. Consecuencia técnica linda: **la urgencia ya no necesita `interval`**, solo `nextVisitDate` y `now`.

## Decisiones de diseño (cerradas una por una, con companion visual)

1. **Forma — pantalla Inicio nueva, landing.** El panel es una pantalla propia que pasa a ser la de arranque. Descartados: bloque arriba de Buscar (mezcla dos propósitos) y lista actual reordenada (diluye el semáforo lote por lote).
2. **Representación — triage por horizonte temporal, no semáforo plano.** Secciones **Vencidas** / **Esta semana** / **Más adelante** (colapsado). El semáforo plano trataba igual una vencida y un "en 31 d" (mismo peso, scroll largo de verdes). El triage pone lo accionable arriba y colapsa lo lejano.
3. **Urgencia absoluta con 3 buckets.** `daysUntil = díasCalendario(now → nextVisitDate)`:
   - `daysUntil < 0` → **OVERDUE** (Vencidas)
   - `0 ≤ daysUntil ≤ 7` → **THIS_WEEK** (Esta semana)
   - `daysUntil > 7` → **LATER** (Más adelante)
   El umbral `THIS_WEEK_DAYS = 7` es constante del dominio.
4. **Fila = nombre + "cliente · zona" + fecha relativa.** El color queda como **acento de "vencida"**, no como único código (accesibilidad + uso al sol). La fecha relativa ("hace 5 d / hoy / en 2 d") es el dato preciso, derivada de `daysUntil`.
5. **Agrupamiento dinámico por toggle "Agrupar por".** Opción por defecto **Tiempo** (= secciones por horizonte). Alternativas **Zona** / **Cliente** (modo "armar recorrido"): re-agrupan la misma lista, y dentro de cada grupo los lotes van ordenados por urgencia con el acento rojo marcando vencidas. Nunca dos niveles anidados: son tres formas de mirar la misma lista.
6. **"Más adelante" colapsado** en un resumen ("N lotes · próximo en X d"), expandible en el lugar. Para ver el rebaño completo está Buscar.
7. **Navegación — barra de pestañas abajo (`Inicio` · `Buscar`).** Patrón PWA clásico, Buscar siempre al alcance del pulgar y descubrible. Descartado el ícono de lupa en el header (menos descubrible). Tocar un lote (en Inicio o Buscar) lleva a Registrar visita.
8. **Íconos — `lucide-react`.** SVG tree-shakeable, sin red en runtime (offline/PWA), MIT. Reemplaza también el SVG de lupa dibujado a mano del buscador.

## Qué lotes aparecen en Inicio (borde)

Inicio muestra **solo lotes con próxima visita agendada**: la última visita activa (por `createdAt`) del field que **tiene** `followUp`. Si el agrónomo cerró la última con "sin próxima", o el lote nunca se visitó, no tiene próxima visita → **no aparece** en Inicio. Ese invariante ya lo mantiene `RecordVisit` (registrar una visita cancela pendientes previos y crea follow-up solo si corresponde). Para registrarle una visita a un lote sin agenda, se llega por Buscar.

## Arquitectura (hexagonal — todo apunta al dominio)

Esta etapa **sí toca `domain/` y `application/`** (autorizado explícitamente por el usuario para la Etapa 2). **No** modifica entidades (`Visit`, `Reminder`, `Field`) ni el caso de uso `RecordVisit`.

### 1. Dominio — VO `VisitUrgency` (puro, al vuelo, nunca persistido)

`src/domain/value-objects/visit-urgency.ts`

```ts
export type UrgencyBucket = 'OVERDUE' | 'THIS_WEEK' | 'LATER';

export class VisitUrgency {
  private constructor(
    readonly daysUntil: number,   // < 0 vencida, 0 hoy, > 0 futura (días calendario)
    readonly bucket: UrgencyBucket,
  ) {}

  static of(nextVisitDate: Date, now: Date): VisitUrgency {
    const daysUntil = daysBetween(now, nextVisitDate); // reusa domain/shared/date-utils
    const bucket = daysUntil < 0 ? 'OVERDUE'
                 : daysUntil <= THIS_WEEK_DAYS ? 'THIS_WEEK'
                 : 'LATER';
    return new VisitUrgency(daysUntil, bucket);
  }
}
```

Depende solo de `nextVisitDate` y `now`. Nunca se persiste; se calcula en cada lectura.

### 2. Puerto — de dónde sale la "próxima visita" de cada lote

Se agrega una **query de lectura** al `VisitRepository` existente (no un puerto nuevo):

```ts
findCurrentFollowUps(): Promise<CurrentFollowUp[]>;
// CurrentFollowUp = { fieldId: FieldId; nextVisitDate: Date }
// Por field: su última visita ACTIVA por createdAt; si tiene followUp, emite { fieldId, nextVisitDate }.
// Si la última activa no tiene followUp (o el field no tiene visitas activas), el field no se emite.
```

La implementan **ambos adaptadores** con el mismo contrato: `in-memory` (tests) e `idb`.

### 3. Aplicación — caso de uso `ListUpcomingVisits`

`src/application/use-cases/list-upcoming-visits.ts` — deps: `VisitRepository`, `FieldRepository`, `Clock`.

```ts
async execute(): Promise<UpcomingVisit[]> {
  const followUps = await visits.findCurrentFollowUps();
  const hierarchy = await fields.listAllWithHierarchy(); // ya existe: field + clientName + zoneName
  const now = clock.now();
  // join por fieldId; VisitUrgency.of(nextVisitDate, now)
  // devuelve lista PLANA ordenada por daysUntil asc
}
// UpcomingVisit = { field: Field; clientName: string; zoneName: string;
//                   nextVisitDate: Date; urgency: VisitUrgency }
```

**Decisión clave: el agrupamiento/seccionado vive en la UI, no en el caso de uso.** El caso de uso devuelve la lista plana ordenada por urgencia; la UI la secciona por horizonte (Tiempo) o la agrupa por Zona/Cliente según el toggle. Mantiene dominio/app puros y la UI libre de recomponer sin tocar lógica. Descartada la alternativa de agrupar en el caso de uso (mete presentación en aplicación).

### 4. UI — shell nuevo + pantalla Inicio

- **Routing**: `/` → `AgendaScreen` (Inicio) · `/buscar` → `SearchScreen` (se muda de `/`) · `/field/:id/record` → `RecordVisitScreen` (sin cambios).
- **`TabBar`** (Inicio · Buscar) como layout persistente, íconos `lucide-react` (`Home`, `Search`).
- **`AgendaScreen`** + hook `use-agenda`: consume `ListUpcomingVisits`; estado local del toggle (Tiempo/Zona/Cliente) y del colapso de "Más adelante". El seccionado/agrupado es función pura de presentación sobre la lista plana. Estado vacío ("No hay visitas agendadas.") cuando la lista viene vacía.
- Reemplazo del SVG de lupa a mano en `SearchScreen` por ícono de lucide.

## Alcance y límites

- **Se agrega:** VO `VisitUrgency`, método `findCurrentFollowUps` en el puerto + los 2 adaptadores, caso de uso `ListUpcomingVisits`, wiring en el container, `AgendaScreen` + `use-agenda`, `TabBar`, ajuste de routing en `App`, dependencia `lucide-react`, estilos nuevos en `styles.css`.
- **NO se toca:** entidades `Visit`/`Reminder`/`Field`, `RecordVisit`, `SearchFields`, `field-search`. La lógica existente queda idéntica.
- **Los 103 tests existentes deben seguir verdes.** El único cambio que puede afectarlos es la mudanza de Buscar de `/` a `/buscar`: revisar y ajustar los tests de routing/navegación que asuman que `/` es Buscar.

## Testing (TDD)

- **Dominio — `VisitUrgency`:** bordes de bucket — vencida (`daysUntil < 0` → OVERDUE), hoy (`0` → THIS_WEEK), día 7 (→ THIS_WEEK), día 8 (→ LATER); signo correcto de `daysUntil`.
- **Aplicación — `ListUpcomingVisits`:** join field+jerarquía; orden por `daysUntil` asc; excluye fields sin follow-up; excluye visitas canceladas; toma la última activa por `createdAt`; última con "sin próxima" → field excluido; lista vacía → `[]`.
- **Infra:** `findCurrentFollowUps` en `in-memory` y en `idb` (mismo contrato; misma batería de casos que aplicación en cuanto a "última activa / sin followUp / cancelada").
- **UI:** `AgendaScreen` — render de secciones por horizonte; toggle de agrupamiento (Tiempo→Zona→Cliente) recompone; colapso/expansión de "Más adelante"; estado vacío. Navegación por `TabBar` (Inicio ↔ Buscar; tocar lote → Registrar).
- **Guardia:** `npm test` + `npm run typecheck` verdes. Verificación visual con `npm run build` + screenshot de Inicio.
- **Accesibilidad:** contraste ≥ 4.5:1 (ojo con el verde y con el rojo de vencidas sobre fondo); el color nunca es el único portador de significado (la sección y la fecha relativa lo son).

## Fuera de alcance (diferido, con motivo)

- **Aviso al abrir la app** (notificación de vencimientos): es la **Etapa 3** (`DispatchDueReminders`, PENDING→SENT). Inicio *muestra* la urgencia; no *dispara* avisos.
- **Cancelar/editar visitas y ABM de catálogo:** Etapa 4.
- **Validación de `reminderLeadDays`:** sigue diferida a Etapa 3 (Inicio no usa `remindAt`, usa `nextVisitDate`).
- **Borde de timezone (medianoche-UTC):** sin cambios; el usuario objetivo es UTC-3 (oeste), no afectado. Atado a revisar la comparación de día-calendario del dominio.
- **Modo oscuro:** sigue tema claro único (los mockups eran oscuros solo por el companion).
- **Umbral "Esta semana" configurable:** fijo en 7 días por ahora (YAGNI).
