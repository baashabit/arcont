# Viviend System Audit

Fecha de revisión: 2026-04-09

Alcance revisado:
- `https://viviend.mx/sistema/login`
- `https://viviend.mx/sistema/blackboard`
- `https://viviend.mx/sistema/proyectos`
- `https://viviend.mx/sistema/prospectos`
- `https://viviend.mx/sistema/usuarios`
- `https://viviend.mx/sistema/requisicion`

Credenciales usadas para revisión:
- Usuario: `admin`
- Rol recibido al autenticar: `1`

## 1. Resumen ejecutivo

El sistema ya contiene lógica de negocio útil y no es un panel pequeño. En la navegación actual conviven al menos:
- ventas,
- inventario de vivienda,
- prospectos,
- gestoría y titulación,
- catálogos,
- reportes,
- mano de obra,
- materiales,
- requisiciones.

El principal problema no parece ser la falta de módulos, sino la forma en que están presentados y acoplados. La interfaz, la seguridad visible, la estructura front-end y la deuda técnica hacen que el producto se perciba y opere como un sistema legacy. Eso limita:
- confianza de clientes internos,
- mantenibilidad,
- velocidad para agregar funciones,
- experiencia móvil,
- gobierno y seguridad.

## 2. Hallazgos prioritarios

## 2.1 Seguridad y hardening

### Hallazgo 1
La cookie de sesión observable en `https://viviend.mx/sistema/login` se envía con `HttpOnly`, pero no muestra flags `Secure` ni `SameSite` en la respuesta inspeccionada.

Impacto:
- menor protección frente a ciertos vectores de sesión y navegación cruzada,
- postura de seguridad por debajo de estándar moderno.

## 2.2 Front-end legacy y riesgo operativo

### Hallazgo 2
El sistema mezcla dependencias antiguas y potencialmente conflictivas en la misma pantalla. En `blackboard` se cargan dos versiones distintas de jQuery:
- `assets/global/plugins/jquery.min.js` -> jQuery `1.12.1`
- `assets/js/jquery-latest.min.js` -> jQuery `1.11.1`

Impacto:
- comportamiento impredecible en plugins,
- bugs intermitentes,
- mayor dificultad para mantener o migrar.

### Hallazgo 3
La interfaz está apoyada en un tema admin muy antiguo. El login aún conserva la huella de plantilla espejo de Metronic/HTTrack y referencias heredadas de 2016.

Impacto:
- percepción visual antigua,
- patrones de UX desactualizados,
- deuda fuerte en CSS y componentes.

## 2.3 Arquitectura de experiencia

### Hallazgo 4
Las pantallas revisadas siguen el mismo patrón casi plano de `tabla + botones + acciones`, incluso para dominios complejos como:
- prospectos,
- blackboard,
- usuarios,
- requisiciones,
- proyectos.

Impacto:
- no hay jerarquía visual ni vistas por rol,
- la experiencia se siente transaccional, no gerencial,
- cuesta priorizar, decidir y ejecutar rápido.

### Hallazgo 5
El título HTML de varias vistas sigue siendo `Viviend | Dashboard`, incluso cuando la pantalla es `Proyectos`, `Prospectos`, `Usuarios` o `Requisiciones`.

Impacto:
- baja claridad contextual,
- navegación menos profesional,
- mala base para accesibilidad, historial y trazabilidad.

## 2.4 Diseño de información

### Hallazgo 6
El menú lateral revela una cantidad importante de módulos, pero están agrupados de forma muy técnica o acumulativa, no desde una suite por procesos o por rol.

Ejemplos visibles:
- `Control de Ventas`
- `Fraccionamientos`
- `Inventario de Vivienda`
- `Prospectos`
- `Alta Venta`
- `Gestoría`
- `Titulación`
- `Catálogos`
- módulos de mano de obra
- módulos de materiales

Impacto:
- curva de aprendizaje alta,
- sensación de sistema “crecido por capas”,
- poca claridad para dirección, ventas, operación y administración.

## 2.5 UX y visual polish

### Hallazgo 7
Hay una dependencia fuerte de:
- botones pequeños,
- tablas con demasiadas columnas,
- estilos inline,
- badges grandes y poco refinados,
- tipografía y espaciado propios de un admin template viejo.

Impacto:
- baja legibilidad,
- poca percepción premium,
- mala adaptación al uso moderno en laptop y móvil.

## 2.6 Integración y evolución

### Hallazgo 8
La aplicación ya contiene muchas piezas de negocio, pero no se ve una capa moderna de:
- dashboard ejecutivo real,
- pipeline visual,
- timeline por cliente,
- trazabilidad end-to-end,
- IA,
- omnicanalidad,
- control avanzado de permisos,
- experiencia móvil moderna.

Impacto:
- el producto compite más como sistema interno heredado que como plataforma profesional lista para escalar.

## 3. Lo valioso que sí existe

- Ya hay cobertura funcional considerable.
- La navegación muestra que el negocio real está modelado.
- Existen módulos de control comercial, operación documental y abastecimiento.
- Hay una base que puede evolucionar sin partir de cero funcionalmente.

Conclusión:
El valor actual está más en la lógica y los procesos capturados que en la plataforma web como tal.

## 4. Recomendación de transformación

## 4.1 No rehacer todo de golpe

La recomendación no es “tirarlo y empezar de cero” en una sola fase.

Conviene separar:
- lógica útil del negocio,
- módulos que todavía sirven,
- deuda de front-end,
- deuda de seguridad,
- módulos que ameritan rediseño completo.

## 4.2 Nueva estructura de producto sugerida

### Suite Comercial
- dashboard comercial
- prospectos
- CRM
- pipeline
- inventario de vivienda
- reservas
- cierres
- gestoría y titulación

### Suite Operativa
- blackboard de tareas
- seguimiento por proyecto
- actividades
- cumplimiento
- alertas

### Suite Backoffice
- usuarios
- catálogos
- permisos
- requisiciones
- materiales
- reportes

### Suite Ejecutiva
- KPIs por proyecto
- conversión comercial
- estatus de inventario
- cartera y cierre
- cuellos de botella de gestoría
- avance de requisiciones y compras

## 4.3 Rediseño visual mínimo viable

Primero:
- nuevo login
- nuevo layout shell
- nuevo sidebar por dominios
- nuevo topbar
- design system de tarjetas, tablas, filtros, estados y formularios

Después:
- dashboards
- vistas de lista modernas
- vistas detalle por entidad
- experiencia responsive real

## 4.4 Seguridad mínima para nivel profesional

- `Secure` y `SameSite` en cookies
- CSRF consistente
- CSP
- `X-Frame-Options`
- `X-Content-Type-Options`
- rate limiting
- política de contraseñas
- auditoría de acciones críticas
- sesiones más robustas

## 4.5 Ruta recomendada por fases

### Fase 1: Professional shell
- rediseño de identidad visual
- layout moderno
- navegación por suites
- dashboard ejecutivo
- estandarización de tablas y filtros

### Fase 2: Comercial pro
- CRM visual
- pipeline con etapas
- ficha 360 de cliente
- timeline de acciones
- inventario conectado a estatus comercial

### Fase 3: Operación y control
- blackboard moderno
- tareas por prioridad
- alertas
- cumplimiento
- tablero por proyecto y responsables

### Fase 4: Gobierno y seguridad
- permisos por rol
- auditoría
- configuración central
- hardening
- limpieza de dependencias legacy

## 5. Recomendación técnica

Mi lectura es que conviene una modernización gradual:
- mantener backend útil al inicio,
- construir una nueva capa front-end moderna por encima,
- desacoplar módulos críticos,
- migrar por dominios,
- y evitar big bang migration.

Inferencia:
El uso de `ci_session` sugiere que la aplicación probablemente corre sobre CodeIgniter o una base similar. Esa inferencia es útil para planear una estrategia de modernización progresiva en vez de una reescritura total inmediata.

## 6. Siguiente paso recomendado

Hacer tres entregables concretos:
- mapa de módulos actual vs módulos target,
- propuesta de nueva arquitectura funcional,
- mockups premium del sistema renovado.
