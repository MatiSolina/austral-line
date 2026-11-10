-- GRUPO ALUMNOS: análisis de competencia con IA (Agente de Competencia y Originalidad).
-- El grupo completa un breve de su proyecto (problema, solución, a quién apunta y mercado). Con eso, la IA busca
-- en internet competidores actuales y arma un análisis: competidores con su fuente, diferenciales, alertas y
-- preguntas que desafíen la propuesta. Nunca dice que una idea es "original" de forma absoluta.
-- Lo ven el grupo, su mentor asignado y los profesores. Cada grupo puede pedir hasta 3 análisis por día
-- (hora de Argentina); se guardan todos, como historial.
--
-- Costo: el lugar se reserva ANTES de llamar a la IA (alumnos_reservar_analisis, con un lock por proyecto),
-- así varios pedidos a la vez no pasan todos el control, y un análisis que falla igual cuenta para el día.
-- Después la app lo completa (alumnos_completar_analisis) como 'listo' con el resultado, o como 'error'.
-- El cliente no inserta ni edita filas directo: solo por esas dos funciones, y el resultado tiene que tener
-- la forma esperada (check), para que un JSON roto no rompa la página del grupo ni la del mentor.

-- Breve del proyecto (una fila por proyecto; la edita cualquier integrante) ----------------------
create table alumnos_competencia_breve (
  proyecto_id uuid primary key references proyectos(id) on delete cascade,
  problema text not null check (char_length(btrim(problema)) between 10 and 1500),
  solucion text not null check (char_length(btrim(solucion)) between 10 and 1500),
  publico text not null check (char_length(btrim(publico)) between 3 and 500),
  mercado text not null check (char_length(btrim(mercado)) between 2 and 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references personas(id) on delete set null
);

alter table alumnos_competencia_breve enable row level security;
create policy "admin todo" on alumnos_competencia_breve for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "grupo y mentor leen" on alumnos_competencia_breve for select to authenticated
  using ((mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text)) or alumnos_soy_mentor(proyecto_id::text));
create policy "grupo carga" on alumnos_competencia_breve for insert to authenticated
  with check (mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text) and updated_by = mi_persona_id());
create policy "grupo actualiza" on alumnos_competencia_breve for update to authenticated
  using (mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text))
  with check (mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text) and updated_by = mi_persona_id());

-- Análisis (historial; no se borran) --------------------------------------------------------------
create table alumnos_competencia_analisis (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'listo', 'error')),
  breve jsonb not null,      -- copia del breve con el que se hizo
  resultado jsonb,           -- competidores, diferenciales, alertas, preguntas, fuentes (solo si está listo)
  modelo text,
  pedido_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  terminado_at timestamptz,
  check ((estado = 'listo') = (resultado is not null)),
  check (
    -- coalesce: si falta un campo, jsonb_typeof da null y el check lo dejaría pasar.
    resultado is null or coalesce(
      jsonb_typeof(resultado) = 'object'
      and jsonb_typeof(resultado -> 'resumen') = 'string'
      and jsonb_typeof(resultado -> 'competidores') = 'array'
      and jsonb_typeof(resultado -> 'diferenciales') = 'array'
      and jsonb_typeof(resultado -> 'alertas') = 'array'
      and jsonb_typeof(resultado -> 'preguntas') = 'array'
      and jsonb_typeof(resultado -> 'fuentes') = 'array',
      false
    )
  )
);
create index alumnos_competencia_analisis_proyecto on alumnos_competencia_analisis (proyecto_id, created_at desc);

alter table alumnos_competencia_analisis enable row level security;
create policy "admin todo" on alumnos_competencia_analisis for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "grupo y mentor leen" on alumnos_competencia_analisis for select to authenticated
  using ((mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text)) or alumnos_soy_mentor(proyecto_id::text));

-- El límite por día vive solo acá; la página lo lee de esta función.
create function public.alumnos_analisis_limite() returns integer
language sql immutable as $$ select 3 $$;

-- Análisis pedidos hoy (día de Argentina), en cualquier estado. Security invoker: cada uno cuenta solo
-- las filas que puede ver (las de su grupo).
create function public.alumnos_analisis_hoy(p_proyecto uuid) returns integer
language sql stable security invoker set search_path = public as $$
  select count(*)::integer from alumnos_competencia_analisis
  where proyecto_id = p_proyecto
    and created_at >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
$$;

-- Reserva un lugar antes de llamar a la IA. El lock por proyecto hace que dos pedidos simultáneos se
-- cuenten de a uno. Copia el breve actual y devuelve el id de la fila pendiente.
create function public.alumnos_reservar_analisis(p_proyecto uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  copia jsonb;
  nuevo uuid;
begin
  if mi_rol() is distinct from 'alumno' or not alumnos_soy_integrante(p_proyecto::text) then
    raise exception 'Solo los integrantes del grupo pueden pedir el análisis.';
  end if;
  perform pg_advisory_xact_lock(hashtext('alumnos_competencia:' || p_proyecto::text));
  if (
    select count(*) from alumnos_competencia_analisis
    where proyecto_id = p_proyecto
      and created_at >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
  ) >= alumnos_analisis_limite() then
    raise exception 'Ya hicieron los % análisis de hoy. Mañana pueden pedir otro.', alumnos_analisis_limite();
  end if;
  select jsonb_build_object('problema', problema, 'solucion', solucion, 'publico', publico, 'mercado', mercado)
  into copia from alumnos_competencia_breve where proyecto_id = p_proyecto;
  if copia is null then raise exception 'Primero completen y guarden el breve del proyecto.'; end if;
  insert into alumnos_competencia_analisis (proyecto_id, breve, pedido_por)
  values (p_proyecto, copia, mi_persona_id())
  returning id into nuevo;
  return nuevo;
end;
$$;

-- Completa una reserva propia que sigue pendiente: 'listo' con el resultado, o 'error' sin resultado.
create function public.alumnos_completar_analisis(p_analisis uuid, p_resultado jsonb default null, p_modelo text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update alumnos_competencia_analisis
  set estado = case when p_resultado is null then 'error' else 'listo' end,
      resultado = p_resultado, modelo = p_modelo, terminado_at = now()
  where id = p_analisis and estado = 'pendiente' and pedido_por = mi_persona_id();
  if not found then raise exception 'Ese análisis no está pendiente.'; end if;
end;
$$;

revoke execute on function public.alumnos_analisis_hoy(uuid), public.alumnos_reservar_analisis(uuid),
  public.alumnos_completar_analisis(uuid, jsonb, text) from public, anon;
grant execute on function public.alumnos_analisis_hoy(uuid), public.alumnos_reservar_analisis(uuid),
  public.alumnos_completar_analisis(uuid, jsonb, text) to authenticated;
