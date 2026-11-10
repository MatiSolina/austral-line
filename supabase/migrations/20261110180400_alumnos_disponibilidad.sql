-- GRUPO ALUMNOS: disponibilidad semanal para reunirse (Agente de Organización de Agenda, primera parte).
-- Cada alumno marca en qué franjas de la semana puede reunirse. El grupo ve quién puede en cada franja y
-- dónde coinciden; su mentor asignado y los profesores ven lo mismo para proponer reuniones. Cruzarlo con la
-- disponibilidad del mentor queda para cuando el grupo Mentores la tenga cargada.
-- Días: 1 lunes … 6 sábado. Franjas: 1 de 8 a 12, 2 de 12 a 16, 3 de 16 a 20, 4 de 20 a 23.

create table alumnos_disponibilidad (
  persona_id uuid not null references personas(id) on delete cascade,
  dia smallint not null check (dia between 1 and 6),
  franja smallint not null check (franja between 1 and 4),
  primary key (persona_id, dia, franja)
);

alter table alumnos_disponibilidad enable row level security;
create policy "admin todo" on alumnos_disponibilidad for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "alumno maneja la suya" on alumnos_disponibilidad for all to authenticated
  using (mi_rol() = 'alumno' and persona_id = mi_persona_id())
  with check (mi_rol() = 'alumno' and persona_id = mi_persona_id());

-- Disponibilidad de un grupo: cada integrante con las franjas que marcó (una fila por franja; si no marcó
-- ninguna, una fila con día y franja vacíos). Lo piden los integrantes, el mentor asignado y los profesores.
-- Security definer porque cada alumno solo puede leer su propia fila de la tabla.
create function public.alumnos_disponibilidad_grupo(p_proyecto uuid)
returns table (persona_id uuid, nombre text, dia smallint, franja smallint)
language sql stable security definer set search_path = public as $$
  select i.persona_id, pe.nombre, d.dia, d.franja
  from proyecto_integrantes i
  join personas pe on pe.id = i.persona_id
  left join alumnos_disponibilidad d on d.persona_id = i.persona_id
  where i.proyecto_id = p_proyecto
    and (
      mi_rol() = 'admin'
      or (mi_rol() = 'alumno' and alumnos_soy_integrante(p_proyecto::text))
      or alumnos_soy_mentor(p_proyecto::text)
    )
  order by pe.nombre, d.dia, d.franja
$$;
revoke execute on function public.alumnos_disponibilidad_grupo(uuid) from public, anon;
grant execute on function public.alumnos_disponibilidad_grupo(uuid) to authenticated;
