-- GRUPO ALUMNOS: repositorio del grupo (Agente de Documentación).
-- Cada grupo sube sus entregas por hito del cuatrimestre (tabla eventos del core), como archivos con
-- versiones: nunca se pisa una versión, se sube una nueva. Profesores y mentores dejan devoluciones
-- sobre cada versión. Lo ven el grupo, sus mentores y los profesores; los otros grupos no.
-- Mentor de un grupo = quien tiene o tuvo una reunión con ese proyecto (tabla mentores_reuniones,
-- del grupo Mentores: solo se lee, no se modifica).

-- ¿La persona logueada es integrante del proyecto? ¿Es su mentor? -------------------------------
create function public.alumnos_yo() returns uuid
language sql stable security invoker set search_path = public as $$
  select id from personas where lower(email) = lower(auth.jwt() ->> 'email')
$$;

-- Reciben el id como texto: así también sirven para la carpeta de un archivo, sin romper si no es un id.
create function public.alumnos_soy_integrante(p_proyecto text) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from proyecto_integrantes where proyecto_id::text = p_proyecto and persona_id = alumnos_yo())
$$;

create function public.alumnos_soy_mentor(p_proyecto text) returns boolean
language sql stable security invoker set search_path = public as $$
  select mi_rol() = 'mentor'
    and exists (select 1 from mentores_reuniones where proyecto_id::text = p_proyecto and mentor_id = alumnos_yo())
$$;

revoke execute on function public.alumnos_yo(), public.alumnos_soy_integrante(text), public.alumnos_soy_mentor(text)
  from public, anon;
grant execute on function public.alumnos_yo(), public.alumnos_soy_integrante(text), public.alumnos_soy_mentor(text)
  to authenticated;

-- Entregas (una fila por versión) ---------------------------------------------------------------
-- Una entrega es del grupo (proyecto_id) o de un alumno (persona_id), nunca de los dos. En esta etapa
-- solo se usan las del grupo; las individuales se suman aparte con sus propios permisos.
create table alumnos_entregas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references proyectos(id) on delete cascade,
  persona_id uuid references personas(id) on delete cascade,
  evento_id uuid not null references eventos(id) on delete cascade,
  version integer not null check (version >= 1),
  archivo_path text not null unique,
  nombre_archivo text not null check (char_length(nombre_archivo) between 1 and 200),
  tamano_bytes bigint not null check (tamano_bytes > 0),
  nota text check (char_length(nota) <= 500),
  subida_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((proyecto_id is null) <> (persona_id is null))
);

-- Las versiones se numeran por separado para cada grupo (o alumno) y cada hito.
create unique index alumnos_entregas_version_unica
  on alumnos_entregas (proyecto_id, persona_id, evento_id, version) nulls not distinct;

alter table alumnos_entregas enable row level security;

create policy "admin todo" on alumnos_entregas for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "grupo ve lo suyo" on alumnos_entregas for select to authenticated
  using (mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text));
create policy "mentor ve sus grupos" on alumnos_entregas for select to authenticated
  using (alumnos_soy_mentor(proyecto_id::text));
-- Cualquier integrante sube una versión nueva, a su nombre. No se editan ni borran (queda el historial).
create policy "grupo sube a su nombre" on alumnos_entregas for insert to authenticated
  with check (mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text) and subida_por = alumnos_yo());

-- Devoluciones sobre una versión, y la conversación debajo de cada una -----------------------------
-- Una devolución tiene respuesta_a = null; una respuesta apunta a esa devolución (un solo nivel).
-- Contestan el grupo y quien dejó la devolución (y los profesores, que ven todo).
create table alumnos_entregas_devoluciones (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references alumnos_entregas(id) on delete cascade,
  respuesta_a uuid references alumnos_entregas_devoluciones(id) on delete cascade,
  autor_id uuid references personas(id) on delete set null,
  texto text not null check (char_length(btrim(texto)) between 2 and 2000),
  created_at timestamptz not null default now()
);

create index alumnos_entregas_devoluciones_entrega on alumnos_entregas_devoluciones (entrega_id, created_at);

alter table alumnos_entregas_devoluciones enable row level security;

create policy "admin todo" on alumnos_entregas_devoluciones for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "grupo lee las suyas" on alumnos_entregas_devoluciones for select to authenticated
  using (mi_rol() = 'alumno' and exists (
    select 1 from alumnos_entregas e where e.id = entrega_id and alumnos_soy_integrante(e.proyecto_id::text)));
create policy "mentor lee en sus grupos" on alumnos_entregas_devoluciones for select to authenticated
  using (exists (select 1 from alumnos_entregas e where e.id = entrega_id and alumnos_soy_mentor(e.proyecto_id::text)));
create policy "mentor escribe a su nombre en sus grupos" on alumnos_entregas_devoluciones for insert to authenticated
  with check (
    autor_id = alumnos_yo()
    and exists (select 1 from alumnos_entregas e where e.id = entrega_id and alumnos_soy_mentor(e.proyecto_id::text))
  );
-- El grupo no deja devoluciones: solo contesta las que recibió, a su nombre.
create policy "grupo contesta a su nombre" on alumnos_entregas_devoluciones for insert to authenticated
  with check (
    mi_rol() = 'alumno'
    and respuesta_a is not null
    and autor_id = alumnos_yo()
    and exists (select 1 from alumnos_entregas e where e.id = entrega_id and alumnos_soy_integrante(e.proyecto_id::text))
  );

-- Una respuesta tiene que ir a una devolución (no a otra respuesta) de la misma versión, y un mentor
-- solo contesta en las conversaciones de las devoluciones que dejó él.
create function public.alumnos_validar_respuesta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  raiz alumnos_entregas_devoluciones%rowtype;
begin
  if new.respuesta_a is null then
    return new;
  end if;
  select * into raiz from alumnos_entregas_devoluciones where id = new.respuesta_a;
  if raiz.id is null or raiz.respuesta_a is not null or raiz.entrega_id <> new.entrega_id then
    raise exception 'La respuesta tiene que ir a una devolución de esta misma versión.';
  end if;
  if mi_rol() = 'mentor' and raiz.autor_id is distinct from new.autor_id then
    raise exception 'Solo quien dejó la devolución (o el grupo) puede contestarla.';
  end if;
  return new;
end;
$$;

create trigger alumnos_validar_respuesta before insert or update on alumnos_entregas_devoluciones
  for each row execute function public.alumnos_validar_respuesta();

-- Archivos: bucket privado propio del grupo Alumnos ---------------------------------------------
-- Ruta de cada archivo: <proyecto_id>/<evento_id>/v<version>-<nombre>. Las políticas son solo para este bucket.
insert into storage.buckets (id, name, public, file_size_limit)
values ('alumnos-entregas', 'alumnos-entregas', false, 52428800) -- 50 MB por archivo
on conflict (id) do nothing;

create policy "alumnos-entregas: admin todo" on storage.objects for all to authenticated
  using (bucket_id = 'alumnos-entregas' and mi_rol() = 'admin')
  with check (bucket_id = 'alumnos-entregas' and mi_rol() = 'admin');
create policy "alumnos-entregas: grupo y mentores leen" on storage.objects for select to authenticated
  using (
    bucket_id = 'alumnos-entregas'
    and (
      (mi_rol() = 'alumno' and alumnos_soy_integrante((storage.foldername(name))[1]))
      or alumnos_soy_mentor((storage.foldername(name))[1])
    )
  );
create policy "alumnos-entregas: grupo sube" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'alumnos-entregas'
    and mi_rol() = 'alumno'
    and alumnos_soy_integrante((storage.foldername(name))[1])
  );
