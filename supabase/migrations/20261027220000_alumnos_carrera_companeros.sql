-- GRUPO ALUMNOS: interdisciplinariedad del grupo.
-- Cada alumno puede ver la carrera de los integrantes de su propio proyecto (aunque no busquen equipo),
-- para saber si su grupo es interdisciplinario. No ve la de nadie más.
create policy "alumno ve la carrera de sus compañeros de proyecto" on alumnos_carreras for select to authenticated
  using (
    mi_rol() = 'alumno'
    and exists (
      select 1
      from proyecto_integrantes otro
      join proyecto_integrantes yo on yo.proyecto_id = otro.proyecto_id
      where otro.persona_id = alumnos_carreras.persona_id
        and yo.persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))
    )
  );
