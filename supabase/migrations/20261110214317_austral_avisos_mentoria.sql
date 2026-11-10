-- GRUPO AUSTRAL — registro de los avisos por mail de la mentoría titular:
--   tipo 'mentor': al mentor, cuando se lo designa titular de un proyecto (Compatibilidad).
--   tipo 'equipo': a cada integrante, avisándole qué mentor titular le tocó (cuando todos los grupos tienen uno).
-- Sirve para mostrar qué se mandó y para no repetir el aviso al mismo integrante por el mismo mentor.
create table austral_avisos_mentoria (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('mentor', 'equipo')),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  mentor_id uuid not null references personas(id) on delete cascade,
  destinatario_id uuid not null references personas(id) on delete cascade,
  estado text not null check (estado in ('enviado', 'simulado', 'error', 'sin_email')),
  detalle text,
  enviado_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now()
);
create index austral_avisos_mentoria_proyecto on austral_avisos_mentoria (proyecto_id, tipo, created_at desc);

alter table austral_avisos_mentoria enable row level security;
create policy "admin todo" on austral_avisos_mentoria for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
