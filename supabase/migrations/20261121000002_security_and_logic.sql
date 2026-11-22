-- =====================================================================
-- Control de Aseo e Insumos — Seguridad, auditoría y reglas de negocio
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de rol (SECURITY DEFINER para poder leer profiles desde RLS)
-- ---------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.require_active_user()
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_active_user() then
    raise exception 'No autorizado: su usuario no está activo o no ha iniciado sesión.' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Perfil automático al crear un usuario de Auth.
-- El rol sale de app_metadata (solo la service role puede fijarlo).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'supervisor')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_machines_updated before update on public.machines for each row execute function public.set_updated_at();
create trigger trg_operators_updated before update on public.operators for each row execute function public.set_updated_at();
create trigger trg_supplies_updated before update on public.supplies for each row execute function public.set_updated_at();
create trigger trg_schedules_updated before update on public.maintenance_schedules for each row execute function public.set_updated_at();
create trigger trg_cleanings_updated before update on public.cleaning_maintenances for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Las existencias solo cambian a través de las funciones de inventario
-- ---------------------------------------------------------------------
create or replace function public.guard_supply_stock()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.inventory_op', true), 'off') <> 'on' then
    if tg_op = 'INSERT' and new.stock <> 0 then
      raise exception 'Las existencias iniciales se registran como una entrada de inventario, no al crear el producto.';
    elsif tg_op = 'UPDATE' and new.stock <> old.stock then
      raise exception 'Las existencias solo se modifican mediante entradas, entregas, devoluciones o ajustes.';
    end if;
  end if;
  return new;
end $$;

create trigger trg_supplies_guard_stock
  before insert or update on public.supplies
  for each row execute function public.guard_supply_stock();

-- ---------------------------------------------------------------------
-- Aseo: la fecha no puede ser posterior a la del preventivo
-- ---------------------------------------------------------------------
create or replace function public.validate_cleaning_date()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_date date;
begin
  select scheduled_date into v_date from public.maintenance_schedules where id = new.schedule_id;
  if new.scheduled_date > v_date then
    raise exception 'El aseo (%) debe programarse antes o el mismo día del mantenimiento preventivo (%).',
      to_char(new.scheduled_date, 'DD/MM/YYYY'), to_char(v_date, 'DD/MM/YYYY');
  end if;
  if new.status = 'completado' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'completado' then
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger trg_cleanings_validate
  before insert or update on public.cleaning_maintenances
  for each row execute function public.validate_cleaning_date();

create or replace function public.set_schedule_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'completado' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'completado' then
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger trg_schedules_completed
  before insert or update on public.maintenance_schedules
  for each row execute function public.set_schedule_completed_at();

-- Si se mueve un preventivo, no puede quedar antes de sus aseos.
create or replace function public.validate_schedule_date()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max date;
begin
  if new.scheduled_date is distinct from old.scheduled_date then
    select max(scheduled_date) into v_max from public.cleaning_maintenances
     where schedule_id = new.id and status <> 'cancelado';
    if v_max is not null and new.scheduled_date < v_max then
      raise exception 'Hay un aseo programado el % para este mantenimiento; reprograme el aseo primero.',
        to_char(v_max, 'DD/MM/YYYY');
    end if;
  end if;
  return new;
end $$;

create trigger trg_schedules_validate_date
  before update on public.maintenance_schedules
  for each row execute function public.validate_schedule_date();

-- ---------------------------------------------------------------------
-- Historial inmutable
-- ---------------------------------------------------------------------
create or replace function public.prevent_modification()
returns trigger language plpgsql as $$
begin
  raise exception 'Los registros de % son históricos y no pueden modificarse ni eliminarse.', tg_table_name;
end $$;

create trigger trg_movements_immutable before update or delete on public.inventory_movements
  for each row execute function public.prevent_modification();
create trigger trg_audit_immutable before update or delete on public.audit_logs
  for each row execute function public.prevent_modification();
create trigger trg_return_items_immutable before update or delete on public.supply_return_items
  for each row execute function public.prevent_modification();
create trigger trg_returns_immutable before update or delete on public.supply_returns
  for each row execute function public.prevent_modification();

-- ---------------------------------------------------------------------
-- Auditoría genérica
-- ---------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, user_id)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', null),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'machines', 'operators', 'supplies', 'maintenance_schedules', 'cleaning_maintenances',
    'maintenance_assignments', 'supply_deliveries', 'supply_delivery_items', 'supply_returns',
    'supply_return_items', 'inventory_movements'
  ] loop
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles                enable row level security;
alter table public.machines                enable row level security;
alter table public.operators               enable row level security;
alter table public.supplies                enable row level security;
alter table public.maintenance_schedules   enable row level security;
alter table public.cleaning_maintenances   enable row level security;
alter table public.maintenance_assignments enable row level security;
alter table public.supply_deliveries       enable row level security;
alter table public.supply_delivery_items   enable row level security;
alter table public.supply_returns          enable row level security;
alter table public.supply_return_items     enable row level security;
alter table public.inventory_movements     enable row level security;
alter table public.audit_logs              enable row level security;

-- Perfiles: cada uno ve el suyo; usuarios activos ven todos (nombres en historial); admin edita.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_user());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Máquinas y preventivos: lectura para activos, escritura solo admin.
create policy machines_select on public.machines for select to authenticated using (public.is_active_user());
create policy machines_insert on public.machines for insert to authenticated with check (public.is_admin());
create policy machines_update on public.machines for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy schedules_select on public.maintenance_schedules for select to authenticated using (public.is_active_user());
create policy schedules_insert on public.maintenance_schedules for insert to authenticated with check (public.is_admin());
create policy schedules_update on public.maintenance_schedules for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Operarios: admin y supervisor registran y editan.
create policy operators_select on public.operators for select to authenticated using (public.is_active_user());
create policy operators_insert on public.operators for insert to authenticated with check (public.is_active_user());
create policy operators_update on public.operators for update to authenticated using (public.is_active_user()) with check (public.is_active_user());

-- Insumos: catálogo editable solo por admin (las existencias van por funciones).
create policy supplies_select on public.supplies for select to authenticated using (public.is_active_user());
create policy supplies_insert on public.supplies for insert to authenticated with check (public.is_admin());
create policy supplies_update on public.supplies for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Aseos: admin y supervisor.
create policy cleanings_select on public.cleaning_maintenances for select to authenticated using (public.is_active_user());
create policy cleanings_insert on public.cleaning_maintenances for insert to authenticated with check (public.is_active_user());
create policy cleanings_update on public.cleaning_maintenances for update to authenticated using (public.is_active_user()) with check (public.is_active_user());

-- Asignaciones: a aseos cualquiera activo; a preventivos solo admin.
create policy assignments_select on public.maintenance_assignments for select to authenticated using (public.is_active_user());
create policy assignments_insert on public.maintenance_assignments for insert to authenticated
  with check (public.is_active_user() and (cleaning_id is not null or public.is_admin()));
create policy assignments_delete on public.maintenance_assignments for delete to authenticated
  using (public.is_active_user() and (cleaning_id is not null or public.is_admin()));

-- Entregas, devoluciones y movimientos: solo lectura directa. Se escriben por funciones.
create policy deliveries_select on public.supply_deliveries for select to authenticated using (public.is_active_user());
create policy delivery_items_select on public.supply_delivery_items for select to authenticated using (public.is_active_user());
create policy returns_select on public.supply_returns for select to authenticated using (public.is_active_user());
create policy return_items_select on public.supply_return_items for select to authenticated using (public.is_active_user());
create policy movements_select on public.inventory_movements for select to authenticated using (public.is_active_user());

-- Auditoría: solo admin.
create policy audit_select on public.audit_logs for select to authenticated using (public.is_admin());

-- Nada para el rol anónimo.
revoke all on all tables in schema public from anon;

-- =====================================================================
-- Funciones de inventario (transaccionales)
-- =====================================================================

-- Valida un producto para operar y lo bloquea.
create or replace function public._lock_operable_supply(p_supply_id uuid)
returns public.supplies
language plpgsql security definer set search_path = public as $$
declare v public.supplies;
begin
  select * into v from public.supplies where id = p_supply_id for update;
  if not found then
    raise exception 'Producto no encontrado.';
  end if;
  if not v.active then
    raise exception 'El producto "%" está inactivo.', v.name;
  end if;
  if v.pending_validation then
    raise exception 'El producto "%" está pendiente de validación. Corrija sus datos antes de operarlo.', v.name;
  end if;
  return v;
end $$;

-- Entrada de inventario (recepción desde almacén / existencias iniciales)
create or replace function public.register_stock_entry(p_supply_id uuid, p_quantity numeric, p_reason text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.supplies; v_balance numeric; v_id uuid;
begin
  perform public.require_active_user();
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad de la entrada debe ser mayor que cero.';
  end if;
  v := public._lock_operable_supply(p_supply_id);

  perform set_config('app.inventory_op', 'on', true);
  update public.supplies set stock = stock + p_quantity where id = v.id returning stock into v_balance;
  perform set_config('app.inventory_op', 'off', true);

  insert into public.inventory_movements (supply_id, movement_type, quantity, balance_after, reason, created_by)
  values (v.id, 'entrada', p_quantity, v_balance, nullif(trim(p_reason), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Ajuste autorizado (solo admin): fija la existencia física contada.
create or replace function public.adjust_stock(p_supply_id uuid, p_new_stock numeric, p_reason text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.supplies; v_delta numeric; v_id uuid;
begin
  perform public.require_active_user();
  if not public.is_admin() then
    raise exception 'Solo un administrador puede autorizar ajustes de inventario.' using errcode = '42501';
  end if;
  if p_new_stock is null or p_new_stock < 0 then
    raise exception 'La existencia ajustada no puede ser negativa.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'El ajuste requiere un motivo.';
  end if;
  select * into v from public.supplies where id = p_supply_id for update;
  if not found then raise exception 'Producto no encontrado.'; end if;

  v_delta := p_new_stock - v.stock;
  if v_delta = 0 then
    raise exception 'La existencia indicada es igual a la actual; no hay nada que ajustar.';
  end if;

  perform set_config('app.inventory_op', 'on', true);
  update public.supplies set stock = p_new_stock where id = v.id;
  perform set_config('app.inventory_op', 'off', true);

  insert into public.inventory_movements (supply_id, movement_type, quantity, balance_after, reason, created_by)
  values (v.id, (case when v_delta > 0 then 'ajuste_positivo' else 'ajuste_negativo' end)::public.movement_type,
          abs(v_delta), p_new_stock, trim(p_reason), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Confirmar entrega: crea cabecera, ítems y movimientos y descuenta existencias.
-- p_items: [{ "supply_id": uuid, "quantity": n, "requested_qty": n|null }]
create or replace function public.confirm_delivery(
  p_cleaning_id uuid, p_operator_id uuid, p_items jsonb, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cleaning public.cleaning_maintenances;
  v_operator public.operators;
  v_delivery public.supply_deliveries;
  v_item record;
  v_supply public.supplies;
  v_balance numeric;
begin
  perform public.require_active_user();

  select * into v_cleaning from public.cleaning_maintenances where id = p_cleaning_id;
  if not found then raise exception 'El mantenimiento de aseo no existe.'; end if;
  if v_cleaning.status in ('cancelado', 'completado') then
    raise exception 'No se pueden entregar insumos a un aseo en estado "%".', v_cleaning.status;
  end if;

  select * into v_operator from public.operators where id = p_operator_id;
  if not found then raise exception 'El operario no existe.'; end if;
  if not v_operator.active then raise exception 'El operario "%" está inactivo.', v_operator.full_name; end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La entrega debe tener al menos un producto.';
  end if;
  if (select count(distinct (e ->> 'supply_id')) from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then
    raise exception 'Hay productos repetidos en la entrega. Agrupe las cantidades en una sola línea.';
  end if;

  insert into public.supply_deliveries (cleaning_id, operator_id, delivered_by, notes)
  values (p_cleaning_id, p_operator_id, auth.uid(), nullif(trim(p_notes), ''))
  returning * into v_delivery;

  -- Orden fijo por id para evitar bloqueos cruzados entre entregas simultáneas.
  for v_item in
    select (e ->> 'supply_id')::uuid as supply_id,
           (e ->> 'quantity')::numeric as quantity,
           nullif(e ->> 'requested_qty', '')::numeric as requested_qty
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Todas las cantidades a entregar deben ser mayores que cero.';
    end if;
    v_supply := public._lock_operable_supply(v_item.supply_id);
    if v_supply.stock < v_item.quantity then
      raise exception 'Existencias insuficientes de "%": disponible %, a entregar %.',
        v_supply.name, v_supply.stock, v_item.quantity;
    end if;

    perform set_config('app.inventory_op', 'on', true);
    update public.supplies set stock = stock - v_item.quantity where id = v_supply.id returning stock into v_balance;
    perform set_config('app.inventory_op', 'off', true);

    insert into public.supply_delivery_items (delivery_id, supply_id, requested_qty, delivered_qty)
    values (v_delivery.id, v_supply.id, v_item.requested_qty, v_item.quantity);

    insert into public.inventory_movements (supply_id, movement_type, quantity, balance_after, delivery_id, reason, created_by)
    values (v_supply.id, 'entrega', v_item.quantity, v_balance, v_delivery.id,
            'Entrega #' || v_delivery.delivery_number, auth.uid());
  end loop;

  -- Un aseo con insumos entregados pasa a "en proceso" si aún no había empezado.
  if v_cleaning.status in ('pendiente', 'programado') then
    update public.cleaning_maintenances set status = 'en_proceso' where id = v_cleaning.id;
  end if;

  return jsonb_build_object('id', v_delivery.id, 'delivery_number', v_delivery.delivery_number);
end $$;

-- Registrar devolución parcial o total.
-- p_items: [{ "delivery_item_id": uuid, "quantity": n }]
create or replace function public.register_return(
  p_delivery_id uuid, p_items jsonb, p_operator_id uuid default null, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_delivery public.supply_deliveries;
  v_return public.supply_returns;
  v_item record;
  v_di public.supply_delivery_items;
  v_pending numeric;
  v_balance numeric;
  v_name text;
begin
  perform public.require_active_user();

  select * into v_delivery from public.supply_deliveries where id = p_delivery_id for update;
  if not found then raise exception 'La entrega no existe.'; end if;
  if v_delivery.status = 'cerrada' then
    raise exception 'La entrega #% ya está cerrada; no admite devoluciones.', v_delivery.delivery_number;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Indique al menos un producto a devolver.';
  end if;
  if (select count(distinct (e ->> 'delivery_item_id')) from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then
    raise exception 'Hay productos repetidos en la devolución.';
  end if;

  insert into public.supply_returns (delivery_id, operator_id, received_by, notes)
  values (v_delivery.id, coalesce(p_operator_id, v_delivery.operator_id), auth.uid(), nullif(trim(p_notes), ''))
  returning * into v_return;

  for v_item in
    select (e ->> 'delivery_item_id')::uuid as delivery_item_id, (e ->> 'quantity')::numeric as quantity
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Las cantidades devueltas deben ser mayores que cero.';
    end if;

    select * into v_di from public.supply_delivery_items
    where id = v_item.delivery_item_id and delivery_id = v_delivery.id for update;
    if not found then raise exception 'Un producto de la devolución no pertenece a la entrega #%.', v_delivery.delivery_number; end if;

    v_pending := v_di.delivered_qty - v_di.returned_qty - v_di.consumed_qty;
    select name into v_name from public.supplies where id = v_di.supply_id;
    if v_item.quantity > v_pending then
      raise exception 'No se puede devolver % de "%": solo hay % pendiente(s) de devolución.', v_item.quantity, v_name, v_pending;
    end if;

    update public.supply_delivery_items set returned_qty = returned_qty + v_item.quantity where id = v_di.id;
    insert into public.supply_return_items (return_id, delivery_item_id, quantity) values (v_return.id, v_di.id, v_item.quantity);

    -- La devolución reingresa al inventario aunque el producto se haya marcado pendiente después.
    perform 1 from public.supplies where id = v_di.supply_id for update;
    perform set_config('app.inventory_op', 'on', true);
    update public.supplies set stock = stock + v_item.quantity where id = v_di.supply_id returning stock into v_balance;
    perform set_config('app.inventory_op', 'off', true);

    insert into public.inventory_movements (supply_id, movement_type, quantity, balance_after, delivery_id, return_id, reason, created_by)
    values (v_di.supply_id, 'devolucion', v_item.quantity, v_balance, v_delivery.id, v_return.id,
            'Devolución #' || v_return.return_number || ' de la entrega #' || v_delivery.delivery_number, auth.uid());
  end loop;

  return jsonb_build_object('id', v_return.id, 'return_number', v_return.return_number);
end $$;

-- Cerrar entrega: lo no devuelto queda registrado como consumido.
create or replace function public.close_delivery(p_delivery_id uuid, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_delivery public.supply_deliveries; v_consumed numeric;
begin
  perform public.require_active_user();
  select * into v_delivery from public.supply_deliveries where id = p_delivery_id for update;
  if not found then raise exception 'La entrega no existe.'; end if;
  if v_delivery.status = 'cerrada' then
    raise exception 'La entrega #% ya está cerrada.', v_delivery.delivery_number;
  end if;

  update public.supply_delivery_items
     set consumed_qty = delivered_qty - returned_qty
   where delivery_id = v_delivery.id;

  select coalesce(sum(consumed_qty), 0) into v_consumed from public.supply_delivery_items where delivery_id = v_delivery.id;

  update public.supply_deliveries
     set status = 'cerrada', closed_at = now(), closed_by = auth.uid(), close_notes = nullif(trim(p_notes), '')
   where id = v_delivery.id;

  return jsonb_build_object('id', v_delivery.id, 'delivery_number', v_delivery.delivery_number, 'consumed_total', v_consumed);
end $$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.current_app_role(), public.is_active_user(), public.is_admin(),
  public.register_stock_entry(uuid, numeric, text),
  public.adjust_stock(uuid, numeric, text),
  public.confirm_delivery(uuid, uuid, jsonb, text),
  public.register_return(uuid, jsonb, uuid, text),
  public.close_delivery(uuid, text)
to authenticated;
-- Funciones internas: solo el dueño (las usan las funciones anteriores).
revoke execute on function public._lock_operable_supply(uuid), public.require_active_user() from authenticated;
