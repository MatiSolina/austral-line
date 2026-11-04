-- GRUPO ALUMNOS: armado de grupos (Agente de Armado y Gestión de Grupos).
-- 1. Un alumno sin grupo propone uno (nombre tentativo y, si quiere, una idea del banco) e invita compañeros.
-- 2. Cada invitado acepta o rechaza. El grupo tiene de 2 a 6 integrantes y tiene que ser interdisciplinario.
-- 3. Lo envían a los profesores, que lo aprueban (se crea el proyecto con sus integrantes) o lo devuelven.
-- 4. Los profesores fijan la fecha de cierre del armado. Después, los cambios de grupo son solicitudes que
--    aprueban o rechazan los profesores.
-- Los alumnos solo escriben en tablas de este grupo. El proyecto (core) lo crean los profesores al aprobar,
-- con sus propios permisos de admin (funciones security invoker).

-- Configuración: fecha de cierre del armado (una sola fila) -------------------------------------
create table alumnos_armado_config (
  id smallint primary key default 1 check (id = 1),
  cierre timestamptz,
  updated_at timestamptz not null default now()
);
insert into alumnos_armado_config (id, cierre) values (1, null);

alter table alumnos_armado_config enable row level security;
create policy "leer con rol" on alumnos_armado_config for select to authenticated using (mi_rol() is not null);
create policy "admin escribe" on alumnos_armado_config for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

create function public.alumnos_armado_abierto() returns boolean
language sql stable security invoker set search_path = public as $$
  select coalesce((select cierre is null or now() < cierre from alumnos_armado_config where id = 1), true)
$$;

-- Propuestas de grupo y sus integrantes -------------------------------------------------------
create table alumnos_propuestas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 2 and 80),
  idea_id uuid references alumnos_ideas(id) on delete set null,
  creada_por uuid references personas(id) on delete set null,
  estado text not null default 'armando' check (estado in ('armando', 'enviada', 'aprobada', 'cancelada')),
  comentario_profesores text check (char_length(comentario_profesores) <= 1000),
  proyecto_id uuid references proyectos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table alumnos_propuesta_miembros (
  propuesta_id uuid not null references alumnos_propuestas(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  estado text not null check (estado in ('invitado', 'aceptado', 'rechazado')),
  invitado_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  respondido_at timestamptz,
  primary key (propuesta_id, persona_id)
);

-- Propuestas en las que participo (invitado, aceptado o que rechacé). Security definer para que la
-- política de miembros pueda usarla sin consultarse a sí misma.
create function public.alumnos_mis_propuestas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select propuesta_id from alumnos_propuesta_miembros where persona_id = mi_persona_id()
$$;

-- Integrantes que ya aceptaron una propuesta activa (en armado o enviada) donde yo estoy invitado o
-- soy integrante. Solo de ellos se ve la carrera: un invitado que todavía no aceptó, o que rechazó,
-- no muestra la suya.
create function public.alumnos_companeros_de_propuesta() returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.persona_id
  from alumnos_propuesta_miembros m
  join alumnos_propuestas p on p.id = m.propuesta_id
  where m.estado = 'aceptado' and p.estado in ('armando', 'enviada')
    and exists (
      select 1 from alumnos_propuesta_miembros yo
      where yo.propuesta_id = m.propuesta_id and yo.persona_id = mi_persona_id() and yo.estado in ('invitado', 'aceptado')
    )
$$;

alter table alumnos_propuestas enable row level security;
create policy "admin todo" on alumnos_propuestas for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "alumno ve las suyas" on alumnos_propuestas for select to authenticated
  using (mi_rol() = 'alumno' and id in (select alumnos_mis_propuestas()));

alter table alumnos_propuesta_miembros enable row level security;
create policy "admin todo" on alumnos_propuesta_miembros for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "alumno ve los de sus propuestas" on alumnos_propuesta_miembros for select to authenticated
  using (mi_rol() = 'alumno' and propuesta_id in (select alumnos_mis_propuestas()));

-- Para chequear la interdisciplinariedad, cada alumno ve la carrera de quienes ya aceptaron sus propuestas activas.
create policy "alumno ve la carrera de los de sus propuestas" on alumnos_carreras for select to authenticated
  using (mi_rol() = 'alumno' and persona_id in (select alumnos_companeros_de_propuesta()));

-- Solicitudes de cambio de grupo ---------------------------------------------------------------
-- proyecto_destino = null: pide salir del grupo.
create table alumnos_solicitudes_cambio (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  proyecto_origen uuid not null references proyectos(id) on delete cascade,
  proyecto_destino uuid references proyectos(id) on delete set null,
  motivo text not null check (char_length(btrim(motivo)) between 5 and 500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  respuesta text check (char_length(respuesta) <= 1000),
  resuelta_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  resuelta_at timestamptz,
  check (proyecto_destino is distinct from proyecto_origen)
);

-- Una sola solicitud pendiente por alumno.
create unique index alumnos_solicitudes_una_pendiente on alumnos_solicitudes_cambio (persona_id) where estado = 'pendiente';

alter table alumnos_solicitudes_cambio enable row level security;
create policy "admin todo" on alumnos_solicitudes_cambio for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "alumno ve las suyas" on alumnos_solicitudes_cambio for select to authenticated
  using (mi_rol() = 'alumno' and persona_id = mi_persona_id());
-- El alumno solo carga el pedido: la respuesta de los profesores queda vacía.
create policy "alumno pide desde su grupo" on alumnos_solicitudes_cambio for insert to authenticated
  with check (
    mi_rol() = 'alumno'
    and persona_id = mi_persona_id()
    and estado = 'pendiente'
    and respuesta is null and resuelta_por is null and resuelta_at is null
    and exists (select 1 from proyecto_integrantes where proyecto_id = proyecto_origen and persona_id = mi_persona_id())
  );
-- Para cancelar no hay regla de update: lo hace alumnos_cancelar_solicitud, que solo cambia el estado.

-- Reglas comunes ------------------------------------------------------------------------------
-- ¿La persona ya está en un proyecto o en una propuesta activa?
create function public.alumnos_ocupado(p_persona uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from proyecto_integrantes where persona_id = p_persona)
      or exists (
        select 1 from alumnos_propuesta_miembros m join alumnos_propuestas p on p.id = m.propuesta_id
        where m.persona_id = p_persona and m.estado = 'aceptado' and p.estado in ('armando', 'enviada')
      )
$$;

-- Acciones de los alumnos (security definer: validan todo antes de escribir en tablas de este grupo) --
-- ¿La idea se puede elegir? Tiene que estar disponible y que no la use otra propuesta activa.
create function public.alumnos_idea_libre(p_idea uuid, p_salvo uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from alumnos_ideas where id = p_idea and estado = 'disponible')
     and not exists (
       select 1 from alumnos_propuestas
       where idea_id = p_idea and estado in ('armando', 'enviada') and id is distinct from p_salvo
     )
$$;

create function public.alumnos_crear_propuesta(p_nombre text, p_idea uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := mi_persona_id();
  nueva uuid;
begin
  if mi_rol() is distinct from 'alumno' then raise exception 'Solo los alumnos proponen grupos.'; end if;
  if not alumnos_armado_abierto() then raise exception 'El armado de grupos ya cerró: hablá con los profesores.'; end if;
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

create function public.alumnos_invitar(p_propuesta uuid, p_persona uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := mi_persona_id();
begin
  if not exists (
    select 1 from alumnos_propuesta_miembros m join alumnos_propuestas p on p.id = m.propuesta_id
    where m.propuesta_id = p_propuesta and m.persona_id = yo and m.estado = 'aceptado' and p.estado = 'armando'
  ) then raise exception 'Solo los integrantes de una propuesta en armado pueden invitar.'; end if;
  if not alumnos_armado_abierto() then raise exception 'El armado de grupos ya cerró.'; end if;
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

create function public.alumnos_responder_invitacion(p_propuesta uuid, p_acepta boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := mi_persona_id();
begin
  if not alumnos_armado_abierto() then raise exception 'El armado de grupos ya cerró: hablá con los profesores.'; end if;
  if not exists (select 1 from alumnos_propuesta_miembros where propuesta_id = p_propuesta and persona_id = yo and estado = 'invitado') then
    raise exception 'No tenés una invitación pendiente a ese grupo.';
  end if;
  if p_acepta then
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

create function public.alumnos_salir_propuesta(p_propuesta uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := mi_persona_id();
  otro uuid;
begin
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

create function public.alumnos_enviar_propuesta(p_propuesta uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := mi_persona_id();
  cantidad integer;
  sin_carrera integer;
  carreras integer;
begin
  if not exists (
    select 1 from alumnos_propuesta_miembros m join alumnos_propuestas p on p.id = m.propuesta_id
    where m.propuesta_id = p_propuesta and m.persona_id = yo and m.estado = 'aceptado' and p.estado = 'armando'
  ) then raise exception 'Solo los integrantes de una propuesta en armado pueden enviarla.'; end if;

  select count(*), count(*) filter (where c.carrera_id is null), count(distinct c.carrera_id)
  into cantidad, sin_carrera, carreras
  from alumnos_propuesta_miembros m left join alumnos_carreras c on c.persona_id = m.persona_id
  where m.propuesta_id = p_propuesta and m.estado = 'aceptado';

  if cantidad < 2 or cantidad > 6 then raise exception 'El grupo tiene que tener entre 2 y 6 integrantes (tiene %).', cantidad; end if;
  if sin_carrera > 0 then raise exception 'Todos los integrantes tienen que elegir su carrera en Mi perfil.'; end if;
  if carreras < 2 then raise exception 'El grupo tiene que ser interdisciplinario: al menos 2 carreras distintas.'; end if;

  -- Las invitaciones que nadie contestó dejan de valer al enviar.
  delete from alumnos_propuesta_miembros where propuesta_id = p_propuesta and estado = 'invitado';
  update alumnos_propuestas set estado = 'enviada', comentario_profesores = null, updated_at = now() where id = p_propuesta;
end;
$$;

-- Lista de compañeros para invitar: alumnos sin grupo ni propuesta. La carrera se muestra solo de
-- quienes buscan equipo (como en Compañeros afines).
create function public.alumnos_candidatos(p_propuesta uuid)
returns table (persona_id uuid, nombre text, email text, carrera text, busca_equipo boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not exists (
    select 1 from alumnos_propuesta_miembros yo
    where yo.propuesta_id = p_propuesta and yo.persona_id = mi_persona_id() and yo.estado = 'aceptado'
  ) then return; end if;
  return query
    select pe.id, pe.nombre, pc.email,
           case when coalesce(pf.busca_equipo, false) then cm.nombre end,
           coalesce(pf.busca_equipo, false)
    from personas pe
    join personas_contacto pc on pc.id = pe.id
    left join alumnos_perfiles pf on pf.persona_id = pe.id
    left join alumnos_carreras c on c.persona_id = pe.id
    left join alumnos_carreras_maestro cm on cm.id = c.carrera_id
    where pe.rol = 'alumno'
      and not alumnos_ocupado(pe.id)
      and not exists (
        select 1 from alumnos_propuesta_miembros m
        where m.propuesta_id = p_propuesta and m.persona_id = pe.id and m.estado in ('invitado', 'aceptado')
      )
    order by coalesce(pf.busca_equipo, false) desc, pe.nombre;
end;
$$;

-- El alumno cancela su solicitud pendiente: solo cambia el estado, nada más.
create function public.alumnos_cancelar_solicitud(p_solicitud uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if mi_rol() is distinct from 'alumno' then raise exception 'Solo los alumnos cancelan sus solicitudes.'; end if;
  update alumnos_solicitudes_cambio set estado = 'cancelada'
  where id = p_solicitud and persona_id = mi_persona_id() and estado = 'pendiente';
  if not found then raise exception 'No tenés una solicitud pendiente con ese número.'; end if;
end;
$$;

-- Acciones de los profesores (security invoker: usan sus permisos de admin sobre el core) ---------
create function public.alumnos_aprobar_propuesta(p_propuesta uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  prop alumnos_propuestas%rowtype;
  nuevo uuid;
begin
  if mi_rol() is distinct from 'admin' then raise exception 'Solo los profesores aprueban grupos.'; end if;
  select * into prop from alumnos_propuestas where id = p_propuesta for update;
  if prop.id is null or prop.estado <> 'enviada' then raise exception 'La propuesta no está esperando aprobación.'; end if;
  if exists (
    select 1 from alumnos_propuesta_miembros m join proyecto_integrantes i on i.persona_id = m.persona_id
    where m.propuesta_id = p_propuesta and m.estado = 'aceptado'
  ) then raise exception 'Algún integrante ya está en otro proyecto.'; end if;
  if prop.idea_id is not null and not alumnos_idea_libre(prop.idea_id, prop.id) then
    raise exception 'La idea de esta propuesta ya la tomó otro grupo: devolvésela para que elijan otra.';
  end if;

  insert into proyectos (nombre, descripcion)
  values (prop.nombre, (select descripcion from alumnos_ideas where id = prop.idea_id))
  returning id into nuevo;
  insert into proyecto_integrantes (proyecto_id, persona_id)
  select nuevo, persona_id from alumnos_propuesta_miembros where propuesta_id = p_propuesta and estado = 'aceptado';
  update alumnos_propuestas set estado = 'aprobada', proyecto_id = nuevo, updated_at = now() where id = p_propuesta;
  if prop.idea_id is not null then
    update alumnos_ideas set estado = 'tomada', updated_at = now() where id = prop.idea_id;
  end if;
  return nuevo;
end;
$$;

create function public.alumnos_devolver_propuesta(p_propuesta uuid, p_comentario text) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if mi_rol() is distinct from 'admin' then raise exception 'Solo los profesores devuelven propuestas.'; end if;
  update alumnos_propuestas
  set estado = 'armando', comentario_profesores = nullif(btrim(p_comentario), ''), updated_at = now()
  where id = p_propuesta and estado = 'enviada';
  if not found then raise exception 'La propuesta no está esperando aprobación.'; end if;
end;
$$;

create function public.alumnos_resolver_solicitud(p_solicitud uuid, p_aprobar boolean, p_respuesta text) returns void
language plpgsql security invoker set search_path = public as $$
declare
  sol alumnos_solicitudes_cambio%rowtype;
begin
  if mi_rol() is distinct from 'admin' then raise exception 'Solo los profesores resuelven solicitudes.'; end if;
  select * into sol from alumnos_solicitudes_cambio where id = p_solicitud for update;
  if sol.id is null or sol.estado <> 'pendiente' then raise exception 'La solicitud ya fue resuelta.'; end if;
  if p_aprobar then
    if sol.proyecto_destino is not null
       and (select count(*) from proyecto_integrantes where proyecto_id = sol.proyecto_destino) >= 6 then
      raise exception 'El grupo de destino ya tiene 6 integrantes.';
    end if;
    delete from proyecto_integrantes where proyecto_id = sol.proyecto_origen and persona_id = sol.persona_id;
    if sol.proyecto_destino is not null then
      insert into proyecto_integrantes (proyecto_id, persona_id) values (sol.proyecto_destino, sol.persona_id)
      on conflict do nothing;
    end if;
  end if;
  update alumnos_solicitudes_cambio
  set estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
      respuesta = nullif(btrim(p_respuesta), ''), resuelta_por = mi_persona_id(), resuelta_at = now()
  where id = p_solicitud;
end;
$$;

-- Permisos de ejecución ----------------------------------------------------------------------
-- alumnos_ocupado no se habilita: solo la usan otras funciones security definer. alumnos_idea_libre sí,
-- porque la usa alumnos_aprobar_propuesta, que corre con los permisos del profesor.
revoke execute on function
  public.alumnos_armado_abierto(), public.alumnos_mis_propuestas(), public.alumnos_companeros_de_propuesta(),
  public.alumnos_ocupado(uuid), public.alumnos_idea_libre(uuid, uuid),
  public.alumnos_crear_propuesta(text, uuid), public.alumnos_invitar(uuid, uuid),
  public.alumnos_responder_invitacion(uuid, boolean), public.alumnos_salir_propuesta(uuid),
  public.alumnos_enviar_propuesta(uuid), public.alumnos_candidatos(uuid), public.alumnos_cancelar_solicitud(uuid),
  public.alumnos_aprobar_propuesta(uuid), public.alumnos_devolver_propuesta(uuid, text),
  public.alumnos_resolver_solicitud(uuid, boolean, text)
from public, anon, authenticated;
grant execute on function
  public.alumnos_armado_abierto(), public.alumnos_mis_propuestas(), public.alumnos_companeros_de_propuesta(),
  public.alumnos_idea_libre(uuid, uuid), public.alumnos_crear_propuesta(text, uuid), public.alumnos_invitar(uuid, uuid),
  public.alumnos_responder_invitacion(uuid, boolean), public.alumnos_salir_propuesta(uuid),
  public.alumnos_enviar_propuesta(uuid), public.alumnos_candidatos(uuid), public.alumnos_cancelar_solicitud(uuid),
  public.alumnos_aprobar_propuesta(uuid), public.alumnos_devolver_propuesta(uuid, text),
  public.alumnos_resolver_solicitud(uuid, boolean, text)
to authenticated;
