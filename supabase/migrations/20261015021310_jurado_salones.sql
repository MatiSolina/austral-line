-- GRUPO JURADO: organización de cada evento en salones.
-- En las instancias hay varios salones, cada uno con sus equipos y sus jurados; la final es un evento con un solo salón.
-- Cada jurado evalúa a los equipos que escucha, así que un equipo y un jurado van a un solo salón por evento.

create table jurado_salones (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  nombre text not null check (btrim(nombre) <> ''),
  orden int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, evento_id) -- para que las asignaciones no puedan apuntar a un salón de otro evento
);
-- Sin nombres repetidos en un mismo evento, aunque cambien mayúsculas ("Salón A" y "salón a").
create unique index jurado_salones_nombre_unico on jurado_salones (evento_id, lower(nombre));

-- Qué equipos se presentan en cada salón. La clave (evento, proyecto) impide poner un equipo en dos salones del mismo evento.
create table jurado_salon_proyectos (
  evento_id uuid not null,
  salon_id uuid not null,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  primary key (evento_id, proyecto_id),
  foreign key (salon_id, evento_id) references jurado_salones(id, evento_id) on delete cascade
);

-- Qué jurados escuchan en cada salón. Mismo criterio: un jurado, un salón por evento.
create table jurado_salon_jurados (
  evento_id uuid not null,
  salon_id uuid not null,
  jurado_id uuid not null references personas(id) on delete cascade,
  primary key (evento_id, jurado_id),
  foreign key (salon_id, evento_id) references jurado_salones(id, evento_id) on delete cascade
);

-- Permisos: el admin organiza; los jurados leen (lo van a usar la planilla y la deliberación por salón).
-- Los borradores no se evalúan, así que tampoco se asignan; y solo se asignan personas con rol jurado.
alter table jurado_salones enable row level security;
create policy "admin todo" on jurado_salones for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "jurado lee" on jurado_salones for select to authenticated
  using (mi_rol() = 'jurado');

alter table jurado_salon_proyectos enable row level security;
create policy "admin todo" on jurado_salon_proyectos for all to authenticated
  using (mi_rol() = 'admin')
  with check (mi_rol() = 'admin'
    and proyecto_id in (select id from proyectos where estado in ('publicado', 'finalista', 'ganador')));
create policy "jurado lee" on jurado_salon_proyectos for select to authenticated
  using (mi_rol() = 'jurado');

alter table jurado_salon_jurados enable row level security;
create policy "admin todo" on jurado_salon_jurados for all to authenticated
  using (mi_rol() = 'admin')
  with check (mi_rol() = 'admin' and jurado_id in (select id from personas where rol = 'jurado'));
create policy "jurado lee" on jurado_salon_jurados for select to authenticated
  using (mi_rol() = 'jurado');

-- Guarda de una sola vez todas las asignaciones de un evento (o se guarda todo, o nada).
-- p_proyectos y p_jurados son listas [{ "id": ..., "salon_id": ... }]; lo que no está en la lista queda sin salón.
-- Corre con los permisos de quien la llama, así que las policies de arriba siguen valiendo.
create function jurado_guardar_salones(p_evento uuid, p_proyectos jsonb, p_jurados jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if mi_rol() is distinct from 'admin' then
    raise exception 'Solo el admin organiza los salones';
  end if;
  delete from jurado_salon_proyectos where evento_id = p_evento;
  delete from jurado_salon_jurados where evento_id = p_evento;
  insert into jurado_salon_proyectos (evento_id, salon_id, proyecto_id)
    select p_evento, (x ->> 'salon_id')::uuid, (x ->> 'id')::uuid from jsonb_array_elements(p_proyectos) x;
  insert into jurado_salon_jurados (evento_id, salon_id, jurado_id)
    select p_evento, (x ->> 'salon_id')::uuid, (x ->> 'id')::uuid from jsonb_array_elements(p_jurados) x;
end $$;

revoke execute on function jurado_guardar_salones(uuid, jsonb, jsonb) from public, anon;
grant execute on function jurado_guardar_salones(uuid, jsonb, jsonb) to authenticated;
