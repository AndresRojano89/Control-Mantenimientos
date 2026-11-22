-- =====================================================================
-- Datos iniciales REALES entregados por la supervisora (no son datos de demostración).
-- Existencias en 0: las existencias reales se registran como "entrada".
-- No se cargan operarios ni usuarios (los registra el administrador).
-- =====================================================================

-- Máquinas de la programación de la semana 48
insert into public.machines (name, description) values
  ('INNOVA 1224', null),
  ('INNOVA 920', null),
  ('INNOVA 1628', null),
  ('Corrugador', null);

-- Mantenimientos preventivos — semana 48 de 2026 (hora no informada)
insert into public.maintenance_schedules (machine_id, scheduled_date, status, notes)
select m.id, d.fecha, 'programado', 'Programación semana 48 enviada por mantenimiento.'
from (values
  ('INNOVA 1224', date '2026-11-23'),
  ('INNOVA 920',  date '2026-11-24'),
  ('INNOVA 1628', date '2026-11-27'),
  ('Corrugador',  date '2026-11-28')
) as d(maquina, fecha)
join public.machines m on m.name = d.maquina;

-- Catálogo — productos de aseo
insert into public.supplies (code, name, category, unit) values
  ('5012985', 'Cepillo sin palo',                  'Aseo', 'unidad'),
  ('5012904', 'Mango plástico para escoba',        'Aseo', 'unidad'),
  ('5003614', 'Wipes (trapos)',                    'Aseo', 'unidad'),
  ('5003765', 'Espátula de 2"',                    'Aseo', 'unidad'),
  ('5004226', 'Mango plástico',                    'Aseo', 'unidad'),
  ('5008901', 'Crema limpiadora rodillos Anilox',  'Aseo', 'unidad');

insert into public.supplies (code, name, category, unit, pending_validation, validation_notes) values
  (null, 'Jabón líquido x galón', 'Aseo', 'galón', true,
   'Código y presentación por verificar. En la lista original aparecen "53 000 56 / 53 000 70".');

-- Catálogo — lubricantes y químicos (cantidad de la lista = referencia, no existencia)
insert into public.supplies (code, name, category, unit, reference_qty, pending_validation, validation_notes) values
  ('5013613', 'Lubricante de cadenas',                 'Lubricantes y químicos', 'unidad', 1, false, null),
  ('5006270', 'Rollo de Wypall',                       'Lubricantes y químicos', 'rollo',  2, false, null),
  ('5004170', 'Jax penetrante',                        'Lubricantes y químicos', 'unidad', 1, false, null),
  ('5101627', 'Lubricante Jax',                        'Lubricantes y químicos', 'unidad', 2, true,
     'El código 5101627 aparece también en "WD-40 Multiusos". Confirmar a cuál producto corresponde.'),
  (null,      'WD-40 Multiusos',                       'Lubricantes y químicos', 'unidad', 1, true,
     'En la lista original figura con el código 5101627, el mismo de "Lubricante Jax". Confirmar el código correcto.'),
  ('5001595', 'Limpiador de contactos',                'Lubricantes y químicos', 'unidad', 2, false, null),
  ('5005544', 'Lubricante penetrante multipropósito',  'Lubricantes y químicos', 'unidad', 2, false, null),
  ('5003843', 'Fija rosca Loctite',                    'Lubricantes y químicos', 'unidad', 1, false, null);
