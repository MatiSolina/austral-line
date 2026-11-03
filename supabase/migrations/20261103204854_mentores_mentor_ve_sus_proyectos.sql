-- GRUPO MENTORES: cada mentor ve los proyectos que le asignó el coordinador en el Match.
-- Hasta ahora mentores_sugerencias la veía solo el admin, así que el mentor no sabía qué proyectos tenía
-- y en Reuniones podía elegir cualquiera. Solo lectura y solo sus matches aceptados: las sugerencias
-- pendientes, rechazadas o quitadas siguen siendo cosa del coordinador.
create policy "mentor ve sus asignados" on mentores_sugerencias for select to authenticated
  using (mi_rol() = 'mentor' and mentor_id = mi_persona_id() and estado = 'aceptada');
