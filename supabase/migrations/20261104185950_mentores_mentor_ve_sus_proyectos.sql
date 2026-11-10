-- GRUPO MENTORES: cada mentor ve los proyectos que le asignó el coordinador en el Match.
-- Hasta ahora mentores_sugerencias la veía solo el admin, así que el mentor no sabía qué proyectos tenía
-- y en Reuniones podía elegir cualquiera. La tabla sigue siendo solo del admin (tiene la opinión y las
-- estrellas que el coordinador le pone a cada mentor): el mentor solo recibe los ids de sus proyectos aceptados.
create function public.mentores_mis_proyectos() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select proyecto_id from public.mentores_sugerencias
  where mentor_id = public.mi_persona_id() and estado = 'aceptada'
$$;
revoke execute on function public.mentores_mis_proyectos() from public, anon;
grant execute on function public.mentores_mis_proyectos() to authenticated;

-- La regla "solo con tus proyectos" también la frena la base, no solo la pantalla: un mentor no puede
-- cargar una reunión con un equipo que no tiene asignado ni pasarle una reunión suya a otro proyecto.
-- Si no, ese equipo recibiría por mail encuestas de feedback sobre una reunión que no existió.
-- Es restrictiva: se suma a "mentor lo suyo" sin reemplazarla.
create policy "mentor agenda solo con sus asignados" on mentores_reuniones as restrictive for insert to authenticated
  with check (mi_rol() is distinct from 'mentor' or proyecto_id in (select public.mentores_mis_proyectos()));

-- Al editar, solo se controla cuando cambia el proyecto: las reuniones viejas (o de un proyecto que le
-- sacaron) se pueden seguir anotando, cancelando y marcando como "feedback pedido".
create function public.mentores_reunion_no_cambia_proyecto() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.mi_rol() = 'mentor' and new.proyecto_id not in (select public.mentores_mis_proyectos()) then
    raise exception 'Solo podés pasar la reunión a un proyecto que te asignaron';
  end if;
  return new;
end $$;
create trigger mentores_reunion_no_cambia_proyecto before update of proyecto_id on public.mentores_reuniones
  for each row when (new.proyecto_id is distinct from old.proyecto_id)
  execute function public.mentores_reunion_no_cambia_proyecto();
