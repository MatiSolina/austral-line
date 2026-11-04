-- GRUPO MENTORES: cada mentor ve los proyectos que le asignó el coordinador en el Match.
-- Hasta ahora mentores_sugerencias la veía solo el admin, así que el mentor no sabía qué proyectos tenía
-- y en Reuniones podía elegir cualquiera. Solo lectura y solo sus matches aceptados: las sugerencias
-- pendientes, rechazadas o quitadas siguen siendo cosa del coordinador.
create policy "mentor ve sus asignados" on mentores_sugerencias for select to authenticated
  using (mi_rol() = 'mentor' and mentor_id = mi_persona_id() and estado = 'aceptada');

-- La regla "solo con tus proyectos" también la frena la base, no solo la pantalla: un mentor no puede
-- cargar una reunión con un equipo que no tiene asignado ni pasarle una reunión suya a otro proyecto.
-- Si no, ese equipo recibiría por mail encuestas de feedback sobre una reunión que no existió.
-- Son restrictivas: se suman a "mentor lo suyo" sin reemplazarla. La subconsulta anda gracias a
-- "mentor ve sus asignados".
create policy "mentor agenda solo con sus asignados" on mentores_reuniones as restrictive for insert to authenticated
  with check (mi_rol() is distinct from 'mentor' or exists (
    select 1 from mentores_sugerencias s
    where s.proyecto_id = mentores_reuniones.proyecto_id and s.mentor_id = mi_persona_id() and s.estado = 'aceptada'));
create policy "mentor cambia solo a sus asignados" on mentores_reuniones as restrictive for update to authenticated
  using (true)
  with check (mi_rol() is distinct from 'mentor' or exists (
    select 1 from mentores_sugerencias s
    where s.proyecto_id = mentores_reuniones.proyecto_id and s.mentor_id = mi_persona_id() and s.estado = 'aceptada'));
