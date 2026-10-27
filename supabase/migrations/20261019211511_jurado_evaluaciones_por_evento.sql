-- GRUPO JURADO: cada evaluación pertenece a un evento, y cada jurado evalúa solo a los equipos de su salón.
-- Solo suma: una columna que puede quedar vacía y políticas "restrictivas" (se agregan a las que ya existen, no las reemplazan).
--
-- Las evaluaciones que ya existían quedan con evento vacío: no se asignan a ningún evento por suposición,
-- no entran en ningún evento ni devolución y quedan congeladas (nadie las puede editar ni borrar).
--
-- Pendiente de autorización del profe: hoy sigue valiendo unique (proyecto_id, jurado_id), así que el mismo jurado
-- no puede evaluar al mismo equipo en dos eventos. La app lo avisa y no pisa la evaluación del otro evento.

-- Si se borra un evento, sus notas no se pierden: quedan sin evento, como las viejas.
alter table jurado_evaluaciones add column evento_id uuid references eventos(id) on delete set null;
create index jurado_evaluaciones_evento on jurado_evaluaciones (evento_id, proyecto_id);

-- ¿El jurado logueado está en el mismo salón que este equipo, en este evento?
create function jurado_me_toca(p_evento uuid, p_proyecto uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (
    select 1
    from jurado_salon_proyectos sp
    join jurado_salon_jurados sj on sj.evento_id = sp.evento_id and sj.salon_id = sp.salon_id
    join personas pe on pe.id = sj.jurado_id
    where sp.evento_id = p_evento and sp.proyecto_id = p_proyecto
      and lower(pe.email) = lower(auth.jwt() ->> 'email')
  )
$$;
revoke execute on function jurado_me_toca(uuid, uuid) from public, anon;
grant execute on function jurado_me_toca(uuid, uuid) to authenticated;

-- Una evaluación no se puede mudar de evento (así nunca se pisa la nota de otra instancia).
create function jurado_evaluacion_mismo_evento() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.evento_id is not null and new.evento_id is distinct from old.evento_id then
    raise exception 'Una evaluación no se puede pasar a otro evento';
  end if;
  return new;
end $$;
create trigger jurado_evaluacion_mismo_evento before update on jurado_evaluaciones
  for each row execute function jurado_evaluacion_mismo_evento();

-- Cargar, cambiar o borrar notas: solo con evento y solo de equipos del propio salón.
create policy "con evento y en su salon (alta)" on jurado_evaluaciones as restrictive for insert to authenticated
  with check (evento_id is not null and jurado_me_toca(evento_id, proyecto_id));
create policy "con evento y en su salon (cambio)" on jurado_evaluaciones as restrictive for update to authenticated
  using (evento_id is not null and jurado_me_toca(evento_id, proyecto_id))
  with check (evento_id is not null and jurado_me_toca(evento_id, proyecto_id));
create policy "con evento y en su salon (baja)" on jurado_evaluaciones as restrictive for delete to authenticated
  using (evento_id is not null and jurado_me_toca(evento_id, proyecto_id));

-- Lo mismo para los puntajes de cada criterio.
-- (Una política por acción: "for all" también limitaría lo que el admin puede leer.)
create policy "con evento y en su salon (alta)" on jurado_puntajes as restrictive for insert to authenticated
  with check (evaluacion_id in (select id from jurado_evaluaciones where evento_id is not null and jurado_me_toca(evento_id, proyecto_id)));
create policy "con evento y en su salon (cambio)" on jurado_puntajes as restrictive for update to authenticated
  using (evaluacion_id in (select id from jurado_evaluaciones where evento_id is not null and jurado_me_toca(evento_id, proyecto_id)))
  with check (evaluacion_id in (select id from jurado_evaluaciones where evento_id is not null and jurado_me_toca(evento_id, proyecto_id)));
create policy "con evento y en su salon (baja)" on jurado_puntajes as restrictive for delete to authenticated
  using (evaluacion_id in (select id from jurado_evaluaciones where evento_id is not null and jurado_me_toca(evento_id, proyecto_id)));

-- Ver notas: el jurado ve las de los equipos de su salón en cada evento, más las suyas propias
-- (para poder avisarle si ya evaluó a ese equipo en otro evento). El admin sigue viendo todo.
create policy "jurado ve su salon" on jurado_evaluaciones as restrictive for select to authenticated
  using (mi_rol() is distinct from 'jurado'
    or jurado_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))
    or (evento_id is not null and jurado_me_toca(evento_id, proyecto_id)));
create policy "jurado ve su salon" on jurado_puntajes as restrictive for select to authenticated
  using (mi_rol() is distinct from 'jurado' or evaluacion_id in (select id from jurado_evaluaciones));
