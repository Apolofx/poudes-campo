# AGENTS.md — cómo trabajar en Campo

Guía para agentes de IA (y humanos nuevos) que trabajan en este repo. Convenciones durables + mapa de documentos. **No** duplica el backlog ni las decisiones de diseño — para eso, seguí los punteros.

## Qué es Campo

PWA offline-first para un asesor agronómico que recorre ~40 lotes: **registrar visitas y saber cuándo volver**. Arquitectura hexagonal, TypeScript. Herramienta privada de un solo usuario, sin backend todavía (los datos viven en el dispositivo, IndexedDB).

**Estado, roadmap y backlog → `docs/ROADMAP.md`** (fuente única de verdad). Leerlo antes de trabajar sobre etapas.

## Reglas duras (no negociables)

1. **Ningún dato de dosis / agroquímicos / prescripciones entra jamás al sistema.** Ni entidades, ni campos, ni UI, ni fixtures. Es una restricción de producto, no una preferencia.
2. **No tocar `src/domain/**` ni `src/application/**`** salvo intención explícita del usuario. Son el núcleo puro, ya cubierto por tests. Si una tarea parece requerir cambiarlos, frenar y consultar.
3. **Conversación en español, código e identificadores en inglés.** El texto visible al usuario (UI) va en español.

## Arquitectura (hexagonal / puertos y adaptadores)

Regla de dependencias: **todo apunta hacia el dominio; el dominio no conoce infraestructura.**

```
src/
  domain/         # entidades, value objects, servicios, puertos (ports/outbound), errores. PURO, sin infra.
  application/    # casos de uso (SearchFields, RecordVisit). Orquesta el dominio vía puertos.
  infrastructure/ # adaptadores: persistence/idb (IndexedDB), persistence/in-memory (tests), clock, id.
  composition/    # composition root (container) + seed. Arma el grafo real.
  ui/             # React: CampoProvider (Context), hooks finos, pantallas, routing. Adaptador reemplazable.
  main.tsx        # entry: abre db → seed → build container → render.
tests/            # Vitest. Espeja src/. Doubles en tests/support/. UI tests en tests/ui/ (jsdom).
```

- Los **puertos** (`domain/ports/outbound`) definen contratos; los adaptadores idb e in-memory los implementan con el mismo contrato.
- La **UI** consume los casos de uso vía Context + hooks; el router es tonto; los errores de dominio se capturan en estado y se muestran como texto en español (nunca se lanzan al usuario).
- **IDs**: UUIDv7 en cliente vía puerto `IdGenerator` (offline-first). **Tiempo**: vía puerto `Clock` (inyectable en tests con `FixedClock`).

## Comandos

```bash
npm test           # Vitest (toda la suite) — debe quedar verde antes de commitear
npm run typecheck  # tsc --noEmit — sin errores
npm run dev        # Vite dev server
npm run build      # build de producción (genera PWA: sw.js + manifest)
```

Correr un test puntual: `npx vitest run tests/ruta/al.test.ts`.

## Cómo trabajamos (flujo confirmado)

- **Brainstorming técnico antes de código, una decisión por vez.** Presentar opciones con contrapartidas y una recomendación fundada; frenar y esperar. Cuestionar el PRD/documento en vez de asumir que tiene razón. No sobre-ingenierizar (YAGNI explícito).
- **Por etapa**: brainstorming → spec (`docs/superpowers/specs/`) → plan con código completo y pasos TDD checkbox (`docs/superpowers/plans/`) → ejecución (subagent-driven-development) → merge a `main`.
- **Cada etapa en su propia rama**; merge a `main` al terminar (repo git local, sin remoto).
- **TDD estricto**: test que falla → verlo fallar → implementación mínima → verde → commit. Commits frecuentes.
- Actualizar `docs/ROADMAP.md` al cerrar cada etapa.

## Mapa de documentos

| Necesitás… | Mirá… |
|---|---|
| Estado actual, roadmap, backlog, deuda diferida | `docs/ROADMAP.md` |
| Diseño detallado de una etapa (por qué de cada decisión) | `docs/superpowers/specs/` |
| Plan de implementación de una etapa (tareas TDD + código) | `docs/superpowers/plans/` |
| Convenciones y cómo trabajar | este archivo |
