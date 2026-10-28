-- GRUPO ALUMNOS: página de cada idea del banco (vista de exploración pedida por la cátedra).
-- Contexto ampliado que completa el autor, y un hilo de preguntas y respuestas abierto a todos,
-- para que un alumno conozca a fondo la problemática antes de comprometerse.

-- Contexto ampliado (opcional, lo edita el autor o los profesores) ---------------------
alter table alumnos_ideas
  add column a_quien_le_pasa text check (char_length(a_quien_le_pasa) <= 1000),
  add column que_se_intento text check (char_length(que_se_intento) <= 1000),
  add column como_seria_resuelto text check (char_length(como_seria_resuelto) <= 1000);

-- Preguntas y respuestas -------------------------------------------------------------------
-- Una pregunta tiene respuesta_a = null; una respuesta apunta a su pregunta.
create table alumnos_ideas_mensajes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references alumnos_ideas(id) on delete cascade,
  autor_id uuid references personas(id) on delete set null,
  respuesta_a uuid references alumnos_ideas_mensajes(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 2 and 1000),
  created_at timestamptz not null default now()
);

create index alumnos_ideas_mensajes_idea on alumnos_ideas_mensajes (idea_id, created_at);

alter table alumnos_ideas_mensajes enable row level security;

create policy "admin todo" on alumnos_ideas_mensajes for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Los alumnos leen todas las preguntas y respuestas.
create policy "alumno lee" on alumnos_ideas_mensajes for select to authenticated
  using (mi_rol() = 'alumno');

-- Cualquier alumno pregunta o responde, siempre a su nombre.
create policy "alumno escribe a su nombre" on alumnos_ideas_mensajes for insert to authenticated
  with check (mi_rol() = 'alumno' and autor_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
