-- GRUPO AUSTRAL: carga masiva de la materia (mentores, jurados, alumnos y proyectos del año).
-- Las personas y proyectos se cargan en las tablas del core (el admin ya puede escribirlas); acá van los datos que el
-- core no tiene: teléfono y especialidad. Son datos internos del admin: no se muestran a nadie más. El directorio que
-- ven los alumnos sigue siendo el que cada mentor autoriza en "Contactos de mentores".
create table austral_datos_contacto (
  persona_id uuid primary key references personas(id) on delete cascade,
  telefono text check (char_length(telefono) <= 40),
  especialidad text check (char_length(especialidad) <= 200),
  cargado_por uuid references personas(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table austral_datos_contacto enable row level security;
create policy "admin todo" on austral_datos_contacto for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
