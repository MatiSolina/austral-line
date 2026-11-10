-- GRUPO ALUMNOS: checklist oficial de cada entrega (Validador de formato, primera parte).
-- Los profesores cargan en cada hito los requisitos formales de la entrega (formato, secciones, extensión…),
-- obligatorios u opcionales. Los alumnos los ven y los marcan antes de subir: la del grupo es una sola lista
-- compartida (marca cualquier integrante y queda quién marcó); en la individual, cada alumno marca la suya.
-- No bloquea la subida: si faltan obligatorios se avisa, y profesores y mentor ven qué marcó cada grupo.

create table alumnos_checklist_items (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 3 and 300),
  obligatorio boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
create index alumnos_checklist_items_evento on alumnos_checklist_items (evento_id, orden, created_at);

alter table alumnos_checklist_items enable row level security;
create policy "leer con rol" on alumnos_checklist_items for select to authenticated using (mi_rol() is not null);
create policy "admin escribe" on alumnos_checklist_items for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Marcas: de un grupo (proyecto_id) o de un alumno en su entrega individual (persona_id), nunca de los dos.
-- Desmarcar = borrar la marca.
create table alumnos_checklist_marcas (
  item_id uuid not null references alumnos_checklist_items(id) on delete cascade,
  proyecto_id uuid references proyectos(id) on delete cascade,
  persona_id uuid references personas(id) on delete cascade,
  marcado_por uuid references personas(id) on delete set null,
  marcado_at timestamptz not null default now(),
  check ((proyecto_id is null) <> (persona_id is null))
);
create unique index alumnos_checklist_marcas_unica on alumnos_checklist_marcas (item_id, proyecto_id, persona_id) nulls not distinct;

alter table alumnos_checklist_marcas enable row level security;
create policy "admin todo" on alumnos_checklist_marcas for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "grupo, dueño y mentor leen" on alumnos_checklist_marcas for select to authenticated
  using (
    (mi_rol() = 'alumno' and proyecto_id is not null and alumnos_soy_integrante(proyecto_id::text))
    or (mi_rol() = 'alumno' and persona_id = mi_persona_id())
    or (proyecto_id is not null and alumnos_soy_mentor(proyecto_id::text))
  );
create policy "grupo y dueño marcan" on alumnos_checklist_marcas for insert to authenticated
  with check (
    mi_rol() = 'alumno'
    and marcado_por = mi_persona_id()
    and (
      (proyecto_id is not null and alumnos_soy_integrante(proyecto_id::text))
      or (proyecto_id is null and persona_id = mi_persona_id())
    )
  );
create policy "grupo y dueño desmarcan" on alumnos_checklist_marcas for delete to authenticated
  using (
    mi_rol() = 'alumno'
    and (
      (proyecto_id is not null and alumnos_soy_integrante(proyecto_id::text))
      or (proyecto_id is null and persona_id = mi_persona_id())
    )
  );
