-- GRUPO AUSTRAL: satisfacción con cada asignación confirmada por el matching (para las métricas de seguimiento).
-- La registra el admin después de hablar con el alumno y con el equipo (1 a 5 cada uno).
create table austral_matching_satisfaccion (
  recomendacion_id uuid primary key references austral_recomendaciones(id) on delete cascade,
  alumno smallint check (alumno between 1 and 5),
  equipo smallint check (equipo between 1 and 5),
  comentario text,
  registrado_por uuid references personas(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (alumno is not null or equipo is not null)
);

alter table austral_matching_satisfaccion enable row level security;
create policy "admin todo" on austral_matching_satisfaccion for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
