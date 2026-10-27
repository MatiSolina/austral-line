-- GRUPO JURADO: devoluciones del jurado a los alumnos, por evento.
-- El admin revisa en privado la devolución de cada equipo (puede editar los textos, nunca las notas) y,
-- cuando están todas listas, las publica juntas. Al publicar se cierran las notas y los salones de ese evento.
-- Cada alumno ve solo la devolución publicada de su equipo, sin nombres de jurados ni ranking.

-- Equipos marcados como "No se presentó": siguen en su salón, pero no reciben devolución ni mail.
create table jurado_ausencias (
  evento_id uuid not null references eventos(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  marcado_por uuid references personas(id) on delete set null,
  marcado_at timestamptz not null default now(),
  primary key (evento_id, proyecto_id)
);

-- Un evento publicado. No se despublica.
create table jurado_publicaciones (
  evento_id uuid primary key references eventos(id) on delete cascade,
  publicada_por uuid references personas(id) on delete set null,
  publicada_at timestamptz not null default now()
);

create table jurado_devoluciones (
  evento_id uuid not null references eventos(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  -- Textos que ve el equipo: el admin los revisa y edita (por ejemplo, para que no identifiquen al jurado). Sin nombres.
  comentarios text[] not null default '{}',
  propuestas text[] not null default '{}',
  -- Notas: las calcula siempre la base desde las evaluaciones del evento (trigger de abajo). Lo que alguien escriba acá se ignora.
  promedio_general numeric(4, 2),
  promedios jsonb not null default '[]',
  evaluaciones int not null default 0,
  -- "Foto" de las evaluaciones cuando el admin la revisó: si cambian, hay que revisar de nuevo antes de publicar.
  huella text,
  revisada_por uuid references personas(id) on delete set null,
  revisada_at timestamptz,
  -- Correcciones después de publicar: fecha visible para el equipo y motivo obligatorio (va al historial).
  actualizada_at timestamptz,
  motivo_correccion text,
  primary key (evento_id, proyecto_id)
);

-- Los textos originales de los jurados tal como los vio el admin al revisar (misma posición que en la devolución).
-- Sirven para conservar sus ediciones si las evaluaciones cambian y para marcar qué texto es nuevo.
-- Van en una tabla aparte, solo para el admin: los originales pueden nombrar al jurado y el equipo no debe poder leerlos.
create table jurado_devoluciones_vistos (
  evento_id uuid not null,
  proyecto_id uuid not null,
  comentarios text[] not null default '{}',
  propuestas text[] not null default '{}',
  primary key (evento_id, proyecto_id),
  foreign key (evento_id, proyecto_id) references jurado_devoluciones(evento_id, proyecto_id) on delete cascade
);

-- Historial interno de correcciones posteriores a la publicación (solo lo ve el admin).
create table jurado_devoluciones_historial (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  proyecto_id uuid not null,
  comentarios text[] not null,
  propuestas text[] not null,
  motivo text not null,
  cambiado_por uuid references personas(id) on delete set null,
  cambiado_at timestamptz not null default now(),
  foreign key (evento_id, proyecto_id) references jurado_devoluciones(evento_id, proyecto_id) on delete cascade
);

-- Mails de aviso a los integrantes, después de publicar. Si uno falla, el equipo igual ve su devolución.
create table jurado_devolucion_envios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  persona_id uuid references personas(id) on delete set null,
  email text not null,
  estado text not null check (estado in ('enviado', 'simulado', 'error')),
  resend_id text,
  error text,
  created_at timestamptz not null default now()
);

create function jurado_evento_publicado(p_evento uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from jurado_publicaciones where evento_id = p_evento)
$$;

-- Resumen de las evaluaciones de un equipo en un evento: cambia si cambia cualquier nota o texto.
create function jurado_huella(p_evento uuid, p_proyecto uuid) returns text
language sql stable security invoker set search_path = public as $$
  select md5(coalesce(string_agg(concat_ws('|', e.id, e.propuesta_valor, e.comentarios,
    (select string_agg(p.criterio_id || ':' || p.puntaje, ',' order by p.criterio_id) from jurado_puntajes p where p.evaluacion_id = e.id)
  ), '#' order by e.id), ''))
  from jurado_evaluaciones e
  where e.evento_id = p_evento and e.proyecto_id = p_proyecto
$$;

-- Cada vez que el admin guarda una devolución: recalcula las notas, toma la "foto" y, si ya estaba publicada,
-- exige motivo y guarda la versión anterior en el historial. Corre con permisos del dueño para poder escribir el historial.
create function jurado_devolucion_guardar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'));
begin
  if tg_op = 'UPDATE' and (new.evento_id, new.proyecto_id) is distinct from (old.evento_id, old.proyecto_id) then
    raise exception 'Una devolución no se puede pasar a otro equipo o evento';
  end if;

  select round(avg(p.puntaje), 2), count(distinct e.id) into new.promedio_general, new.evaluaciones
  from jurado_evaluaciones e join jurado_puntajes p on p.evaluacion_id = e.id
  where e.evento_id = new.evento_id and e.proyecto_id = new.proyecto_id;

  select coalesce(jsonb_agg(jsonb_build_object('criterio', c.nombre, 'promedio', x.promedio) order by c.orden), '[]') into new.promedios
  from jurado_criterios c
  cross join lateral (
    select round(avg(p.puntaje), 2) as promedio
    from jurado_evaluaciones e join jurado_puntajes p on p.evaluacion_id = e.id
    where e.evento_id = new.evento_id and e.proyecto_id = new.proyecto_id and p.criterio_id = c.id
  ) x;

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
create trigger jurado_devolucion_guardar before insert or update on jurado_devoluciones
  for each row execute function jurado_devolucion_guardar();

-- Publica todas las devoluciones del evento juntas, o ninguna. Devuelve cuántos equipos quedaron publicados.
-- Corre con los permisos del admin que la llama.
create function jurado_publicar_evento(p_evento uuid) returns int
language plpgsql security invoker set search_path = public as $$
declare
  total_criterios int := (select count(*) from jurado_criterios);
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
            and (select count(*) from jurado_puntajes p where p.evaluacion_id = e.id) >= total_criterios
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

revoke execute on function jurado_evento_publicado(uuid), jurado_huella(uuid, uuid), jurado_publicar_evento(uuid) from public, anon;
grant execute on function jurado_evento_publicado(uuid), jurado_huella(uuid, uuid), jurado_publicar_evento(uuid) to authenticated;

-- Permisos ---------------------------------------------------------------------------------------------------

alter table jurado_ausencias enable row level security;
create policy "admin todo" on jurado_ausencias for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

alter table jurado_publicaciones enable row level security;
create policy "admin publica" on jurado_publicaciones for insert to authenticated with check (mi_rol() = 'admin');
-- Saber qué eventos están publicados no revela nada de nadie; lo usan las reglas de abajo.
create policy "leer con rol" on jurado_publicaciones for select to authenticated using (mi_rol() is not null);

alter table jurado_devoluciones enable row level security;
create policy "admin todo" on jurado_devoluciones for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "alumno ve la de su equipo, publicada" on jurado_devoluciones for select to authenticated
  using (mi_rol() = 'alumno' and jurado_evento_publicado(evento_id)
    and proyecto_id in (
      select pi.proyecto_id from proyecto_integrantes pi join personas pe on pe.id = pi.persona_id
      where lower(pe.email) = lower(auth.jwt() ->> 'email')));

alter table jurado_devoluciones_vistos enable row level security;
create policy "admin todo" on jurado_devoluciones_vistos for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

alter table jurado_devoluciones_historial enable row level security;
create policy "admin lee" on jurado_devoluciones_historial for select to authenticated using (mi_rol() = 'admin');
-- Lo escribe el trigger al corregir una devolución publicada (no hay pantalla para escribirlo a mano).
create policy "admin corrige" on jurado_devoluciones_historial for insert to authenticated with check (mi_rol() = 'admin');

alter table jurado_devolucion_envios enable row level security;
create policy "admin todo" on jurado_devolucion_envios for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Lo publicado no se despublica ni se arma de nuevo: después de publicar solo se corrigen textos.
create policy "no se despublica" on jurado_publicaciones as restrictive for update to authenticated using (false);
create policy "no se despublica (baja)" on jurado_publicaciones as restrictive for delete to authenticated using (false);
create policy "sin altas ni bajas tras publicar (alta)" on jurado_devoluciones as restrictive for insert to authenticated
  with check (not jurado_evento_publicado(evento_id)
    and not exists (select 1 from jurado_ausencias a where a.evento_id = jurado_devoluciones.evento_id and a.proyecto_id = jurado_devoluciones.proyecto_id));
create policy "sin altas ni bajas tras publicar (baja)" on jurado_devoluciones as restrictive for delete to authenticated
  using (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (alta)" on jurado_ausencias as restrictive for insert to authenticated
  with check (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (cambio)" on jurado_ausencias as restrictive for update to authenticated
  using (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (baja)" on jurado_ausencias as restrictive for delete to authenticated
  using (not jurado_evento_publicado(evento_id));

-- Al publicar se cierran las notas del evento (los jurados las podían cambiar hasta ese momento).
create policy "cerrado tras publicar (alta)" on jurado_evaluaciones as restrictive for insert to authenticated
  with check (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (cambio)" on jurado_evaluaciones as restrictive for update to authenticated
  using (not jurado_evento_publicado(evento_id)) with check (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (baja)" on jurado_evaluaciones as restrictive for delete to authenticated
  using (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (alta)" on jurado_puntajes as restrictive for insert to authenticated
  with check (evaluacion_id in (select id from jurado_evaluaciones where not jurado_evento_publicado(evento_id)));
create policy "cerrado tras publicar (cambio)" on jurado_puntajes as restrictive for update to authenticated
  using (evaluacion_id in (select id from jurado_evaluaciones where not jurado_evento_publicado(evento_id)))
  with check (evaluacion_id in (select id from jurado_evaluaciones where not jurado_evento_publicado(evento_id)));
create policy "cerrado tras publicar (baja)" on jurado_puntajes as restrictive for delete to authenticated
  using (evaluacion_id in (select id from jurado_evaluaciones where not jurado_evento_publicado(evento_id)));

-- Y también los salones y las asignaciones de ese evento.
create policy "cerrado tras publicar (alta)" on jurado_salones as restrictive for insert to authenticated
  with check (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (cambio)" on jurado_salones as restrictive for update to authenticated
  using (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (baja)" on jurado_salones as restrictive for delete to authenticated
  using (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (alta)" on jurado_salon_proyectos as restrictive for insert to authenticated
  with check (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (baja)" on jurado_salon_proyectos as restrictive for delete to authenticated
  using (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (cambio)" on jurado_salon_proyectos as restrictive for update to authenticated
  using (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (alta)" on jurado_salon_jurados as restrictive for insert to authenticated
  with check (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (baja)" on jurado_salon_jurados as restrictive for delete to authenticated
  using (not jurado_evento_publicado(evento_id));
create policy "cerrado tras publicar (cambio)" on jurado_salon_jurados as restrictive for update to authenticated
  using (not jurado_evento_publicado(evento_id));
