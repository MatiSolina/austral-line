-- GRUPO ALUMNOS: preguntas sobre requisitos con IA (Agente de Requerimientos Académicos).
-- Los profesores cargan el reglamento y las consignas como texto. El alumno pregunta y la IA responde SOLO
-- con ese texto, citando el fragmento en que se basa. Si no está en el texto o es ambiguo, la pregunta pasa
-- a los profesores, que la contestan desde el sistema. Cada alumno ve solo sus preguntas.
-- Costo: el lugar se reserva antes de llamar a la IA (lock por persona) y cuenta aunque falle; hasta 10 por día.

-- Reglamento y consignas (una sola fila) --------------------------------------------------------
create table alumnos_reglamento (
  id smallint primary key default 1 check (id = 1),
  texto text not null default '' check (char_length(texto) <= 60000),
  updated_at timestamptz not null default now(),
  updated_by uuid references personas(id) on delete set null
);
insert into alumnos_reglamento (id) values (1);

alter table alumnos_reglamento enable row level security;
create policy "leer con rol" on alumnos_reglamento for select to authenticated using (mi_rol() is not null);
create policy "admin escribe" on alumnos_reglamento for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Preguntas -----------------------------------------------------------------------------------
-- estado: pendiente (la IA está respondiendo) → respondida (por la IA) o derivada (a los profesores) →
-- contestada (por los profesores). error: la IA falló; también pasa a los profesores.
create table alumnos_preguntas (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  pregunta text not null check (char_length(btrim(pregunta)) between 5 and 1000),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'respondida', 'derivada', 'contestada', 'error')),
  respuesta_ia text check (char_length(respuesta_ia) <= 3000),
  cita text check (char_length(cita) <= 1500),
  respuesta_profesores text check (char_length(respuesta_profesores) <= 3000),
  respondida_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  respondida_at timestamptz,
  check (estado <> 'respondida' or (respuesta_ia is not null and cita is not null)),
  check (estado <> 'contestada' or respuesta_profesores is not null)
);
create index alumnos_preguntas_persona on alumnos_preguntas (persona_id, created_at desc);
create index alumnos_preguntas_derivadas on alumnos_preguntas (created_at) where estado in ('derivada', 'error');

alter table alumnos_preguntas enable row level security;
create policy "admin todo" on alumnos_preguntas for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "alumno ve las suyas" on alumnos_preguntas for select to authenticated
  using (mi_rol() = 'alumno' and persona_id = mi_persona_id());

-- El límite por día vive solo acá; la página lo lee de esta función.
create function public.alumnos_preguntas_limite() returns integer
language sql immutable as $$ select 10 $$;

-- Reserva la pregunta antes de llamar a la IA (cuenta para el día aunque falle).
create function public.alumnos_reservar_pregunta(p_pregunta text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := mi_persona_id();
  nueva uuid;
begin
  if mi_rol() is distinct from 'alumno' then raise exception 'Solo los alumnos hacen preguntas.'; end if;
  perform pg_advisory_xact_lock(hashtext('alumnos_preguntas:' || yo::text));
  if (
    select count(*) from alumnos_preguntas
    where persona_id = yo
      and created_at >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
  ) >= alumnos_preguntas_limite() then
    raise exception 'Ya hiciste las % preguntas de hoy. Mañana podés hacer más.', alumnos_preguntas_limite();
  end if;
  insert into alumnos_preguntas (persona_id, pregunta) values (yo, btrim(p_pregunta)) returning id into nueva;
  return nueva;
end;
$$;

-- Completa una pregunta propia pendiente: respondida (con respuesta y cita), derivada o error.
create function public.alumnos_completar_pregunta(p_pregunta uuid, p_estado text, p_respuesta text default null, p_cita text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_estado not in ('respondida', 'derivada', 'error') then raise exception 'Estado inválido.'; end if;
  update alumnos_preguntas
  set estado = p_estado,
      respuesta_ia = case when p_estado = 'respondida' then left(p_respuesta, 3000) end,
      cita = case when p_estado = 'respondida' then left(p_cita, 1500) end,
      respondida_at = case when p_estado = 'respondida' then now() end
  where id = p_pregunta and estado = 'pendiente' and persona_id = mi_persona_id();
  if not found then raise exception 'Esa pregunta no está pendiente.'; end if;
end;
$$;

-- Si la respuesta de la IA no le sirvió, el alumno la pasa a los profesores.
create function public.alumnos_derivar_pregunta(p_pregunta uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update alumnos_preguntas set estado = 'derivada'
  where id = p_pregunta and estado = 'respondida' and persona_id = mi_persona_id();
  if not found then raise exception 'Esa pregunta no se puede pasar a los profesores.'; end if;
end;
$$;

-- Preguntas de hoy del alumno logueado (para mostrar cuántas le quedan).
create function public.alumnos_preguntas_hoy() returns integer
language sql stable security invoker set search_path = public as $$
  select count(*)::integer from alumnos_preguntas
  where persona_id = mi_persona_id()
    and created_at >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
$$;

revoke execute on function public.alumnos_reservar_pregunta(text), public.alumnos_completar_pregunta(uuid, text, text, text),
  public.alumnos_derivar_pregunta(uuid), public.alumnos_preguntas_hoy() from public, anon;
grant execute on function public.alumnos_reservar_pregunta(text), public.alumnos_completar_pregunta(uuid, text, text, text),
  public.alumnos_derivar_pregunta(uuid), public.alumnos_preguntas_hoy() to authenticated;
