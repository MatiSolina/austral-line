-- GRUPO ALUMNOS: validar una entrega contra el checklist con IA (Validador de formato, segunda parte).
-- Sobre una versión ya subida, el grupo (o el dueño de la individual) pide que la IA revise el archivo contra
-- los requisitos del checklist del hito: por cada uno dice "cumple", "no cumple" o "no se puede saber" y por
-- qué. Revisa solo lo formal, nunca califica el contenido. Se puede volver a validar (queda el historial).
-- La ven quienes ven la entrega (grupo, mentor asignado y profesores; la individual, el alumno y profesores).
-- Costo: el lugar se reserva antes de llamar a la IA (lock por grupo o alumno) y cuenta aunque falle;
-- hasta 5 por día por grupo (o por alumno en las individuales).

create table alumnos_validaciones (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references alumnos_entregas(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'listo', 'error')),
  resultado jsonb,
  pedido_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  terminado_at timestamptz,
  check ((estado = 'listo') = (resultado is not null)),
  check (
    resultado is null or coalesce(
      jsonb_typeof(resultado) = 'object'
      and jsonb_typeof(resultado -> 'resumen') = 'string'
      and jsonb_typeof(resultado -> 'items') = 'array',
      false
    )
  )
);
create index alumnos_validaciones_entrega on alumnos_validaciones (entrega_id, created_at desc);

alter table alumnos_validaciones enable row level security;
create policy "admin todo" on alumnos_validaciones for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
-- Ve la validación quien puede ver la entrega (las reglas de alumnos_entregas deciden).
create policy "quien ve la entrega" on alumnos_validaciones for select to authenticated
  using (exists (select 1 from alumnos_entregas e where e.id = entrega_id));

create function public.alumnos_validaciones_limite() returns integer
language sql immutable as $$ select 5 $$;

-- Reserva la validación antes de llamar a la IA. Pueden pedirla los integrantes del grupo (o el dueño de
-- la individual), y el hito tiene que tener checklist.
create function public.alumnos_reservar_validacion(p_entrega uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e alumnos_entregas%rowtype;
  dueno text;
  nueva uuid;
begin
  select * into e from alumnos_entregas where id = p_entrega;
  if e.id is null or mi_rol() is distinct from 'alumno' or not (
    (e.proyecto_id is not null and alumnos_soy_integrante(e.proyecto_id::text))
    or (e.proyecto_id is null and e.persona_id = mi_persona_id())
  ) then
    raise exception 'Solo el grupo (o quien hizo la entrega individual) puede pedir la validación.';
  end if;
  if not exists (select 1 from alumnos_checklist_items where evento_id = e.evento_id) then
    raise exception 'Este hito no tiene checklist: no hay contra qué validar.';
  end if;
  dueno := coalesce(e.proyecto_id, e.persona_id)::text;
  perform pg_advisory_xact_lock(hashtext('alumnos_validaciones:' || dueno));
  if (
    select count(*) from alumnos_validaciones v join alumnos_entregas x on x.id = v.entrega_id
    where coalesce(x.proyecto_id, x.persona_id)::text = dueno
      and v.created_at >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
  ) >= alumnos_validaciones_limite() then
    raise exception 'Ya hicieron las % validaciones de hoy. Mañana pueden pedir otra.', alumnos_validaciones_limite();
  end if;
  insert into alumnos_validaciones (entrega_id, pedido_por) values (p_entrega, mi_persona_id()) returning id into nueva;
  return nueva;
end;
$$;

-- Completa una validación propia pendiente: 'listo' con el resultado, o 'error' sin resultado.
create function public.alumnos_completar_validacion(p_validacion uuid, p_resultado jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update alumnos_validaciones
  set estado = case when p_resultado is null then 'error' else 'listo' end, resultado = p_resultado, terminado_at = now()
  where id = p_validacion and estado = 'pendiente' and pedido_por = mi_persona_id();
  if not found then raise exception 'Esa validación no está pendiente.'; end if;
end;
$$;

revoke execute on function public.alumnos_reservar_validacion(uuid), public.alumnos_completar_validacion(uuid, jsonb) from public, anon;
grant execute on function public.alumnos_reservar_validacion(uuid), public.alumnos_completar_validacion(uuid, jsonb) to authenticated;
