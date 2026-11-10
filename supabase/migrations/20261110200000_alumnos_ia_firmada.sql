-- GRUPO ALUMNOS: las respuestas de la IA (Requisitos) y las validaciones de entregas solo las guarda el servidor.
-- Antes, alumnos_completar_pregunta y alumnos_completar_validacion se podían llamar con la sesión del alumno
-- y cualquier integrante podía guardar a mano un "cumple todo" o una "respuesta de la IA" inventada.
-- Ahora el servidor firma cada guardado con una clave que el alumno no conoce (variable ALUMNOS_IA_FIRMA)
-- y la base la verifica contra alumnos_ia_clave, una tabla sin policies: solo la leen estas funciones.
-- En local la clave es 'desarrollo-local-firma' (seed.sql); en producción se carga a mano, fuera del repo.

create table alumnos_ia_clave (
  id smallint primary key default 1 check (id = 1),
  clave text not null check (char_length(clave) >= 16)
);
alter table alumnos_ia_clave enable row level security;
revoke all on alumnos_ia_clave from anon, authenticated;

create function public.alumnos_firma_valida(p_id uuid, p_firma text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.alumnos_ia_clave k
    where encode(extensions.hmac(p_id::text, k.clave, 'sha256'), 'hex') = p_firma
  )
$$;
revoke execute on function public.alumnos_firma_valida(uuid, text) from public, anon, authenticated;

create function public.alumnos_completar_pregunta_firmada(p_pregunta uuid, p_firma text, p_estado text, p_respuesta text default null, p_cita text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not alumnos_firma_valida(p_pregunta, p_firma) then raise exception 'Solo el servidor guarda las respuestas de la IA.'; end if;
  if p_estado not in ('respondida', 'derivada', 'error') then raise exception 'Estado inválido.'; end if;
  update alumnos_preguntas
  set estado = p_estado,
      respuesta_ia = case when p_estado = 'respondida' then left(p_respuesta, 3000) end,
      cita = case when p_estado = 'respondida' then left(p_cita, 1500) end,
      respondida_at = case when p_estado = 'respondida' then now() end
  where id = p_pregunta and estado = 'pendiente' and persona_id = mi_persona_id();
  if not found then raise exception 'Esa pregunta no está pendiente.'; end if;
end;
$$;

create function public.alumnos_completar_validacion_firmada(p_validacion uuid, p_firma text, p_resultado jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not alumnos_firma_valida(p_validacion, p_firma) then raise exception 'Solo el servidor guarda las validaciones de la IA.'; end if;
  update alumnos_validaciones
  set estado = case when p_resultado is null then 'error' else 'listo' end, resultado = p_resultado, terminado_at = now()
  where id = p_validacion and estado = 'pendiente' and pedido_por = mi_persona_id();
  if not found then raise exception 'Esa validación no está pendiente.'; end if;
end;
$$;

-- Las versiones sin firma quedan sin uso: nadie las puede llamar.
revoke execute on function public.alumnos_completar_pregunta(uuid, text, text, text),
  public.alumnos_completar_validacion(uuid, jsonb) from authenticated;

revoke execute on function public.alumnos_completar_pregunta_firmada(uuid, text, text, text, text),
  public.alumnos_completar_validacion_firmada(uuid, text, jsonb) from public, anon;
grant execute on function public.alumnos_completar_pregunta_firmada(uuid, text, text, text, text),
  public.alumnos_completar_validacion_firmada(uuid, text, jsonb) to authenticated;
