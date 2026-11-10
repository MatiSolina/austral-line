-- GRUPO MENTORES: blindaje de las encuestas del feedback post reunión (observación de la revisión del #18).
-- Las policies dicen QUIÉN puede tocar una encuesta; estos triggers dicen QUÉ puede cambiar:
--   * Nadie que no sea coordinador puede crear una encuesta ya contestada, ni a nombre de alguien que no estuvo
--     en la reunión (antes, un mentor podía inventar respuestas de sus alumnos por fuera de la app).
--   * Una respuesta enviada no se cambia más (antes se podía modificar por fuera de la pantalla).
--   * Los datos que maneja el agente (a quién, de qué reunión, recordatorio, mail) no los toca quien contesta.
-- Valen para los usuarios de la app. El coordinador (admin), las tareas sin sesión (clave de servicio) y los cambios
-- hechos directo en la base (migraciones, correcciones a mano) quedan libres, como hasta ahora.

-- Quien recibe la encuesta tiene que haber estado en la reunión: su mentor, o un alumno del equipo. Vale para todos.
create function public.mentores_encuesta_al_crear() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.mentores_reuniones r
    where r.id = new.reunion_id
      and ((new.papel = 'mentor' and r.mentor_id = new.persona_id)
        or (new.papel = 'alumno' and exists (
          select 1 from public.proyecto_integrantes i
          join public.personas p on p.id = i.persona_id
          where i.proyecto_id = r.proyecto_id and i.persona_id = new.persona_id and p.rol = 'alumno')))
  ) then
    raise exception 'La encuesta tiene que ser para el mentor o un alumno del equipo de esa reunión';
  end if;

  if current_user in ('authenticated', 'anon') and public.mi_rol() is distinct from 'admin' then
    -- Se crea vacía y pendiente: las respuestas las carga solo quien contesta.
    if new.estado <> 'pendiente' or new.puntaje is not null or new.sirvio is not null or new.mejorar is not null
      or new.urgente is not null or new.respondida_at is not null or new.grave is not null
      or new.grave_motivo is not null or new.escalada_at is not null or new.recordatorio_at is not null then
      raise exception 'Una encuesta nueva tiene que estar pendiente y sin respuestas';
    end if;
    new.created_at := now();
  end if;
  return new;
end $$;

create trigger mentores_encuesta_al_crear before insert on public.mentores_encuestas
  for each row execute function public.mentores_encuesta_al_crear();

create function public.mentores_encuesta_al_cambiar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or public.mi_rol() = 'admin' then
    return new;
  end if;

  -- Lo que maneja el agente no lo cambia quien contesta.
  if (new.id, new.reunion_id, new.persona_id, new.papel, new.proyecto_nombre, new.reunion_inicio, new.con_quien,
      new.created_at, new.recordatorio_at, new.mail_estado, new.mail_error)
    is distinct from
     (old.id, old.reunion_id, old.persona_id, old.papel, old.proyecto_nombre, old.reunion_inicio, old.con_quien,
      old.created_at, old.recordatorio_at, old.mail_estado, old.mail_error) then
    raise exception 'Esos datos de la encuesta no se pueden cambiar';
  end if;

  if old.estado = 'respondida' then
    -- Una respuesta enviada no se cambia más.
    if (new.estado, new.puntaje, new.sirvio, new.mejorar, new.urgente, new.respondida_at)
      is distinct from (old.estado, old.puntaje, old.sirvio, old.mejorar, old.urgente, old.respondida_at) then
      raise exception 'La encuesta ya fue contestada y no se puede cambiar';
    end if;
    -- Lo que marca el agente después de leer la respuesta se escribe una sola vez.
    if (old.grave is not null and new.grave is distinct from old.grave)
      or (old.grave_motivo is not null and new.grave_motivo is distinct from old.grave_motivo)
      or (old.escalada_at is not null and new.escalada_at is distinct from old.escalada_at) then
      raise exception 'El aviso al coordinador ya quedó registrado y no se puede cambiar';
    end if;
  else
    -- Pendiente (o sin respuesta, si contesta tarde): solo puede pasar a contestada, con su puntaje.
    if new.estado not in (old.estado, 'respondida') then
      raise exception 'Una encuesta solo puede pasar a contestada';
    end if;
    if new.estado = 'respondida' then
      if new.puntaje is null then
        raise exception 'Falta el puntaje de la reunión';
      end if;
      new.respondida_at := now();
    end if;
    if (new.grave, new.grave_motivo, new.escalada_at) is distinct from (old.grave, old.grave_motivo, old.escalada_at) then
      raise exception 'El aviso al coordinador lo marca el asistente después de la respuesta';
    end if;
  end if;
  return new;
end $$;

create trigger mentores_encuesta_al_cambiar before update on public.mentores_encuestas
  for each row execute function public.mentores_encuesta_al_cambiar();
