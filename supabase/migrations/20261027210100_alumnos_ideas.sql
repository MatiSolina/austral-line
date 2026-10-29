-- GRUPO ALUMNOS: banco de problemas e ideas (ampliación del Agente de Armado de Grupos).
-- Alumnos y profesores cargan problemáticas o ideas de proyecto. Un alumno sin idea propia
-- marca "Me interesa" y ve quiénes más se interesaron, para armar equipo alrededor de la idea.
-- El sistema no asigna ideas: la decisión de tomar una es del alumno o del grupo.

-- Ideas ------------------------------------------------------------------------------
create table alumnos_ideas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid references personas(id) on delete set null,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  descripcion text not null check (char_length(btrim(descripcion)) between 10 and 1500),
  interes_id smallint references alumnos_intereses_maestro(id) on delete set null,
  estado text not null default 'disponible' check (estado in ('disponible', 'tomada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table alumnos_ideas enable row level security;

create policy "admin todo" on alumnos_ideas for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Todos los alumnos ven el banco completo.
create policy "alumno ve el banco" on alumnos_ideas for select to authenticated
  using (mi_rol() = 'alumno');

-- El alumno carga ideas a su nombre, siempre como disponibles.
create policy "alumno carga a su nombre" on alumnos_ideas for insert to authenticated
  with check (
    mi_rol() = 'alumno'
    and estado = 'disponible'
    and autor_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))
  );

-- Solo el autor modifica su idea (por ejemplo, marcarla como tomada). Nadie toca ideas ajenas.
create policy "autor edita la suya" on alumnos_ideas for update to authenticated
  using (mi_rol() = 'alumno' and autor_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')))
  with check (mi_rol() = 'alumno' and autor_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));

-- Interesados ----------------------------------------------------------------------------
create table alumnos_ideas_interesados (
  idea_id uuid not null references alumnos_ideas(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, persona_id)
);

alter table alumnos_ideas_interesados enable row level security;

create policy "admin todo" on alumnos_ideas_interesados for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Los alumnos ven quiénes se interesaron en cada idea (para armar equipo).
create policy "alumno ve interesados" on alumnos_ideas_interesados for select to authenticated
  using (mi_rol() = 'alumno');

-- Cada alumno marca o desmarca solo su propio interés.
create policy "alumno marca lo suyo" on alumnos_ideas_interesados for insert to authenticated
  with check (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
create policy "alumno desmarca lo suyo" on alumnos_ideas_interesados for delete to authenticated
  using (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
