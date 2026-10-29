-- GRUPO ALUMNOS: borrar ideas propias y reportar contenido inapropiado del banco de ideas.
-- - El autor edita su idea (ya podía) y la borra solo si nadie marcó "Me interesa".
-- - Los profesores (admin) editan y borran cualquier idea o mensaje (ya podían, "admin todo"):
--   así moderan lo reportado aunque tenga interesados.
-- - Un alumno reporta una idea o un mensaje con un motivo. Sigue visible: los profesores lo ven
--   en su panel y deciden si lo borran o lo dejan.

-- Borrar la idea propia ------------------------------------------------------------------
create policy "autor borra la suya sin interesados" on alumnos_ideas for delete to authenticated
  using (
    mi_rol() = 'alumno'
    and autor_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))
    and not exists (select 1 from alumnos_ideas_interesados i where i.idea_id = alumnos_ideas.id)
  );

-- Reportes -----------------------------------------------------------------------------------
-- Siempre apunta a una idea; si mensaje_id tiene valor, lo reportado es ese mensaje de la idea.
create table alumnos_ideas_reportes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references alumnos_ideas(id) on delete cascade,
  mensaje_id uuid references alumnos_ideas_mensajes(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  motivo text not null check (char_length(btrim(motivo)) between 3 and 500),
  resuelto boolean not null default false,
  created_at timestamptz not null default now()
);

-- Cada alumno reporta lo mismo una sola vez.
create unique index alumnos_ideas_reportes_unico
  on alumnos_ideas_reportes (persona_id, idea_id, mensaje_id) nulls not distinct;

create index alumnos_ideas_reportes_pendientes on alumnos_ideas_reportes (created_at) where not resuelto;

-- El mensaje reportado tiene que ser de esa idea.
create function public.alumnos_validar_reporte() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mensaje_id is not null and not exists (
    select 1 from alumnos_ideas_mensajes m where m.id = new.mensaje_id and m.idea_id = new.idea_id
  ) then
    raise exception 'El mensaje reportado no es de esa idea.';
  end if;
  return new;
end;
$$;

create trigger alumnos_validar_reporte before insert or update on alumnos_ideas_reportes
  for each row execute function public.alumnos_validar_reporte();

alter table alumnos_ideas_reportes enable row level security;

create policy "admin todo" on alumnos_ideas_reportes for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- El alumno reporta a su nombre, siempre como pendiente, y ve solo sus propios reportes
-- (para saber qué ya reportó). Nadie más sabe quién reportó, salvo los profesores.
create policy "alumno reporta a su nombre" on alumnos_ideas_reportes for insert to authenticated
  with check (
    mi_rol() = 'alumno'
    and not resuelto
    and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))
  );
create policy "alumno ve sus reportes" on alumnos_ideas_reportes for select to authenticated
  using (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
