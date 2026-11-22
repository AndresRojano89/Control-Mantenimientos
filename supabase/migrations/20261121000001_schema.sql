-- =====================================================================
-- Control de Aseo e Insumos — Esquema base
-- Tablas, tipos, restricciones e índices.
-- =====================================================================

create type public.app_role as enum ('admin', 'supervisor');
create type public.maintenance_status as enum ('pendiente', 'programado', 'en_proceso', 'completado', 'cancelado');
create type public.delivery_status as enum ('abierta', 'cerrada');
create type public.movement_type as enum ('entrada', 'entrega', 'devolucion', 'ajuste_positivo', 'ajuste_negativo');

-- ---------------------------------------------------------------------
-- Usuarios del sistema (1:1 con auth.users). No se borran: se desactivan.
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete restrict,
  full_name   text not null check (length(trim(full_name)) > 0),
  email       text,
  role        public.app_role not null default 'supervisor',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Máquinas
-- ---------------------------------------------------------------------
create table public.machines (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  code         text,
  area         text,
  description  text,
  active       boolean not null default true,
  created_by   uuid references public.profiles (id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index machines_name_key on public.machines (lower(trim(name)));
create unique index machines_code_key on public.machines (code) where code is not null;

-- ---------------------------------------------------------------------
-- Operarios (personal que realiza el aseo; no inician sesión)
-- ---------------------------------------------------------------------
create table public.operators (
  id          uuid primary key default gen_random_uuid(),
  code        text check (code is null or length(trim(code)) > 0),
  full_name   text not null check (length(trim(full_name)) > 0),
  position    text,
  active      boolean not null default true,
  notes       text,
  created_by  uuid references public.profiles (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index operators_code_key on public.operators (code) where code is not null;
create index operators_name_idx on public.operators (lower(full_name));

-- ---------------------------------------------------------------------
-- Insumos. stock = existencia REAL; reference_qty = cantidad de las listas.
-- ---------------------------------------------------------------------
create table public.supplies (
  id                  uuid primary key default gen_random_uuid(),
  code                text check (code is null or (length(trim(code)) > 0 and code = trim(code))),
  name                text not null check (length(trim(name)) > 0),
  description         text,
  category            text not null default 'General',
  unit                text not null default 'unidad',
  stock               numeric(12, 2) not null default 0 check (stock >= 0),
  min_stock           numeric(12, 2) not null default 0 check (min_stock >= 0),
  reference_qty       numeric(12, 2) check (reference_qty is null or reference_qty >= 0),
  location            text,
  active              boolean not null default true,
  pending_validation  boolean not null default false,
  validation_notes    text,
  created_by          uuid references public.profiles (id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index supplies_code_key on public.supplies (code) where code is not null;
create index supplies_name_idx on public.supplies (lower(name));
create index supplies_category_idx on public.supplies (category);

-- ---------------------------------------------------------------------
-- Mantenimientos preventivos
-- ---------------------------------------------------------------------
create table public.maintenance_schedules (
  id                uuid primary key default gen_random_uuid(),
  machine_id        uuid not null references public.machines (id) on delete restrict,
  maintenance_type  text not null default 'Preventivo',
  scheduled_date    date not null,
  scheduled_time    time,
  priorities        text,
  notes             text,
  status            public.maintenance_status not null default 'programado',
  completed_at      timestamptz,
  created_by        uuid references public.profiles (id) default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index maintenance_schedules_date_idx on public.maintenance_schedules (scheduled_date);
create index maintenance_schedules_machine_idx on public.maintenance_schedules (machine_id);

-- ---------------------------------------------------------------------
-- Mantenimientos de aseo (siempre ligados a un preventivo)
-- ---------------------------------------------------------------------
create table public.cleaning_maintenances (
  id              uuid primary key default gen_random_uuid(),
  schedule_id     uuid not null references public.maintenance_schedules (id) on delete restrict,
  scheduled_date  date not null,
  scheduled_time  time,
  priorities      text,
  notes           text,
  status          public.maintenance_status not null default 'programado',
  completed_at    timestamptz,
  created_by      uuid references public.profiles (id) default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index cleaning_maintenances_date_idx on public.cleaning_maintenances (scheduled_date);
create index cleaning_maintenances_schedule_idx on public.cleaning_maintenances (schedule_id);

-- ---------------------------------------------------------------------
-- Operarios asignados (a un aseo o a un preventivo)
-- ---------------------------------------------------------------------
create table public.maintenance_assignments (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid references public.maintenance_schedules (id) on delete cascade,
  cleaning_id  uuid references public.cleaning_maintenances (id) on delete cascade,
  operator_id  uuid not null references public.operators (id) on delete restrict,
  created_by   uuid references public.profiles (id) default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint maintenance_assignments_one_target check (num_nonnulls(schedule_id, cleaning_id) = 1)
);
create unique index maintenance_assignments_cleaning_key on public.maintenance_assignments (cleaning_id, operator_id) where cleaning_id is not null;
create unique index maintenance_assignments_schedule_key on public.maintenance_assignments (schedule_id, operator_id) where schedule_id is not null;
create index maintenance_assignments_operator_idx on public.maintenance_assignments (operator_id);

-- ---------------------------------------------------------------------
-- Entregas de insumos (se crean ya confirmadas vía confirm_delivery)
-- ---------------------------------------------------------------------
create table public.supply_deliveries (
  id               uuid primary key default gen_random_uuid(),
  delivery_number  bigint generated always as identity unique,
  cleaning_id      uuid not null references public.cleaning_maintenances (id) on delete restrict,
  operator_id      uuid not null references public.operators (id) on delete restrict,
  delivered_by     uuid not null references public.profiles (id) on delete restrict,
  delivered_at     timestamptz not null default now(),
  status           public.delivery_status not null default 'abierta',
  notes            text,
  closed_at        timestamptz,
  closed_by        uuid references public.profiles (id) on delete restrict,
  close_notes      text,
  created_at       timestamptz not null default now()
);
create index supply_deliveries_cleaning_idx on public.supply_deliveries (cleaning_id);
create index supply_deliveries_operator_idx on public.supply_deliveries (operator_id);
create index supply_deliveries_date_idx on public.supply_deliveries (delivered_at);

create table public.supply_delivery_items (
  id             uuid primary key default gen_random_uuid(),
  delivery_id    uuid not null references public.supply_deliveries (id) on delete restrict,
  supply_id      uuid not null references public.supplies (id) on delete restrict,
  requested_qty  numeric(12, 2) check (requested_qty is null or requested_qty >= 0),
  delivered_qty  numeric(12, 2) not null check (delivered_qty > 0),
  returned_qty   numeric(12, 2) not null default 0 check (returned_qty >= 0),
  consumed_qty   numeric(12, 2) not null default 0 check (consumed_qty >= 0),
  constraint supply_delivery_items_balance check (returned_qty + consumed_qty <= delivered_qty),
  constraint supply_delivery_items_unique unique (delivery_id, supply_id)
);
create index supply_delivery_items_supply_idx on public.supply_delivery_items (supply_id);

-- ---------------------------------------------------------------------
-- Devoluciones (siempre de una entrega existente)
-- ---------------------------------------------------------------------
create table public.supply_returns (
  id             uuid primary key default gen_random_uuid(),
  return_number  bigint generated always as identity unique,
  delivery_id    uuid not null references public.supply_deliveries (id) on delete restrict,
  operator_id    uuid not null references public.operators (id) on delete restrict,
  received_by    uuid not null references public.profiles (id) on delete restrict,
  returned_at    timestamptz not null default now(),
  notes          text,
  created_at     timestamptz not null default now()
);
create index supply_returns_delivery_idx on public.supply_returns (delivery_id);

create table public.supply_return_items (
  id                uuid primary key default gen_random_uuid(),
  return_id         uuid not null references public.supply_returns (id) on delete restrict,
  delivery_item_id  uuid not null references public.supply_delivery_items (id) on delete restrict,
  quantity          numeric(12, 2) not null check (quantity > 0)
);
create index supply_return_items_return_idx on public.supply_return_items (return_id);

-- ---------------------------------------------------------------------
-- Kardex: movimientos de inventario (inmutable)
-- ---------------------------------------------------------------------
create table public.inventory_movements (
  id               uuid primary key default gen_random_uuid(),
  movement_number  bigint generated always as identity unique,
  supply_id        uuid not null references public.supplies (id) on delete restrict,
  movement_type    public.movement_type not null,
  quantity         numeric(12, 2) not null check (quantity > 0),
  balance_after    numeric(12, 2) not null check (balance_after >= 0),
  delivery_id      uuid references public.supply_deliveries (id) on delete restrict,
  return_id        uuid references public.supply_returns (id) on delete restrict,
  reason           text,
  created_by       uuid not null references public.profiles (id) on delete restrict,
  created_at       timestamptz not null default now()
);
create index inventory_movements_supply_idx on public.inventory_movements (supply_id, created_at desc);
create index inventory_movements_date_idx on public.inventory_movements (created_at);
create index inventory_movements_delivery_idx on public.inventory_movements (delivery_id);

-- ---------------------------------------------------------------------
-- Auditoría (escrita solo por triggers; inmutable)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  user_id     uuid,
  created_at  timestamptz not null default now()
);
create index audit_logs_table_idx on public.audit_logs (table_name, record_id);
create index audit_logs_date_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- Vistas (respetan RLS del usuario que consulta)
-- ---------------------------------------------------------------------
create view public.v_supply_stock_status with (security_invoker = true) as
select s.*,
       case
         when s.stock = 0 then 'agotado'
         when s.stock <= s.min_stock then 'bajo'
         else 'ok'
       end as stock_status
from public.supplies s;

create view public.v_delivery_items with (security_invoker = true) as
select i.*,
       case when d.status = 'cerrada' then 0
            else i.delivered_qty - i.returned_qty - i.consumed_qty end as pending_qty,
       d.delivery_number, d.status as delivery_status, d.delivered_at, d.cleaning_id, d.operator_id,
       s.code as supply_code, s.name as supply_name, s.unit as supply_unit
from public.supply_delivery_items i
join public.supply_deliveries d on d.id = i.delivery_id
join public.supplies s on s.id = i.supply_id;
