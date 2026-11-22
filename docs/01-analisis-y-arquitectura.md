# Fase 1 — Análisis, arquitectura y diseño de base de datos

Sistema web de control de mantenimientos de aseo e inventario de insumos.

## 1. Entendimiento del problema

Antes de cada **mantenimiento preventivo** (lo programa mantenimiento: máquina + fecha) se hace un
**mantenimiento de aseo** a esa máquina, a cargo de uno o varios **operarios**. Para el aseo, la
supervisora retira **insumos** del almacén y se los **entrega** a los operarios; después del aseo,
los operarios **devuelven** lo que no usaron y lo demás queda como **consumido**.

El sistema debe dar trazabilidad completa: *qué insumo, cuánto, a quién, cuándo, para qué aseo y
de qué máquina*, y mantener las existencias reales sin que nunca queden negativas.

### Conceptos y cómo se separan

| Concepto | Dónde vive | Nota |
|---|---|---|
| Cantidad de referencia (listas iniciales) | `supplies.reference_qty` | Lo que se suele pedir. **No** es existencia. |
| Cantidad solicitada | `supply_delivery_items.requested_qty` | Lo que se pidió para esa entrega. |
| Cantidad disponible | `supplies.stock` | Existencia real. Solo cambia por movimientos. |
| Cantidad entregada | `supply_delivery_items.delivered_qty` | Sale del inventario al confirmar. |
| Cantidad devuelta | `supply_delivery_items.returned_qty` | Suma de devoluciones; vuelve al inventario. |
| Cantidad consumida | `supply_delivery_items.consumed_qty` | Se fija al **cerrar** la entrega = entregada − devuelta. |
| Pendiente de devolución | calculada | entregada − devuelta − consumida (0 cuando está cerrada). |

## 2. Ambigüedades detectadas y cómo se tratan

| # | Ambigüedad | Tratamiento (sin inventar datos) |
|---|---|---|
| A1 | El código **5101627** aparece en *Lubricante Jax* y *WD-40 Multiusos*. | El código es único. Se carga en *Lubricante Jax*; *WD-40* queda **sin código** y ambos se marcan **pendientes de validación**. Un producto pendiente **no puede entregarse** hasta que el administrador lo valide. |
| A2 | *Jabón líquido x galón*: dos números (53 000 56 / 53 000 70) y presentación sin confirmar. | Se carga sin código, pendiente de validación, con los números originales en la nota. |
| A3 | Las cantidades de la lista (1, 2, …) no son existencias. | Se guardan como `reference_qty`. Las existencias iniciales arrancan en **0** y se registran como *entrada* real. |
| A4 | Productos de aseo sin categoría ni unidad de medida. | Categorías *Aseo* y *Lubricantes y químicos*; unidad **"unidad"** por defecto, editable. |
| A5 | Fechas de aseo no dadas. | Se crean los 4 preventivos de la semana 48; los aseos los programa la supervisora. |
| A6 | Hora de los preventivos no dada. | `scheduled_time` es opcional. |
| A7 | Nombres de operarios y supervisores no dados. | No se cargan. Los registra el administrador. |
| A8 | ¿Quién registra entradas al inventario? | Admin y supervisor pueden registrar **entradas**; solo admin hace **ajustes** (decisión editable). |
| A9 | ¿Puede un supervisor crear operarios? | Sí (registra/edita); activar/desactivar también. Ajustable en RLS. |

## 3. Arquitectura

```
Navegador (Next.js / React, Tailwind)
   │  Server Components (lectura)  +  Server Actions (escritura, validación Zod)
   ▼
Next.js server  ── cookie de sesión (@supabase/ssr) ──►  Supabase
                                                         ├─ Auth (bcrypt, JWT)
                                                         ├─ PostgreSQL + RLS
                                                         └─ Funciones RPC transaccionales
```

- **Frontend**: Next.js (App Router) + React + TypeScript + Tailwind. Componentes UI propios estilo
  shadcn/ui (`src/components/ui`), íconos Lucide, gráficos Recharts, calendario mensual propio.
- **Acceso a datos**: Supabase JS con la sesión del usuario (nunca la *service role* en el navegador).
  La *service role key* solo se usa en el servidor para crear usuarios (módulo Usuarios).
- **Reglas de negocio**: en la base de datos (constraints, triggers y funciones `SECURITY DEFINER`
  que verifican el rol). La interfaz solo oculta lo que el rol no puede hacer; el servidor lo impide.
- **Transacciones**: entregas, devoluciones, cierres, entradas y ajustes son una sola llamada RPC
  (una transacción) con `SELECT … FOR UPDATE` sobre los productos para evitar carreras.
- **Exportación**: Excel (ExcelJS) y PDF (jsPDF + autotable) generados en el navegador a partir de
  los mismos datos filtrados que muestra la pantalla.

### Estructura de carpetas

```
supabase/migrations/   SQL: esquema, RLS, funciones, auditoría
supabase/seed.sql      Datos iniciales reales (catálogo, máquinas, semana 48)
src/app/               Rutas (login, dashboard y módulos)
src/components/        UI reutilizable y componentes por módulo
src/lib/supabase/      Clientes (server / browser / admin)
src/lib/validations/   Esquemas Zod (compartidos front/back)
src/lib/               Utilidades, formatos, etiquetas de estados
tests/                 Pruebas de reglas de negocio contra la BD
```

## 4. Modelo de datos

```
profiles ─┐ (auth.users)
machines ─┬─< maintenance_schedules (preventivos) ─┬─< cleaning_maintenances (aseos)
          │                                         │        │
operators ┴──────< maintenance_assignments >────────┴────────┤
                                                             │
supplies ─< supply_delivery_items >─ supply_deliveries >─────┘
   │               │                    │
   │      supply_return_items >─ supply_returns
   └─< inventory_movements (entrada / entrega / devolución / ajuste)
audit_logs (todas las tablas operativas)
```

| Tabla | Propósito | Claves y restricciones principales |
|---|---|---|
| `profiles` | Usuario del sistema y su rol (`admin`/`supervisor`) | PK = `auth.users.id` |
| `machines` | Máquinas | `name` único |
| `operators` | Operarios (no son usuarios del sistema) | `code` único si existe |
| `supplies` | Catálogo + existencia actual | `code` único si existe; `stock >= 0`; `pending_validation` |
| `maintenance_schedules` | Mantenimientos **preventivos** | FK máquina; estado |
| `cleaning_maintenances` | Mantenimientos de **aseo**, ligados a un preventivo | FK preventivo; estado |
| `maintenance_assignments` | Operarios asignados a un aseo o preventivo | exactamente uno de los dos; único por operario |
| `supply_deliveries` | Cabecera de entrega (número consecutivo) | FK aseo, operario que recibe, usuario que entrega; estado `abierta`/`cerrada` |
| `supply_delivery_items` | Productos de la entrega | `delivered_qty > 0`; `returned + consumed <= delivered`; producto único por entrega |
| `supply_returns` / `_items` | Devoluciones ligadas a la entrega original | `quantity > 0`, validada contra lo pendiente |
| `inventory_movements` | Kardex inmutable con saldo resultante | `quantity > 0`; sin UPDATE/DELETE |
| `audit_logs` | Quién cambió qué y cuándo (antes/después en JSON) | escrito solo por triggers |

Estados de mantenimiento: `pendiente`, `programado`, `en_proceso`, `completado`, `cancelado`.

## 5. Reglas de negocio → dónde se garantizan

| Regla | Garantía |
|---|---|
| 1. Sin existencias negativas | `CHECK (stock >= 0)` + validación con bloqueo en cada función |
| 2–3. Solo se descuenta al confirmar; genera movimientos | La entrega se arma en pantalla y se crea **ya confirmada** en `confirm_delivery()`, que inserta los movimientos en la misma transacción |
| 4–5. Devoluciones atadas a la entrega y ≤ pendiente | `register_return()` valida contra `delivered − returned − consumed` con bloqueo |
| 6. Códigos únicos | índice único parcial `supplies(code) WHERE code IS NOT NULL` |
| 7. No borrar con historial | FKs `ON DELETE RESTRICT`; sin políticas DELETE en tablas históricas; se desactiva en vez de borrar |
| 8. Registrar quién | `created_by` / `delivered_by` = `auth.uid()` + `audit_logs` por triggers |
| 9. Preventivo y aseo separados | Tablas distintas, relación 1‑N |
| 10. Varios operarios / insumos | Tablas de asignación e ítems |
| 11. Historial inalterable | Trigger que bloquea UPDATE/DELETE en `inventory_movements` y `audit_logs` |
| 12. Existencias ≠ solicitado | Columnas separadas (sección 1) |
| 13. Alertas de stock bajo | Vista `v_supply_stock_status` usada en dashboard e inventario |
| 14. Corregir datos incompletos antes de usarlos | `pending_validation` bloquea entregas, entradas y ajustes |
| Stock solo cambia por movimientos | Trigger: `stock` solo puede cambiar dentro de las funciones de inventario |

## 6. Roles y permisos (verificados por RLS y funciones)

| Acción | Admin | Supervisor |
|---|:-:|:-:|
| Ver todo (consultas, reportes) | ✔ | ✔ |
| Máquinas y preventivos: crear/editar | ✔ | — |
| Aseos: crear/editar, asignar operarios | ✔ | ✔ |
| Operarios: crear/editar/activar | ✔ | ✔ |
| Catálogo de insumos: crear/editar/validar | ✔ | — |
| Entradas de inventario | ✔ | ✔ |
| Ajustes de inventario | ✔ | — |
| Entregas, devoluciones y cierres | ✔ | ✔ |
| Gestión de usuarios | ✔ | — |

Usuarios inactivos (`profiles.active = false`) no pueden operar: todas las comprobaciones de rol
exigen perfil activo.
