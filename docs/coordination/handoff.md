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

Vertical actual: `equipment + field continuity`

### PC1 Luis

- carril: `source/capture`
- modulo: `/equipment`
- archivo permitido:
  - `frontend/arcont-suite/app/equipment/page.tsx`
- enfoque:
  - mejorar control de activos y despacho real por frente
  - reforzar alta/edicion con continuidad hacia field, inventory y quality
  - hacer que el modulo sirva para operar maquinaria, no solo para verla

### PC2 Antonio

- carril: `control/continuation`
- modulo: `/field`
- archivo permitido:
  - `frontend/arcont-suite/app/field/page.tsx`
- enfoque:
  - convertir field en la continuidad directa entre ejecucion, maquinaria y materiales
  - consumir señales existentes y priorizar seguimiento hacia equipment, daily-log, requisitions y receiving
  - mejorar practicidad, lectura y accion inmediata para pruebas humanas

## Archivos Prohibidos En Este Ciclo

### PC1 no toca

- `frontend/arcont-suite/app/field/page.tsx`
- `docs/coordination/antonio-live-task.txt`

### PC2 no toca

- `frontend/arcont-suite/app/equipment/page.tsx`
- `docs/coordination/luis-live-task.txt`

## Contrato De Integracion Entre Ambos

- `equipment` debe exponer continuidad operativa clara:
  - readiness de despacho
  - bloqueos de mantenimiento o fallas
  - siguiente accion
  - enlaces a seguimiento
- `field` debe consumir esas señales como trabajo accionable:
  - frente afectado
  - restriccion operativa
  - owner o siguiente responsable
  - modulo destino

No se requiere tocar backend en este ciclo. La integracion es de experiencia y flujo usando endpoints ya existentes.

## Validacion Minima

Cada PC debe ejecutar:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20
npm run build:web
```

Si el build falla, no se concilia.

## Cierre Del Ciclo

Antes de mover al siguiente vertical:

- validar build en PC1
- validar build en PC2
- conciliar contra `main`
- revisar que no hayan tocado el mismo archivo
- dejar nuevo paquete paralelo ya asignado

## Siguiente Vertical Sugerido

Despues de este ciclo:

- `PC1`: `accounts-payable` para continuidad factura -> liberacion -> tesoreria
- `PC2`: `treasury/payment-runs` para control final de salida financiera

Ese siguiente ciclo mantiene el mismo patron:

- PC1 produce fuente operativa
- PC2 produce continuidad y control cruzado
