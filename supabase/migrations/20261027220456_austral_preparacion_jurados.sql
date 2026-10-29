-- GRUPO AUSTRAL: preparación de jurados.
-- Los alumnos suben los documentos de su proyecto; un agente de IA arma con ellos una ficha corta y un guion de
-- audio que cuentan SOLO la problemática (nunca la solución). El admin la revisa y la aprueba, y recién ahí la ven
-- los jurados que tienen ese proyecto en su salón.

-- Quién soy (persona logueada), para no repetir la subconsulta en cada policy.
create function austral_yo() returns uuid
language sql stable
set search_path = public
as $$ select id from personas where email = auth.jwt() ->> 'email' $$;

-- Proyectos en los que la persona logueada es integrante.
create function austral_mis_proyectos() returns setof uuid
language sql stable
set search_path = public
as $$ select proyecto_id from proyecto_integrantes where persona_id = austral_yo() $$;

-- ¿El proyecto se presenta en algún salón donde escucha la persona logueada?
create function austral_me_toca(p_proyecto uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1
    from jurado_salon_proyectos sp
    join jurado_salon_jurados sj on sj.evento_id = sp.evento_id and sj.salon_id = sp.salon_id
    where sp.proyecto_id = p_proyecto and sj.jurado_id = austral_yo()
  )
$$;

-- Documentos que sube cada equipo (el archivo vive en el bucket austral-documentos, en la carpeta <proyecto_id>/).
create table austral_documentos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  nombre text not null check (btrim(nombre) <> ''),
  ruta text not null unique,
  tipo text not null check (tipo in ('application/pdf', 'text/plain', 'text/markdown')),
  bytes int not null check (bytes > 0),
  subido_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now()
);
create index austral_documentos_proyecto on austral_documentos (proyecto_id, created_at desc);

alter table austral_documentos enable row level security;
create policy "admin todo" on austral_documentos for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "alumno ve los de su equipo" on austral_documentos for select to authenticated
  using (mi_rol() = 'alumno' and proyecto_id in (select austral_mis_proyectos()));
create policy "alumno sube a su equipo" on austral_documentos for insert to authenticated
  with check (mi_rol() = 'alumno' and proyecto_id in (select austral_mis_proyectos()) and subido_por = austral_yo());
create policy "alumno borra los de su equipo" on austral_documentos for delete to authenticated
  using (mi_rol() = 'alumno' and proyecto_id in (select austral_mis_proyectos()));

-- Material de preparación: uno por proyecto (sirve para todos los jurados que lo escuchan).
create table austral_materiales (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null unique references proyectos(id) on delete cascade,
  sector text,
  contexto text,
  problematica text,
  guion text,
  -- borrador: listo para que el admin lo revise · revisar: el agente avisó un problema · aprobado: lo ven los jurados
  estado text not null default 'borrador' check (estado in ('borrador', 'revisar', 'aprobado')),
  aviso text, -- notificación al admin: qué falta o qué no cierra y qué tendría que hacer
  fuentes text[] not null default '{}', -- nombres de los documentos que usó el agente
  documentos uuid[] not null default '{}', -- ids de esos documentos, para saber si después subieron otros
  segundos_generacion numeric,
  generado_por uuid references personas(id) on delete set null,
  generado_at timestamptz,
  aprobado_por uuid references personas(id) on delete set null,
  aprobado_at timestamptz,
  updated_at timestamptz not null default now(),
  check (estado <> 'aprobado' or (contexto is not null and problematica is not null and guion is not null))
);

alter table austral_materiales enable row level security;
create policy "admin todo" on austral_materiales for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "jurado ve los aprobados de su salon" on austral_materiales for select to authenticated
  using (mi_rol() = 'jurado' and estado = 'aprobado' and austral_me_toca(proyecto_id));

-- Uso del material por los jurados (para las métricas: quién lo leyó y quién escuchó el audio).
create table austral_material_usos (
  id bigint generated always as identity primary key,
  material_id uuid not null references austral_materiales(id) on delete cascade,
  jurado_id uuid not null references personas(id) on delete cascade,
  tipo text not null check (tipo in ('lectura', 'audio')),
  created_at timestamptz not null default now()
);
create index austral_material_usos_material on austral_material_usos (material_id);

alter table austral_material_usos enable row level security;
create policy "admin todo" on austral_material_usos for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
-- La subconsulta pasa por la policy de austral_materiales: solo registra uso de lo que el jurado puede ver.
create policy "jurado registra su uso" on austral_material_usos for insert to authenticated
  with check (mi_rol() = 'jurado' and jurado_id = austral_yo() and material_id in (select id from austral_materiales));

-- Bucket privado para los archivos. Hasta 10 MB, solo PDF y texto (lo que el agente puede leer).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('austral-documentos', 'austral-documentos', false, 10485760, array['application/pdf', 'text/plain', 'text/markdown'])
on conflict (id) do nothing;

create policy "austral admin documentos" on storage.objects for all to authenticated
  using (bucket_id = 'austral-documentos' and mi_rol() = 'admin')
  with check (bucket_id = 'austral-documentos' and mi_rol() = 'admin');
create policy "austral alumno lee documentos" on storage.objects for select to authenticated
  using (bucket_id = 'austral-documentos' and mi_rol() = 'alumno'
    and (storage.foldername(name))[1] in (select p::text from austral_mis_proyectos() p));
create policy "austral alumno sube documentos" on storage.objects for insert to authenticated
  with check (bucket_id = 'austral-documentos' and mi_rol() = 'alumno'
    and (storage.foldername(name))[1] in (select p::text from austral_mis_proyectos() p));
create policy "austral alumno borra documentos" on storage.objects for delete to authenticated
  using (bucket_id = 'austral-documentos' and mi_rol() = 'alumno'
    and (storage.foldername(name))[1] in (select p::text from austral_mis_proyectos() p));
