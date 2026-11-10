-- GRUPO ALUMNOS: grupos compatibles para unirse (Agente de Armado y Gestión de Grupos).
-- Sugiere pares de grupos (proyectos) que podrían juntarse: juntos no pasan de 6 integrantes, comparten temas
-- que les interesan mucho y suman carreras. Es solo una sugerencia: la ven los profesores (todos los pares) y
-- cada grupo (los suyos). Si deciden unirse, el cambio se pide como siempre.
-- Intereses de cada grupo: los propios del grupo si ya los armaron; si no, el promedio de sus integrantes.
--
-- Privacidad: la función es security definer (necesita las carreras e intereses de todos para calcular),
-- así que el detalle (temas en común, choques y carreras que suma cada uno) se devuelve solo a los
-- profesores. A un alumno le llegan solo los pares de su grupo, con nombre, cantidad de integrantes y
-- puntaje; el detalle viene vacío (null). Así no se pueden deducir la carrera ni las estrellas de nadie.

create function public.alumnos_grupos_compatibles()
returns table (
  proyecto_a uuid, nombre_a text, integrantes_a integer,
  proyecto_b uuid, nombre_b text, integrantes_b integer,
  temas_comunes text[], choques text[], carreras_solo_a text[], carreras_solo_b text[], puntaje integer
)
language sql stable security definer set search_path = public as $$
  with yo as (select mi_persona_id() as id, mi_rol() as rol),
  tam as (select proyecto_id, count(*)::integer as n from proyecto_integrantes group by proyecto_id),
  carreras as (
    select distinct i.proyecto_id, c.carrera_id
    from proyecto_integrantes i join alumnos_carreras c on c.persona_id = i.persona_id
  ),
  intereses as (
    select proyecto_id, interes_id, estrellas::numeric as estrellas from alumnos_grupo_intereses
    union all
    select i.proyecto_id, r.interes_id, round(avg(r.estrellas))
    from proyecto_integrantes i join alumnos_intereses r on r.persona_id = i.persona_id
    where i.proyecto_id not in (select proyecto_id from alumnos_grupo_intereses)
    group by i.proyecto_id, r.interes_id
  ),
  pares as (
    select a.proyecto_id as pa, a.n as na, b.proyecto_id as pb, b.n as nb
    from tam a join tam b on a.proyecto_id < b.proyecto_id and a.n + b.n <= 6
  ),
  calculo as (
    select p.*,
      array(
        select m.nombre from alumnos_intereses_maestro m
        join intereses ia on ia.proyecto_id = p.pa and ia.interes_id = m.id and ia.estrellas >= 4
        join intereses ib on ib.proyecto_id = p.pb and ib.interes_id = m.id and ib.estrellas >= 4
        where m.activo order by m.orden
      ) as comunes,
      array(
        select m.nombre from alumnos_intereses_maestro m
        join intereses ia on ia.proyecto_id = p.pa and ia.interes_id = m.id
        join intereses ib on ib.proyecto_id = p.pb and ib.interes_id = m.id
        where m.activo and ((ia.estrellas >= 4 and ib.estrellas <= 2) or (ib.estrellas >= 4 and ia.estrellas <= 2))
        order by m.orden
      ) as choques,
      array(
        select cm.nombre from alumnos_carreras_maestro cm
        where cm.id in (select carrera_id from carreras where proyecto_id = p.pa)
          and cm.id not in (select carrera_id from carreras where proyecto_id = p.pb)
        order by cm.orden
      ) as solo_a,
      array(
        select cm.nombre from alumnos_carreras_maestro cm
        where cm.id in (select carrera_id from carreras where proyecto_id = p.pb)
          and cm.id not in (select carrera_id from carreras where proyecto_id = p.pa)
        order by cm.orden
      ) as solo_b
    from pares p
  )
  select c.pa, pa.nombre, c.na, c.pb, pb.nombre, c.nb,
         case when yo.rol = 'admin' then c.comunes end,
         case when yo.rol = 'admin' then c.choques end,
         case when yo.rol = 'admin' then c.solo_a end,
         case when yo.rol = 'admin' then c.solo_b end,
         (2 * cardinality(c.comunes) - 3 * cardinality(c.choques) + case when cardinality(c.solo_a) + cardinality(c.solo_b) > 0 then 3 else 0 end)::integer
  from calculo c
  join proyectos pa on pa.id = c.pa
  join proyectos pb on pb.id = c.pb
  cross join yo
  where (2 * cardinality(c.comunes) - 3 * cardinality(c.choques) + case when cardinality(c.solo_a) + cardinality(c.solo_b) > 0 then 3 else 0 end) > 0
    and (
      yo.rol = 'admin'
      or (yo.rol = 'alumno' and exists (
        select 1 from proyecto_integrantes i where i.persona_id = yo.id and i.proyecto_id in (c.pa, c.pb)
      ))
    )
  order by 11 desc, 2, 5
$$;

revoke execute on function public.alumnos_grupos_compatibles() from public, anon;
grant execute on function public.alumnos_grupos_compatibles() to authenticated;
