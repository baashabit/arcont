# Orquestacion PC1 / PC2

Este archivo define la forma obligatoria de trabajo entre `PC1 (Luis)` y `PC2 (Antonio)` para que ambos produzcan en paralelo sin retrabajo.

## Regla Base

- siempre trabajar sobre `main`
- nunca abrir ramas nuevas para tareas normales
- nunca tocar el mismo archivo en el mismo ciclo de trabajo
- cada ciclo paralelo debe dividirse por `ruta + responsabilidad`
- antes de reasignar, PC1 concilia y redefine el siguiente paquete

## Metodo De Produccion En Paralelo

Cada ciclo se divide en dos carriles:

1. `Carril source/capture`
   - crea, edita o aterriza captura operativa
   - formularios
   - validaciones locales
   - continuidad de alta
   - empty states accionables

2. `Carril control/continuation`
   - consume señales de otros modulos
   - arma lectura ejecutiva u operativa
   - crea tableros, blackboards, prioridades y handoffs
   - enlaza follow-ups hacia modulos fuente

La regla es simple: `PC1 produce origen operativo` y `PC2 produce capa de continuidad/accion` sobre otro archivo.

## Protocolo Por Ciclo

1. elegir un vertical util
2. separar archivos exclusivos por PC
3. definir contrato de integracion entre ambos
4. ejecutar builds por separado
5. sincronizar cambios a `main`
6. validar nuevamente y reasignar el siguiente ciclo

## Contrato Obligatorio Por Tarea

Cada tarea paralela debe incluir:

- objetivo funcional
- archivo exacto permitido
- archivos prohibidos
- modulos con los que debe enlazar
- criterio de terminado
- comando de validacion

Si una tarea no cumple eso, no se asigna.

## Paquete Activo

Vertical actual: `cost-control + cash-flow liquidity`

### PC1 Luis

- carril: `source/control`
- modulo: `/cost-control`
- archivo permitido:
  - `frontend/arcont-suite/app/cost-control/page.tsx`
- enfoque:
  - convertir la partida prioritaria en una mesa de desviación, compra y exposición de cobro
  - reforzar la decisión de adjudicar, bloquear o volver a cotizar con restricciones existentes
  - enlazar compras, flujo de efectivo, finanzas y proyecto sin duplicar el contexto

### PC2 Antonio

- carril: `control/continuation`
- modulo: `/cash-flow`
- archivo permitido:
  - `frontend/arcont-suite/app/cash-flow/page.tsx`
- enfoque:
  - convertir la corriente seleccionada en una mesa de liquidez semanal con entradas, salidas y cobertura
  - priorizar la ruta de tesorería, CXP, proveedores o finanzas según la presión real
  - validar en Chrome PC2 los flujos e idiomas antes de conciliar

## Archivos Prohibidos En Este Ciclo

### PC1 no toca

- `frontend/arcont-suite/app/cash-flow/page.tsx`
- `docs/coordination/antonio-live-task.txt`

### PC2 no toca

- `frontend/arcont-suite/app/cost-control/page.tsx`
- `docs/coordination/luis-live-task.txt`

## Contrato De Integracion Entre Ambos

- `cost-control` debe exponer la partida accionable:
  - presupuesto, pronóstico, desviación y exposición de cobro
  - estado de compra, restricciones y siguiente acción de recuperación
  - enlaces a compras, proyecto y flujo de efectivo
- `cash-flow` debe consumir presión financiera como trabajo accionable:
  - caja inicial, entradas, salidas, neto semanal y cobertura
  - prioridad, siguiente paso humano y acciones de tesorería
  - módulo destino para resolver CXP, proveedores o finanzas

No se requiere tocar backend en este ciclo. La integracion es de experiencia y flujo usando endpoints ya existentes.

## Validacion Minima

Cada PC debe ejecutar:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 24
npx tsc --noEmit && npm run lint
```

`npm run build` es complementario: puede depender de fuentes externas y no debe bloquear la validación del código si la red de PC2 no está disponible.

## Cierre Del Ciclo

Antes de mover al siguiente vertical:

- validar build en PC1
- validar build en PC2
- conciliar contra `main`
- revisar que no hayan tocado el mismo archivo
- dejar nuevo paquete paralelo ya asignado

## Siguiente Vertical Sugerido

Después de este ciclo:

- `PC1`: `estimations` para control de avance valorizado, evidencia y cobro de estimación
- `PC2`: `subcontracts` para alta, control contractual, entregables y continuidad de proveedor

Ese siguiente ciclo mantiene el mismo patron:

- PC1 produce fuente operativa
- PC2 produce continuidad y control cruzado
