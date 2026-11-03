-- GRUPO JURADO: resumen del pitch para jurados (agente de IA Lab).
-- Por cada equipo de un evento, el admin sube la presentación final (PDF) y la transcripción de la sesión grabada
-- del pitch. Un agente arma con eso un resumen para leer o escuchar (menos de 15 minutos por salón, sin evaluar ni
-- puntuar). El admin lo revisa y lo aprueba, y recién ahí lo ven los jurados del salón de ese equipo.
-- Distinto de la "Preparación" del grupo Austral: aquella cuenta solo el problema; esta resume el pitch completo.

-- Material que sube el admin: uno de cada tipo por equipo y evento (subir otro reemplaza al anterior).
-- El archivo vive en el bucket jurado-resumenes, en la carpeta <evento_id>/<proyecto_id>/.
create table jurado_resumen_archivos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  tipo text not null check (tipo in ('presentacion', 'transcripcion')),
  nombre text not null check (btrim(nombre) <> ''),
  ruta text not null unique,
  mime text not null check (mime in ('application/pdf', 'text/plain', 'text/vtt')),
  bytes int not null check (bytes > 0),
  subido_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (evento_id, proyecto_id, tipo)
);

alter table jurado_resumen_archivos enable row level security;
create policy "admin todo" on jurado_resumen_archivos for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Resumen de cada equipo en cada evento (sirve para todos los jurados de su salón).
create table jurado_resumenes (
  evento_id uuid not null references eventos(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  texto text, -- versión para leer y escuchar
  palabras int not null default 0,
  -- borrador: listo para que el admin lo revise · revisar: el agente frenó o avisó un problema · aprobado: lo ven los jurados
  estado text not null default 'borrador' check (estado in ('borrador', 'revisar', 'aprobado')),
  aviso text, -- reporte para el responsable: qué falló, qué archivos llegaron y qué hacer
  archivos uuid[] not null default '{}', -- archivos que usó el agente, para saber si después subieron otros
  generado_por uuid references personas(id) on delete set null,
  generado_at timestamptz,
  aprobado_por uuid references personas(id) on delete set null,
  aprobado_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (evento_id, proyecto_id),
  check (estado <> 'aprobado' or texto is not null)
);

alter table jurado_resumenes enable row level security;
create policy "admin todo" on jurado_resumenes for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "jurado ve los aprobados de su salon" on jurado_resumenes for select to authenticated
  using (mi_rol() = 'jurado' and estado = 'aprobado' and jurado_me_toca(evento_id, proyecto_id));

-- Bucket privado. Hasta 10 MB: PDF para la presentación y texto (.txt, .vtt, .srt) para la transcripción.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jurado-resumenes', 'jurado-resumenes', false, 10485760, array['application/pdf', 'text/plain', 'text/vtt'])
on conflict (id) do nothing;

create policy "jurado resumenes solo admin" on storage.objects for all to authenticated
  using (bucket_id = 'jurado-resumenes' and mi_rol() = 'admin')
  with check (bucket_id = 'jurado-resumenes' and mi_rol() = 'admin');
