-- GRUPO ALUMNOS: perfil de cada alumno para el armado de equipos.
-- Carrera (del maestro de carreras, fija una vez elegida), si quiere aparecer como
-- "busco equipo", y cuánto le interesa cada tema del maestro de intereses (1 a 5 estrellas).

-- Perfil -----------------------------------------------------------------------
create table alumnos_perfiles (
  persona_id uuid primary key references personas(id) on delete cascade,
  sobre_mi text check (char_length(sobre_mi) <= 400),
  busca_equipo boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table alumnos_perfiles enable row level security;

create policy "admin todo" on alumnos_perfiles for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- El alumno ve su propio perfil y el de quienes marcaron "busco equipo".
create policy "alumno ve lo suyo y quienes buscan equipo" on alumnos_perfiles for select to authenticated
  using (
    mi_rol() = 'alumno'
    and (busca_equipo or persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')))
  );

-- El alumno solo crea y edita su propio perfil.
create policy "alumno crea lo suyo" on alumnos_perfiles for insert to authenticated
  with check (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
create policy "alumno edita lo suyo" on alumnos_perfiles for update to authenticated
  using (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')))
  with check (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));

-- Maestro de carreras -------------------------------------------------------------
-- Carreras que cursan el taller. Lo lee cualquiera con rol; solo el admin lo modifica.
create table alumnos_carreras_maestro (
  id smallint generated always as identity primary key,
  nombre text not null unique,
  orden smallint not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table alumnos_carreras_maestro enable row level security;

create policy "leer con rol" on alumnos_carreras_maestro for select to authenticated
  using (mi_rol() is not null);
create policy "admin escribe" on alumnos_carreras_maestro for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

insert into alumnos_carreras_maestro (nombre, orden) values
  ('Administración de Empresas', 1),
  ('Negocios Digitales', 2),
  ('Economía Empresarial', 3),
  ('Agronegocios', 4),
  ('Marketing', 5);

-- Carrera de cada alumno -------------------------------------------------------------
-- Una por alumno. La FK al maestro valida la carrera. El alumno la elige UNA vez
-- (no tiene permiso para cambiarla ni borrarla); solo el admin (los profesores) la corrige.
create table alumnos_carreras (
  persona_id uuid primary key references personas(id) on delete cascade,
  carrera_id smallint not null references alumnos_carreras_maestro(id),
  created_at timestamptz not null default now()
);

alter table alumnos_carreras enable row level security;

create policy "admin todo" on alumnos_carreras for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- El alumno ve su carrera y la de quienes buscan equipo (para la interdisciplinariedad).
create policy "alumno ve lo suyo y quienes buscan equipo" on alumnos_carreras for select to authenticated
  using (
    mi_rol() = 'alumno'
    and (
      persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))
      or exists (select 1 from alumnos_perfiles p where p.persona_id = alumnos_carreras.persona_id and p.busca_equipo)
    )
  );

-- El alumno solo carga la suya, y solo una vez (sin políticas de update ni delete para alumnos).
create policy "alumno elige la suya" on alumnos_carreras for insert to authenticated
  with check (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));

-- Maestro de intereses -----------------------------------------------------------
-- Listado oficial de temas. Lo lee cualquiera con rol; solo el admin lo modifica.
create table alumnos_intereses_maestro (
  id smallint generated always as identity primary key,
  nombre text not null unique,
  orden smallint not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table alumnos_intereses_maestro enable row level security;

create policy "leer con rol" on alumnos_intereses_maestro for select to authenticated
  using (mi_rol() is not null);
create policy "admin escribe" on alumnos_intereses_maestro for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

insert into alumnos_intereses_maestro (nombre, orden) values
  ('Salud', 1),
  ('Educación', 2),
  ('Agro y alimentos', 3),
  ('Finanzas y fintech', 4),
  ('Sustentabilidad y ambiente', 5),
  ('Impacto social', 6),
  ('Consumo y retail', 7),
  ('Tecnología y software', 8),
  ('Turismo y entretenimiento', 9),
  ('Logística y movilidad', 10),
  ('Deportes y bienestar', 11),
  ('Industria y manufactura', 12),
  ('Moda y diseño', 13),
  ('Inmobiliario y construcción', 14);

-- Respuestas de cada alumno: cuánto le interesa cada tema (1 a 5 estrellas) ----
create table alumnos_intereses (
  persona_id uuid not null references personas(id) on delete cascade,
  interes_id smallint not null references alumnos_intereses_maestro(id) on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (persona_id, interes_id)
);

alter table alumnos_intereses enable row level security;

create policy "admin todo" on alumnos_intereses for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- El alumno ve sus respuestas y las de quienes buscan equipo (para calcular afinidad).
create policy "alumno ve lo suyo y quienes buscan equipo" on alumnos_intereses for select to authenticated
  using (
    mi_rol() = 'alumno'
    and (
      persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))
      or exists (select 1 from alumnos_perfiles p where p.persona_id = alumnos_intereses.persona_id and p.busca_equipo)
    )
  );

-- El alumno carga, cambia y quita solo sus propias respuestas.
create policy "alumno gestiona lo suyo" on alumnos_intereses for all to authenticated
  using (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')))
  with check (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));

-- Historial de cambios de intereses ------------------------------------------------
-- Se completa solo (trigger): queda registro de cada vez que un alumno califica,
-- cambia o quita un tema. Sin FK a propósito: el historial tiene que sobrevivir
-- aunque se borre la persona o el tema (y con FK, ese borrado fallaría).
create table alumnos_intereses_historial (
  id bigint generated always as identity primary key,
  persona_id uuid not null,
  interes_id smallint not null,
  estrellas_antes smallint,
  estrellas_despues smallint,
  cambiado_en timestamptz not null default now()
);

alter table alumnos_intereses_historial enable row level security;

create policy "admin ve todo" on alumnos_intereses_historial for select to authenticated
  using (mi_rol() = 'admin');
create policy "alumno ve lo suyo" on alumnos_intereses_historial for select to authenticated
  using (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
-- Nadie escribe directo: solo el trigger (security definer).

create function public.alumnos_registrar_cambio_interes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.alumnos_intereses_historial (persona_id, interes_id, estrellas_antes, estrellas_despues)
  values (
    coalesce(new.persona_id, old.persona_id),
    coalesce(new.interes_id, old.interes_id),
    case when tg_op = 'INSERT' then null else old.estrellas end,
    case when tg_op = 'DELETE' then null else new.estrellas end
  );
  return null;
end $$;

create trigger historial_alta after insert on alumnos_intereses
  for each row execute function public.alumnos_registrar_cambio_interes();
create trigger historial_cambio after update on alumnos_intereses
  for each row when (old.estrellas is distinct from new.estrellas)
  execute function public.alumnos_registrar_cambio_interes();
create trigger historial_baja after delete on alumnos_intereses
  for each row execute function public.alumnos_registrar_cambio_interes();

-- Guardar el perfil completo en un solo paso ------------------------------------------
-- Carrera (solo la primera vez), "sobre mí", "busco equipo" e intereses, todo en una
-- transacción: si algo falla, no se guarda nada. Corre con los permisos del alumno (RLS).
-- p_intereses = [{"interes_id": 1, "estrellas": 4}, ...] con los temas calificados.
create function public.alumnos_guardar_perfil(
  p_carrera_id smallint,
  p_sobre_mi text,
  p_busca_equipo boolean,
  p_intereses jsonb
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_persona uuid;
  v_calificados int;
begin
  if public.mi_rol() is distinct from 'alumno' then
    raise exception 'Solo los alumnos pueden cargar un perfil.';
  end if;
  select id into v_persona from public.personas where lower(email) = lower(auth.jwt() ->> 'email');

  select count(*) into v_calificados
  from jsonb_to_recordset(p_intereses) as x(interes_id smallint, estrellas smallint)
  join public.alumnos_intereses_maestro m on m.id = x.interes_id and m.activo
  where x.estrellas between 1 and 5;
  if v_calificados < 4 then
    raise exception 'Calificá al menos 4 temas (calificaste %).', v_calificados;
  end if;

  if not exists (select 1 from public.alumnos_carreras where persona_id = v_persona) then
    if not exists (select 1 from public.alumnos_carreras_maestro where id = p_carrera_id and activo) then
      raise exception 'Elegí tu carrera de la lista.';
    end if;
    insert into public.alumnos_carreras (persona_id, carrera_id) values (v_persona, p_carrera_id);
  end if;

  insert into public.alumnos_perfiles (persona_id, sobre_mi, busca_equipo, updated_at)
  values (v_persona, nullif(btrim(p_sobre_mi), ''), p_busca_equipo, now())
  on conflict (persona_id) do update
    set sobre_mi = excluded.sobre_mi, busca_equipo = excluded.busca_equipo, updated_at = now();

  insert into public.alumnos_intereses (persona_id, interes_id, estrellas, updated_at)
  select v_persona, x.interes_id, x.estrellas, now()
  from jsonb_to_recordset(p_intereses) as x(interes_id smallint, estrellas smallint)
  where x.estrellas between 1 and 5
  on conflict (persona_id, interes_id) do update set estrellas = excluded.estrellas, updated_at = now();

  delete from public.alumnos_intereses i
  where i.persona_id = v_persona
    and not exists (
      select 1 from jsonb_to_recordset(p_intereses) as x(interes_id smallint, estrellas smallint)
      where x.interes_id = i.interes_id and x.estrellas between 1 and 5
    );
end $$;

revoke execute on function public.alumnos_guardar_perfil(smallint, text, boolean, jsonb) from public, anon;
grant execute on function public.alumnos_guardar_perfil(smallint, text, boolean, jsonb) to authenticated;
