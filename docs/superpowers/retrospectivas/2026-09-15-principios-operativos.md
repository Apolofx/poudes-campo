# Principios operativos — lecciones de una retrospectiva transferible

> Retrospectiva del intento de refactor `refactor/ui-tailwind-shadcn` (archivada en `main`,
> nunca mergeada). La historia completa quedó como caso de estudio; esto es la destilación
> **genérica**: reglas que aplican a cualquier feature, implementación o refactor futuro,
> no solo a la migración de UI que las originó.

Propósito: que los errores de ese intento **no se repitan**. Cada principio es una regla
operativa con su *señal de peligro* (cómo detectarla temprano) y su *regla correcta*.

---

## Los 5 principios

### P1 — El criterio de "hecho" debe medir el atributo que el usuario evalúa, no un proxy

**Origen:** la suite validaba roles ARIA (`getByRole`) y quedó verde con la estética
destruida. Verde no significaba "se ve bien": medimos un proxy de accesibilidad para un
deliverable 100% visual.

- **Señal de peligro:** "los tests pasan pero no se ve bien" — el test está validando
  algo distinto de lo que el usuario va a juzgar.
- **Regla correcta:** antes de empezar, definir EXPLÍCITAMENTE el atributo de éxito
  (estética → revisión visual humana; datos → valor correcto; flujo → recorrido real) y
  que la verificación principal sea de ese atributo. El proxy (rol, presencia, tipo)
  complementa, no sustituye.

### P2 — Un contrato global se retira al FINAL, cuando el último consumidor migró y se verificó

**Origen:** se borró `styles.css` (hoja global de 1155 líneas) cuando los *screens*
migrados ya no la usaban — pero los **componentes compartidos** sí. Borrar el contrato se
trató como paso intermedio de "limpieza" y era un milestone de cierre.

- **Señal de peligro:** "ya no lo usa casi nadie" como justificación para retirar algo
  compartido. Basta UN consumidor vivo para que el retiro sea romper el sistema.
- **Regla correcta:** un global (hoja CSS, schema, adapter, función compartida) se
  elimina solo como **milestone final**, con auditoría de **cero referencias** y revisión
  del impacto global completo — nunca como "ofertón" a mitad de camino.

### P3 — Paralelizar solo sobre cortes disjuntos del grafo de dependencias

**Origen:** 4 agentes por pantalla en paralelo, pero todas las pantallas comparten un
substrato global. Cada uno editaba sobre una foto que los demás invalidaban → commits que
se pisaban y estilos que "no eran de nadie".

- **Señal de peligro:** dos tareas paralelas pueden tocar el mismo archivo/contrato
  (directa o transitivamente).
- **Regla correcta:** el paralelismo es seguro solo si el corte es **disjunto**. Los
  nodos compartidos de la arquitectura se hacen **en serie, uno a la vez, con revisión
  entre cada uno**. Si no podés probar que no hay superposición, no paralelicés.

### P4 — Versioná el "antes" observable junto al plan

**Origen:** nunca se capturó cómo se veía la app antes de migrarla. Sin baseline, ningún
ejecutor (ni el orquestador) tenía un estándar objetivo de "bien" — la única tarjeta de
aceptación era un rol que pasa.

- **Señal de peligro:** podés describir "cómo era" pero no tenés eso guardado como
  artefacto versionado junto con el plan.
- **Regla correcta:** todo refactor/reescritura arranca con el **estado actual
  congelado** (captura de pantalla, fixture de datos, snapshot de salida) versionado junto
  al plan. La meta es "igual al baseline, salvo el cambio intencional".

### P5 — Nunca obres (revert/commit) sobre una medición no replicable

**Origen:** un test de integración fallaba en paralelo pero pasaba en aislamiento. Sobre
esa señal no reproducible se tomaron decisiones de revert a ciegas → baile de ida y vuelta
que empeoró el estado.

- **Señal de peligro:** una corrida da un resultado que no podés reproducir aislado.
- **Regla correcta:** si la medición no es replicable, primero se **aisla/investiga el
  test** (es flaky, es timing, es estado sucio) y solo entonces se decide. Y en todo
  momento hay **un único punto de verdad del estado**: lo que dice el disco (git status,
  archivo existe, import activo), no lo que se reporta de memoria.

---

## Checklist pre-mortem (correr ANTES de empezar cualquier trabajo)

1. ¿Cuál es el atributo de éxito que va a juzgar el usuario, y dónde queda explícito? (P1)
2. ¿Está versionado el "antes" observable (baseline)? (P4)
3. ¿Qué contratos compartidos toca esto, y cuál es el plan para NO retirarlos a mitad de camino? (P2)
4. ¿Puedo probar que las tareas paralelas no comparten dependencias? Si no, van en serie. (P3)
5. ¿Cómo sé, al final, que no rompí nada fuera del cambio intencional — con verificación del atributo real, no solo del proxy? (P1)
6. ¿Tengo un único punto de verdad del estado y una regla de "no revertir sobre flaky"? (P5)

El trabajo no está "hecho" hasta que el **attributo que el usuario evaluá** está verificado,
en el estado real (no en memoria), con el global intacto salvo el cambio intencional.

---

## Caso de estudio (breve)

Migración de UI del proyecto (rama `refactor/ui-tailwind-shadcn`, archivada). Fue el
escenario que originó estos principios: suite verde con estética rota, borrado prematuro de
`styles.css`, paralelismo sobre componentes compartidos, sin baseline visual, y reversas
sobre un test flaky. Al enfrentar cualquiera de esas señales hoy, aplicá el principio
correspondiente en vez de repetir el movimiento.
