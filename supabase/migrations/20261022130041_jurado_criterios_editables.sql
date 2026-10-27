-- GRUPO JURADO: los criterios de evaluación se definen por evento y quedan fijos desde la primera evaluación.
-- Solo suma: una columna con valor por defecto, una tabla nueva y reglas nuevas. No se borra ni se cambia ninguna nota.
--
-- Cómo funciona
--  * Lista base: los criterios de partida. Cada evento nuevo recibe una copia al armarle el primer salón.
--    El admin también puede, mientras el evento no recibió evaluaciones, volver a la lista base o copiar la de otro evento.
--  * Cada evento tiene sus propios criterios (copias): cambiar los de un evento no toca a ningún otro.
--  * Desde que se guarda la primera evaluación de un evento (o se publican sus devoluciones) sus criterios quedan fijos.
--  * Un criterio que ya tiene notas no se renombra ni se borra.
--  * Los eventos que YA tienen evaluaciones quedan con exactamente los criterios que esas notas usaron (nada se asigna por suposición).

-- Lista base: los criterios de partida. Nunca se puntúan directamente: los eventos usan copias.
alter table jurado_criterios add column es_base boolean not null default false;

-- Largo máximo, igual que en la pantalla (nombre hasta 60, descripción hasta 200). "not valid": no revisa los criterios
-- que ya existen, solo los que se crean o cambian desde ahora.
alter table jurado_criterios add constraint jurado_criterios_largo
  check (char_length(btrim(nombre)) between 1 and 60 and char_length(coalesce(descripcion, '')) <= 200) not valid;

-- Qué criterios se puntúan en cada evento, y en qué orden.
create table jurado_evento_criterios (
  evento_id uuid not null references eventos(id) on delete cascade,
  criterio_id uuid not null references jurado_criterios(id) on delete cascade,
  orden int not null default 0,
  primary key (evento_id, criterio_id)
);
create index jurado_evento_criterios_criterio on jurado_evento_criterios (criterio_id);

-- ¿El evento ya recibió evaluaciones (o ya publicó devoluciones)? Entonces sus criterios no se tocan.
-- Corre con permisos del dueño para que la respuesta no dependa de qué evaluaciones puede ver quien pregunta.
create function jurado_evento_bloqueado(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jurado_evaluaciones where evento_id = p_evento)
      or exists (select 1 from jurado_publicaciones where evento_id = p_evento)
$$;
revoke execute on function jurado_evento_bloqueado(uuid) from public, anon;
grant execute on function jurado_evento_bloqueado(uuid) to authenticated;

-- Arma los criterios de un evento: copia la lista base o los criterios de otro evento (p_origen).
-- Reemplaza lo que el evento tenga (solo si todavía no recibió evaluaciones). Devuelve cuántos criterios quedaron.
-- Corre con los permisos de quien llama: solo el admin puede escribir estas tablas.
create function jurado_criterios_aplicar(p_evento uuid, p_origen uuid default null) returns int
language plpgsql security invoker set search_path = public as $$
declare
  viejos uuid[];
  r record;
  nuevo uuid;
  n int := 0;
begin
  if jurado_evento_bloqueado(p_evento) then
    raise exception 'Este evento ya recibió evaluaciones: sus criterios quedaron fijos';
  end if;
  if p_origen = p_evento then
    raise exception 'Elegí otro evento para copiar sus criterios';
  end if;
  if p_origen is null and not exists (select 1 from jurado_criterios where es_base) then
    raise exception 'La lista base está vacía';
  end if;
  if p_origen is not null and not exists (select 1 from jurado_evento_criterios where evento_id = p_origen) then
    raise exception 'Ese evento no tiene criterios para copiar';
  end if;

  select array_agg(criterio_id) into viejos from jurado_evento_criterios where evento_id = p_evento;
  delete from jurado_evento_criterios where evento_id = p_evento;
  -- Los criterios que eran solo de este evento y nunca se usaron ya no hacen falta.
  delete from jurado_criterios c
  where c.id = any(coalesce(viejos, '{}')) and not c.es_base
    and not exists (select 1 from jurado_evento_criterios ec where ec.criterio_id = c.id)
    and not exists (select 1 from jurado_puntajes p where p.criterio_id = c.id);

  for r in
    select nombre, descripcion from (
      select c.nombre, c.descripcion, c.orden as o from jurado_criterios c where p_origen is null and c.es_base
      union all
      select c.nombre, c.descripcion, ec.orden from jurado_evento_criterios ec join jurado_criterios c on c.id = ec.criterio_id where ec.evento_id = p_origen
    ) s order by o
  loop
    n := n + 1;
    insert into jurado_criterios (nombre, descripcion, orden) values (r.nombre, r.descripcion, n) returning id into nuevo;
    insert into jurado_evento_criterios (evento_id, criterio_id, orden) values (p_evento, nuevo, n);
  end loop;
  return n;
end $$;
revoke execute on function jurado_criterios_aplicar(uuid, uuid) from public, anon;
grant execute on function jurado_criterios_aplicar(uuid, uuid) to authenticated;

-- Un evento nuevo empieza con la lista base: al armarle el primer salón, si todavía no tiene criterios.
create function jurado_salon_criterios_base() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from jurado_evento_criterios where evento_id = new.evento_id)
     and not jurado_evento_bloqueado(new.evento_id)
     and exists (select 1 from jurado_criterios where es_base) then
    perform jurado_criterios_aplicar(new.evento_id);
  end if;
  return new;
end $$;
create trigger jurado_salon_criterios_base after insert on jurado_salones
  for each row execute function jurado_salon_criterios_base();

-- Interno (migración y datos de prueba): deja a un evento con exactamente los criterios que ya usaron sus notas.
create function jurado_criterios_fijar_usados(p_evento uuid) returns int
language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  insert into jurado_evento_criterios (evento_id, criterio_id, orden)
  select p_evento, u.criterio_id, row_number() over (order by u.orden, u.nombre)
  from (
    select distinct p.criterio_id, c.orden, c.nombre
    from jurado_evaluaciones e
    join jurado_puntajes p on p.evaluacion_id = e.id
    join jurado_criterios c on c.id = p.criterio_id
    where e.evento_id = p_evento
  ) u
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function jurado_criterios_fijar_usados(uuid) from public, anon, authenticated;

-- Datos que ya existen -------------------------------------------------------------------------------------------

-- La lista base arranca como copia de los criterios actuales (los originales se conservan: las notas viejas los usan).
insert into jurado_criterios (nombre, descripcion, orden, es_base)
select nombre, descripcion, orden, true from jurado_criterios where not es_base;

-- Cada evento que ya tiene evaluaciones queda con los criterios que sus notas usaron, ni uno más ni uno menos.
-- Las notas sin evento (anteriores a separar por evento) no pertenecen a ningún evento y no se tocan.
do $$
declare
  e record;
begin
  for e in select distinct evento_id from jurado_evaluaciones where evento_id is not null loop
    perform jurado_criterios_fijar_usados(e.evento_id);
  end loop;

  -- Aviso: eventos donde no todas las evaluaciones usaron los mismos criterios, o hay evaluaciones sin notas.
  -- No se corrige nada solo: hay que revisarlos a mano.
  for e in
    select distinct x.evento_id from jurado_evaluaciones x
    where x.evento_id is not null
      and (select count(*) from jurado_puntajes p where p.evaluacion_id = x.id)
          <> (select count(*) from jurado_evento_criterios c where c.evento_id = x.evento_id)
  loop
    raise notice 'AMBIGUO: el evento % tiene evaluaciones con distinta cantidad de notas que sus criterios; revisar a mano', e.evento_id;
  end loop;
end $$;

-- Permisos -------------------------------------------------------------------------------------------------------

alter table jurado_evento_criterios enable row level security;
create policy "admin todo" on jurado_evento_criterios for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
-- El jurado lee los criterios de los eventos para armar su planilla.
create policy "jurado lee" on jurado_evento_criterios for select to authenticated
  using (mi_rol() = 'jurado');

-- Fijos desde la primera evaluación.
create policy "fijos tras evaluar (alta)" on jurado_evento_criterios as restrictive for insert to authenticated
  with check (not jurado_evento_bloqueado(evento_id));
create policy "fijos tras evaluar (cambio)" on jurado_evento_criterios as restrictive for update to authenticated
  using (not jurado_evento_bloqueado(evento_id)) with check (not jurado_evento_bloqueado(evento_id));
create policy "fijos tras evaluar (baja)" on jurado_evento_criterios as restrictive for delete to authenticated
  using (not jurado_evento_bloqueado(evento_id));

-- Un criterio con notas, o que pertenece a un evento ya bloqueado, no se renombra ni se borra.
create policy "criterio usado no se cambia" on jurado_criterios as restrictive for update to authenticated
  using (not exists (select 1 from jurado_puntajes p where p.criterio_id = jurado_criterios.id)
    and not exists (select 1 from jurado_evento_criterios ec where ec.criterio_id = jurado_criterios.id and jurado_evento_bloqueado(ec.evento_id)));
create policy "criterio usado no se borra" on jurado_criterios as restrictive for delete to authenticated
  using (not exists (select 1 from jurado_puntajes p where p.criterio_id = jurado_criterios.id)
    and not exists (select 1 from jurado_evento_criterios ec where ec.criterio_id = jurado_criterios.id and jurado_evento_bloqueado(ec.evento_id)));

-- Un evento sin criterios no recibe evaluaciones, y solo se puntúan los criterios de ese evento.
create policy "evento con criterios" on jurado_evaluaciones as restrictive for insert to authenticated
  with check (exists (select 1 from jurado_evento_criterios ec where ec.evento_id = jurado_evaluaciones.evento_id));
create policy "solo criterios del evento (alta)" on jurado_puntajes as restrictive for insert to authenticated
  with check (exists (
    select 1 from jurado_evaluaciones e join jurado_evento_criterios ec on ec.evento_id = e.evento_id
    where e.id = jurado_puntajes.evaluacion_id and ec.criterio_id = jurado_puntajes.criterio_id));
create policy "solo criterios del evento (cambio)" on jurado_puntajes as restrictive for update to authenticated
  using (true)
  with check (exists (
    select 1 from jurado_evaluaciones e join jurado_evento_criterios ec on ec.evento_id = e.evento_id
    where e.id = jurado_puntajes.evaluacion_id and ec.criterio_id = jurado_puntajes.criterio_id));

-- Las funciones de las devoluciones cuentan solo los criterios del evento que se está revisando o publicando.
create or replace function jurado_devolucion_guardar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'));
begin
  if tg_op = 'UPDATE' and (new.evento_id, new.proyecto_id) is distinct from (old.evento_id, old.proyecto_id) then
    raise exception 'Una devolución no se puede pasar a otro equipo o evento';
  end if;

  select round(avg(p.puntaje), 2), count(distinct e.id) into new.promedio_general, new.evaluaciones
  from jurado_evaluaciones e
  join jurado_puntajes p on p.evaluacion_id = e.id
  join jurado_evento_criterios ec on ec.criterio_id = p.criterio_id and ec.evento_id = e.evento_id
  where e.evento_id = new.evento_id and e.proyecto_id = new.proyecto_id;

  select coalesce(jsonb_agg(jsonb_build_object('criterio', c.nombre, 'promedio', x.promedio) order by ec.orden), '[]') into new.promedios
  from jurado_evento_criterios ec
  join jurado_criterios c on c.id = ec.criterio_id
  cross join lateral (
    select round(avg(p.puntaje), 2) as promedio
    from jurado_evaluaciones e join jurado_puntajes p on p.evaluacion_id = e.id
    where e.evento_id = new.evento_id and e.proyecto_id = new.proyecto_id and p.criterio_id = c.id
  ) x
  where ec.evento_id = new.evento_id;

  new.huella := jurado_huella(new.evento_id, new.proyecto_id);
  new.revisada_por := yo;
  new.revisada_at := now();

  if tg_op = 'UPDATE' and jurado_evento_publicado(new.evento_id)
     and (new.comentarios is distinct from old.comentarios or new.propuestas is distinct from old.propuestas) then
    if btrim(coalesce(new.motivo_correccion, '')) = '' then
      raise exception 'Para corregir una devolución publicada hay que escribir el motivo';
    end if;
    insert into jurado_devoluciones_historial (evento_id, proyecto_id, comentarios, propuestas, motivo, cambiado_por)
    values (old.evento_id, old.proyecto_id, old.comentarios, old.propuestas, btrim(new.motivo_correccion), yo);
    new.actualizada_at := now();
  end if;
  new.motivo_correccion := null; -- cada corrección trae su propio motivo
  return new;
end $$;

create or replace function jurado_publicar_evento(p_evento uuid) returns int
language plpgsql security invoker set search_path = public as $$
declare
  total_criterios int := (select count(*) from jurado_evento_criterios where evento_id = p_evento);
  problemas text;
  equipos int;
begin
  if mi_rol() is distinct from 'admin' then
    raise exception 'Solo el admin publica las devoluciones';
  end if;
  -- Mientras se verifica y publica, nadie puede cambiar notas, ausencias, salones ni devoluciones.
  lock table jurado_evaluaciones, jurado_puntajes, jurado_devoluciones, jurado_ausencias, jurado_salon_proyectos
    in share row exclusive mode;
  if jurado_evento_publicado(p_evento) then
    raise exception 'Las devoluciones de este evento ya están publicadas';
  end if;

  with equipos as (
    select sp.proyecto_id, p.nombre
    from jurado_salon_proyectos sp join proyectos p on p.id = sp.proyecto_id
    where sp.evento_id = p_evento
      and not exists (select 1 from jurado_ausencias a where a.evento_id = p_evento and a.proyecto_id = sp.proyecto_id)
  ), estado as (
    select q.nombre,
      case
        when not exists (
          select 1 from jurado_evaluaciones e
          where e.evento_id = p_evento and e.proyecto_id = q.proyecto_id
            and total_criterios > 0 and (select count(*) from jurado_puntajes p join jurado_evento_criterios ec on ec.criterio_id = p.criterio_id and ec.evento_id = p_evento where p.evaluacion_id = e.id) >= total_criterios
        ) then 'sin evaluaciones'
        when d.proyecto_id is null then 'sin revisar'
        when d.huella is distinct from jurado_huella(p_evento, q.proyecto_id) then 'cambiaron las evaluaciones'
      end as problema
    from equipos q
    left join jurado_devoluciones d on d.evento_id = p_evento and d.proyecto_id = q.proyecto_id
  )
  select string_agg(nombre || ': ' || problema, '; ' order by nombre) filter (where problema is not null), count(*)
  into problemas, equipos
  from estado;

  if equipos = 0 then
    raise exception 'Este evento no tiene equipos para publicar';
  end if;
  if problemas is not null then
    raise exception 'No se publicó nada. Falta resolver: %', problemas;
  end if;

  -- Ni los ausentes ni los equipos que ya no están en el evento tienen devolución.
  delete from jurado_devoluciones d
  where d.evento_id = p_evento
    and (d.proyecto_id in (select proyecto_id from jurado_ausencias where evento_id = p_evento)
      or d.proyecto_id not in (select proyecto_id from jurado_salon_proyectos where evento_id = p_evento));

  insert into jurado_publicaciones (evento_id, publicada_por)
  values (p_evento, (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
  return equipos;
end $$;
