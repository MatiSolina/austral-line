-- GRUPO ALUMNOS: historial de proyectos de años anteriores ("ideas con moco", Agente de Competencia y Originalidad).
-- Los profesores cargan los proyectos de otras cohortes (nombre, año y descripción). Cuando un alumno mira una
-- idea del banco, se le avisa si se parece a alguno, para que lo investigue y se diferencie. Es solo un aviso:
-- un parecido no quiere decir que la idea no sirva. El parecido se calcula por palabras en común (búsqueda en
-- español de Postgres), sin IA.

create table alumnos_proyectos_anteriores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 2 and 120),
  anio smallint not null check (anio between 2000 and 2100),
  descripcion text not null check (char_length(btrim(descripcion)) between 10 and 3000),
  resultado text check (char_length(resultado) <= 500), -- qué pasó con el proyecto (opcional)
  created_at timestamptz not null default now(),
  cargado_por uuid references personas(id) on delete set null
);

alter table alumnos_proyectos_anteriores enable row level security;
create policy "leer con rol" on alumnos_proyectos_anteriores for select to authenticated using (mi_rol() is not null);
create policy "admin escribe" on alumnos_proyectos_anteriores for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Proyectos de otros años parecidos a un texto: comparte al menos 3 palabras significativas (sin las comunes
-- como "de", "para"…) y al menos el 20 % de las del más corto. Devuelve los 3 más parecidos.
create function public.alumnos_parecidos_anteriores(p_texto text)
returns table (id uuid, nombre text, anio smallint, descripcion text, resultado text, comunes integer)
language sql stable security invoker set search_path = public as $$
  with buscado as (
    select array(select distinct unnest(tsvector_to_array(to_tsvector('spanish', coalesce(p_texto, ''))))) as palabras
  ),
  comparados as (
    select a.*, b.palabras as de_busqueda,
      array(select distinct unnest(tsvector_to_array(to_tsvector('spanish', a.nombre || ' ' || a.descripcion)))) as del_proyecto
    from alumnos_proyectos_anteriores a, buscado b
  )
  select c.id, c.nombre, c.anio, c.descripcion, c.resultado,
         cardinality(array(select unnest(c.de_busqueda) intersect select unnest(c.del_proyecto)))::integer as comunes
  from comparados c
  where cardinality(array(select unnest(c.de_busqueda) intersect select unnest(c.del_proyecto))) >= 3
    and cardinality(array(select unnest(c.de_busqueda) intersect select unnest(c.del_proyecto)))
        >= 0.2 * least(greatest(cardinality(c.de_busqueda), 1), greatest(cardinality(c.del_proyecto), 1))
  order by 6 desc, c.anio desc
  limit 3
$$;
revoke execute on function public.alumnos_parecidos_anteriores(text) from public, anon;
grant execute on function public.alumnos_parecidos_anteriores(text) to authenticated;
