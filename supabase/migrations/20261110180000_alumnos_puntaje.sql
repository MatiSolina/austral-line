-- GRUPO ALUMNOS: puntaje acumulado vs. mínimo para regularizar (Agente de Requerimientos Académicos).
-- Los profesores fijan cuántos puntos vale como máximo cada hito y el mínimo total para regularizar, y
-- cargan los puntos: en los hitos grupales, del grupo (valen para todos sus integrantes); en los
-- individuales, de cada alumno. También pueden ajustar la nota de un alumno en un hito grupal: la nota
-- individual, si existe, reemplaza a la del grupo para ese alumno.
-- Cada alumno ve solo sus puntos; las notas no las ve el mentor ni otros grupos.

-- Mínimo para regularizar (una sola fila) -----------------------------------------------------
create table alumnos_puntaje_config (
  id smallint primary key default 1 check (id = 1),
  minimo numeric(6, 2) check (minimo is null or minimo >= 0),
  updated_at timestamptz not null default now()
);
insert into alumnos_puntaje_config (id, minimo) values (1, null);

alter table alumnos_puntaje_config enable row level security;
create policy "leer con rol" on alumnos_puntaje_config for select to authenticated using (mi_rol() is not null);
create policy "admin escribe" on alumnos_puntaje_config for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Cuántos puntos vale cada hito. Un hito sin fila no suma puntos. ------------------------------
create table alumnos_puntaje_hitos (
  evento_id uuid primary key references eventos(id) on delete cascade,
  maximo numeric(6, 2) not null check (maximo > 0),
  updated_at timestamptz not null default now()
);

alter table alumnos_puntaje_hitos enable row level security;
create policy "leer con rol" on alumnos_puntaje_hitos for select to authenticated using (mi_rol() is not null);
create policy "admin escribe" on alumnos_puntaje_hitos for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Notas: del grupo (proyecto_id) o de un alumno (persona_id), nunca de los dos ----------------
create table alumnos_notas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  proyecto_id uuid references proyectos(id) on delete cascade,
  persona_id uuid references personas(id) on delete cascade,
  puntos numeric(6, 2) not null check (puntos >= 0),
  comentario text check (char_length(comentario) <= 500),
  cargada_por uuid references personas(id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((proyecto_id is null) <> (persona_id is null))
);
create unique index alumnos_notas_unica on alumnos_notas (evento_id, proyecto_id, persona_id) nulls not distinct;

-- Los puntos no pueden pasar el máximo del hito (ni cargarse en un hito sin puntaje).
create function public.alumnos_validar_nota() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tope numeric;
begin
  select maximo into tope from alumnos_puntaje_hitos where evento_id = new.evento_id;
  if tope is null then raise exception 'Primero fijá cuántos puntos vale este hito.'; end if;
  if new.puntos > tope then raise exception 'El hito vale como máximo % puntos.', tope; end if;
  return new;
end;
$$;
create trigger alumnos_validar_nota before insert or update on alumnos_notas
  for each row execute function public.alumnos_validar_nota();

alter table alumnos_notas enable row level security;
create policy "admin todo" on alumnos_notas for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
-- El alumno ve las notas de su grupo y las suyas.
create policy "alumno ve las suyas" on alumnos_notas for select to authenticated
  using (
    mi_rol() = 'alumno'
    and ((proyecto_id is not null and alumnos_soy_integrante(proyecto_id::text)) or persona_id = mi_persona_id())
  );
