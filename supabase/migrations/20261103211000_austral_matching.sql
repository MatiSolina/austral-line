-- GRUPO AUSTRAL: matching de alumnos sin grupo con proyectos que buscan integrantes (solo admin).
-- Reusa (solo lectura) lo que ya carga el grupo Alumnos: carrera, intereses y "sobre mí" de cada alumno, e intereses
-- de cada grupo. Acá se suma lo que el matching necesita y no existía: habilidades con nivel, disponibilidad, año, y
-- las necesidades de cada proyecto. El agente recomienda; el admin decide y recién al confirmar se suma al equipo.

-- Catálogo de habilidades, agrupadas en 4 categorías.
create table austral_habilidades (
  id smallint generated always as identity primary key,
  nombre text not null unique,
  categoria text not null check (categoria in ('diseno', 'tecnologia', 'negocios', 'operaciones')),
  orden smallint not null default 0
);
insert into austral_habilidades (nombre, categoria, orden) values
  ('UX/UI', 'diseno', 1), ('Diseño gráfico', 'diseno', 2), ('Investigación de usuarios', 'diseno', 3),
  ('Prototipado', 'diseno', 4), ('Comunicación visual', 'diseno', 5),
  ('Desarrollo web', 'tecnologia', 1), ('Frontend', 'tecnologia', 2), ('Backend', 'tecnologia', 3),
  ('Bases de datos', 'tecnologia', 4), ('Inteligencia artificial', 'tecnologia', 5), ('Automatización', 'tecnologia', 6),
  ('Análisis de datos', 'tecnologia', 7),
  ('Estrategia', 'negocios', 1), ('Marketing', 'negocios', 2), ('Finanzas', 'negocios', 3),
  ('Investigación de mercado', 'negocios', 4), ('Desarrollo de negocios', 'negocios', 5), ('Análisis comercial', 'negocios', 6),
  ('Gestión de proyectos', 'operaciones', 1), ('Organización', 'operaciones', 2), ('Planificación', 'operaciones', 3),
  ('Logística', 'operaciones', 4), ('Procesos', 'operaciones', 5), ('Metodologías ágiles', 'operaciones', 6);

alter table austral_habilidades enable row level security;
create policy "leer con rol" on austral_habilidades for select to authenticated using (mi_rol() is not null);
create policy "admin escribe" on austral_habilidades for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Datos de matching de cada alumno (lo que no está en el perfil del grupo Alumnos).
create table austral_perfiles_matching (
  persona_id uuid primary key references personas(id) on delete cascade,
  anio smallint check (anio between 1 and 6),
  area text, -- área de conocimiento o especialización
  experiencia text, -- experiencia previa en proyectos
  disponibilidad text[] not null default '{}' check (disponibilidad <@ array['manana', 'tarde', 'noche', 'fin_de_semana']),
  modalidad text check (modalidad in ('presencial', 'remota', 'mixta')),
  preferencias text, -- en qué proyectos o temas le gustaría participar
  updated_at timestamptz not null default now()
);

create table austral_perfil_habilidades (
  persona_id uuid not null references personas(id) on delete cascade,
  habilidad_id smallint not null references austral_habilidades(id) on delete cascade,
  nivel smallint not null check (nivel between 1 and 3), -- 1 básico · 2 intermedio · 3 avanzado
  primary key (persona_id, habilidad_id)
);

-- Necesidades de cada proyecto.
create table austral_proyecto_necesidades (
  proyecto_id uuid primary key references proyectos(id) on delete cascade,
  integrantes_necesarios smallint not null default 4 check (integrantes_necesarios between 1 and 12), -- tamaño total buscado
  objetivo text,
  problematica text,
  disponibilidad text[] not null default '{}' check (disponibilidad <@ array['manana', 'tarde', 'noche', 'fin_de_semana']),
  modalidad text check (modalidad in ('presencial', 'remota', 'mixta')),
  estado text not null default 'buscando' check (estado in ('activo', 'buscando', 'completo')),
  updated_at timestamptz not null default now()
);

create table austral_proyecto_habilidades (
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  habilidad_id smallint not null references austral_habilidades(id) on delete cascade,
  primary key (proyecto_id, habilidad_id)
);

-- Ponderación del motor (una sola fila). Los pesos suman 100.
create table austral_matching_config (
  id boolean primary key default true check (id),
  peso_habilidades smallint not null default 30,
  peso_complementariedad smallint not null default 25,
  peso_intereses smallint not null default 15,
  peso_formacion smallint not null default 10,
  peso_disponibilidad smallint not null default 10,
  peso_equilibrio smallint not null default 10,
  puntaje_minimo smallint not null default 55 check (puntaje_minimo between 0 and 100), -- debajo de esto no se recomienda
  updated_at timestamptz not null default now(),
  check (peso_habilidades + peso_complementariedad + peso_intereses + peso_formacion + peso_disponibilidad + peso_equilibrio = 100),
  check (least(peso_habilidades, peso_complementariedad, peso_intereses, peso_formacion, peso_disponibilidad, peso_equilibrio) >= 0)
);
insert into austral_matching_config default values;

-- Decisiones del admin sobre cada combinación alumno-proyecto. Guarda el puntaje y la justificación del momento.
-- aceptada = propuesta de asignación pendiente de confirmar · confirmada = ya se sumó al equipo.
create table austral_recomendaciones (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada', 'confirmada')),
  puntaje smallint check (puntaje between 0 and 100),
  justificacion text,
  justificacion_ia text,
  observaciones text,
  decidido_por uuid references personas(id) on delete set null,
  decidido_at timestamptz,
  confirmado_at timestamptz,
  created_at timestamptz not null default now(),
  unique (persona_id, proyecto_id)
);
-- Un alumno no puede tener dos asignaciones en curso a la vez.
create unique index austral_recomendaciones_una_por_alumno on austral_recomendaciones (persona_id)
  where estado in ('aceptada', 'confirmada');

do $$
declare t text;
begin
  foreach t in array array['austral_perfiles_matching', 'austral_perfil_habilidades', 'austral_proyecto_necesidades',
    'austral_proyecto_habilidades', 'austral_matching_config', 'austral_recomendaciones']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admin todo" on %I for all to authenticated using (mi_rol() = ''admin'') with check (mi_rol() = ''admin'')', t);
  end loop;
end $$;
