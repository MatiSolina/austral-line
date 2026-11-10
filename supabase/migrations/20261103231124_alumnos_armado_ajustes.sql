-- GRUPO ALUMNOS: ajustes del armado de grupos (revisión del profe en el PR 33).
-- 1. Una idea tomada por un grupo aprobado no vuelve a quedar disponible: el alumno autor ya no le puede
--    cambiar el estado mientras la use una propuesta aprobada (los profesores sí).
-- 2. Aceptar invitaciones, crear propuestas e invitar se hacen de a uno (lock por persona y por propuesta):
--    antes, dos aceptaciones casi simultáneas podían dejar a alguien en dos grupos o pasar el tope de 6.
-- 3. Después del cierre no se puede salir de una propuesta (la salida se pide a los profesores).
-- 4. alumnos_ideas_libres(): las ideas que se pueden elegir al proponer un grupo (disponibles y sin otra
--    propuesta activa), para no ofrecer ideas que después dan error.
-- `create or replace` mantiene los permisos de las funciones que ya existían.

-- 1. Estado de una idea usada por un grupo aprobado ---------------------------------------------
create function public.alumnos_idea_estado_protegido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado
     and mi_rol() is distinct from 'admin'
     and exists (select 1 from alumnos_propuestas where idea_id = old.id and estado = 'aprobada') then
    raise exception 'Esta idea ya la tomó un grupo aprobado: solo los profesores pueden cambiar su estado.';
  end if;
  return new;
end;
$$;

create trigger alumnos_idea_estado_protegido before update on alumnos_ideas
  for each row execute function public.alumnos_idea_estado_protegido();

-- 2 y 3. Funciones del armado, ahora con locks ---------------------------------------------------
create or replace function public.alumnos_crear_propuesta(p_nombre text, p_idea uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := mi_persona_id();
  nueva uuid;
begin
  if mi_rol() is distinct from 'alumno' then raise exception 'Solo los alumnos proponen grupos.'; end if;
  if not alumnos_armado_abierto() then raise exception 'El armado de grupos ya cerró: hablá con los profesores.'; end if;
  perform pg_advisory_xact_lock(hashtext('alumnos_persona:' || yo::text));
  if alumnos_ocupado(yo) then raise exception 'Ya estás en un grupo o en una propuesta.'; end if;
  if p_idea is not null and not alumnos_idea_libre(p_idea) then
    raise exception 'Esa idea ya la tomó otro grupo o ya no está disponible. Elegí otra o dejala para más adelante.';
  end if;
  insert into alumnos_propuestas (nombre, idea_id, creada_por) values (btrim(p_nombre), p_idea, yo) returning id into nueva;
  insert into alumnos_propuesta_miembros (propuesta_id, persona_id, estado, invitado_por, respondido_at)
  values (nueva, yo, 'aceptado', yo, now());
  return nueva;
end;
$$;

create or replace function public.alumnos_invitar(p_propuesta uuid, p_persona uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := mi_persona_id();
begin
  if not exists (
    select 1 from alumnos_propuesta_miembros m join alumnos_propuestas p on p.id = m.propuesta_id
    where m.propuesta_id = p_propuesta and m.persona_id = yo and m.estado = 'aceptado' and p.estado = 'armando'
  ) then raise exception 'Solo los integrantes de una propuesta en armado pueden invitar.'; end if;
  if not alumnos_armado_abierto() then raise exception 'El armado de grupos ya cerró.'; end if;
  perform 1 from alumnos_propuestas where id = p_propuesta for update;
  if not exists (select 1 from personas where id = p_persona and rol = 'alumno') then raise exception 'Solo se puede invitar a alumnos.'; end if;
  if alumnos_ocupado(p_persona) then raise exception 'Esa persona ya está en un grupo o en otra propuesta.'; end if;
  if (select count(*) from alumnos_propuesta_miembros where propuesta_id = p_propuesta and estado in ('invitado', 'aceptado')) >= 6 then
    raise exception 'El grupo ya tiene 6 integrantes o invitaciones.';
  end if;
  insert into alumnos_propuesta_miembros (propuesta_id, persona_id, estado, invitado_por)
  values (p_propuesta, p_persona, 'invitado', yo)
  on conflict (propuesta_id, persona_id) do update
    set estado = 'invitado', invitado_por = excluded.invitado_por, created_at = now(), respondido_at = null
    where alumnos_propuesta_miembros.estado = 'rechazado';
end;
$$;

create or replace function public.alumnos_responder_invitacion(p_propuesta uuid, p_acepta boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := mi_persona_id();
begin
  if not alumnos_armado_abierto() then raise exception 'El armado de grupos ya cerró: hablá con los profesores.'; end if;
  if not exists (select 1 from alumnos_propuesta_miembros where propuesta_id = p_propuesta and persona_id = yo and estado = 'invitado') then
    raise exception 'No tenés una invitación pendiente a ese grupo.';
  end if;
  if p_acepta then
    -- Una persona acepta de a una invitación, y cada propuesta suma de a un integrante: sin esto, dos
    -- aceptaciones casi simultáneas pasaban los dos controles.
    perform pg_advisory_xact_lock(hashtext('alumnos_persona:' || yo::text));
    perform 1 from alumnos_propuestas where id = p_propuesta for update;
    if alumnos_ocupado(yo) then raise exception 'Ya estás en un grupo o en otra propuesta: salí de esa antes de aceptar.'; end if;
    if (select estado from alumnos_propuestas where id = p_propuesta) is distinct from 'armando' then
      raise exception 'Esa propuesta ya no está en armado.';
    end if;
    if (select count(*) from alumnos_propuesta_miembros where propuesta_id = p_propuesta and estado = 'aceptado') >= 6 then
      raise exception 'El grupo ya está completo.';
    end if;
  end if;
  update alumnos_propuesta_miembros
  set estado = case when p_acepta then 'aceptado' else 'rechazado' end, respondido_at = now()
  where propuesta_id = p_propuesta and persona_id = yo;
end;
$$;

create or replace function public.alumnos_salir_propuesta(p_propuesta uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := mi_persona_id();
  otro uuid;
begin
  if not alumnos_armado_abierto() then
    raise exception 'El armado de grupos ya cerró: para salir de un grupo, pedíselo a los profesores.';
  end if;
  perform 1 from alumnos_propuestas where id = p_propuesta for update;
  if not exists (
    select 1 from alumnos_propuesta_miembros m join alumnos_propuestas p on p.id = m.propuesta_id
    where m.propuesta_id = p_propuesta and m.persona_id = yo and m.estado = 'aceptado' and p.estado in ('armando', 'enviada')
  ) then raise exception 'No estás en esa propuesta.'; end if;
  update alumnos_propuesta_miembros set estado = 'rechazado', respondido_at = now()
  where propuesta_id = p_propuesta and persona_id = yo;
  select persona_id into otro from alumnos_propuesta_miembros
  where propuesta_id = p_propuesta and estado = 'aceptado' order by respondido_at limit 1;
  if otro is null then
    update alumnos_propuestas set estado = 'cancelada', updated_at = now() where id = p_propuesta;
  else
    -- Si estaba enviada, vuelve a armado (cambió el grupo); si se fue quien la creó, pasa a otro integrante.
    update alumnos_propuestas
    set estado = 'armando',
        creada_por = case when creada_por = yo then otro else creada_por end,
        updated_at = now()
    where id = p_propuesta;
  end if;
end;
$$;

-- 4. Ideas que se pueden elegir al proponer un grupo -------------------------------------------
create function public.alumnos_ideas_libres() returns table (id uuid, titulo text)
language sql stable security definer set search_path = public as $$
  select i.id, i.titulo from alumnos_ideas i
  where mi_rol() in ('alumno', 'admin') and alumnos_idea_libre(i.id)
  order by i.titulo
$$;
revoke execute on function public.alumnos_ideas_libres() from public, anon;
grant execute on function public.alumnos_ideas_libres() to authenticated;
