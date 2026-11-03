-- GRUPO AUSTRAL: seguimiento orientativo de necesidades del proyecto y mentores de sesión.
-- Ninguna función cambia los vínculos formales ni al mentor titular.
create table austral_titulares_proyecto (
  proyecto_id uuid primary key references proyectos(id) on delete cascade,
  mentor_id uuid not null,
  designado_por uuid not null references personas(id),
  designado_at timestamptz not null default now(),
  foreign key (mentor_id, proyecto_id)
    references austral_vinculos_mentor_proyecto(mentor_id, proyecto_id)
    on delete no action deferrable initially deferred
);

create table austral_necesidades_revision (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  etapa text not null check (etapa in ('idea', 'prototipo', 'validacion', 'crecimiento')),
  sector text not null default '',
  necesidades text[] not null check (cardinality(necesidades) between 1 and 10),
  contexto text not null default '' check (length(contexto) <= 1200),
  registrado_por uuid not null references personas(id),
  created_at timestamptz not null default now(),
  check (length(sector) <= 100)
);
create index austral_necesidades_proyecto_fecha on austral_necesidades_revision(proyecto_id, created_at desc);

-- Cada revisión conserva el cálculo de ese momento. Si el mentor actualiza sus etiquetas,
-- se recalcula su fila en la revisión vigente; las revisiones anteriores conservan su historia.
create table austral_compatibilidades (
  revision_id uuid not null references austral_necesidades_revision(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  mentor_id uuid not null references personas(id) on delete cascade,
  porcentaje integer not null check (porcentaje between 0 and 100),
  coincidencias text[] not null default '{}',
  faltantes text[] not null default '{}',
  calculado_at timestamptz not null default now(),
  primary key (revision_id, mentor_id)
);
create index austral_compatibilidades_proyecto on austral_compatibilidades(proyecto_id, revision_id);

-- Una decisión sobre una sugerencia no asigna, reemplaza ni contacta a ningún mentor.
create table austral_recomendaciones_sesion (
  revision_id uuid not null references austral_necesidades_revision(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  mentor_id uuid not null references personas(id) on delete cascade,
  estado text not null check (estado in ('considerada', 'descartada')),
  decidido_por uuid not null references personas(id),
  decidido_at timestamptz not null default now(),
  primary key (revision_id, mentor_id),
  foreign key (revision_id, mentor_id)
    references austral_compatibilidades(revision_id, mentor_id) on delete cascade
);

create table austral_satisfaccion_mentoria (
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  alumno_id uuid not null references personas(id) on delete cascade,
  puntaje smallint not null check (puntaje between 1 and 5),
  comentario text not null default '' check (length(comentario) <= 500),
  actualizado_at timestamptz not null default now(),
  primary key (proyecto_id, alumno_id)
);

alter table austral_titulares_proyecto enable row level security;
alter table austral_necesidades_revision enable row level security;
alter table austral_compatibilidades enable row level security;
alter table austral_recomendaciones_sesion enable row level security;
alter table austral_satisfaccion_mentoria enable row level security;

create policy "admin gestiona titulares" on austral_titulares_proyecto for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "admin lee revisiones" on austral_necesidades_revision for select to authenticated
  using (mi_rol() = 'admin');
create policy "admin registra revisiones" on austral_necesidades_revision for insert to authenticated
  with check (mi_rol() = 'admin' and registrado_por = austral_yo());
create policy "admin lee compatibilidades" on austral_compatibilidades for select to authenticated
  using (mi_rol() = 'admin');
create policy "admin gestiona recomendaciones" on austral_recomendaciones_sesion for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "admin lee satisfaccion" on austral_satisfaccion_mentoria for select to authenticated
  using (mi_rol() = 'admin');
create policy "alumno lee su satisfaccion" on austral_satisfaccion_mentoria for select to authenticated
  using (mi_rol() = 'alumno' and alumno_id = austral_yo());
create policy "alumno registra su satisfaccion" on austral_satisfaccion_mentoria for insert to authenticated
  with check (mi_rol() = 'alumno' and alumno_id = austral_yo() and exists (
    select 1 from proyecto_integrantes i
    where i.proyecto_id = austral_satisfaccion_mentoria.proyecto_id and i.persona_id = austral_yo()
  ));
create policy "alumno actualiza su satisfaccion" on austral_satisfaccion_mentoria for update to authenticated
  using (mi_rol() = 'alumno' and alumno_id = austral_yo())
  with check (mi_rol() = 'alumno' and alumno_id = austral_yo() and exists (
    select 1 from proyecto_integrantes i
    where i.proyecto_id = austral_satisfaccion_mentoria.proyecto_id and i.persona_id = austral_yo()
  ));

-- Coincidencia exacta de etiquetas normalizadas. Las necesidades pesan 80 % y el sector
-- 20 %; si no hay sector, las necesidades pesan 100 %. Es una orientación, no una decisión.
create function austral_calcular_compatibilidad(p_revision uuid, p_mentor uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r austral_necesidades_revision%rowtype;
  c austral_contactos_mentores%rowtype;
  cubiertas text[];
  descubiertas text[];
  cantidad integer;
  sector_igual boolean;
  score integer;
begin
  select * into r from austral_necesidades_revision where id = p_revision;
  select * into c from austral_contactos_mentores where mentor_id = p_mentor;
  if r.id is null or c.mentor_id is null then return; end if;

  select coalesce(array_agg(n.termino order by n.orden), '{}') into cubiertas
  from unnest(r.necesidades) with ordinality as n(termino, orden)
  where exists (
    select 1 from unnest(c.especialidades) as e(termino)
    where lower(btrim(e.termino)) = lower(btrim(n.termino))
  );
  select coalesce(array_agg(n.termino order by n.orden), '{}') into descubiertas
  from unnest(r.necesidades) with ordinality as n(termino, orden)
  where not exists (
    select 1 from unnest(c.especialidades) as e(termino)
    where lower(btrim(e.termino)) = lower(btrim(n.termino))
  );
  cantidad := cardinality(r.necesidades);
  sector_igual := btrim(r.sector) <> '' and lower(btrim(r.sector)) = lower(btrim(c.industria));
  score := case when btrim(r.sector) = ''
    then round(100.0 * cardinality(cubiertas) / cantidad)::integer
    else round(80.0 * cardinality(cubiertas) / cantidad + case when sector_igual then 20 else 0 end)::integer
  end;
  insert into austral_compatibilidades
    (revision_id, proyecto_id, mentor_id, porcentaje, coincidencias, faltantes, calculado_at)
  values (r.id, r.proyecto_id, p_mentor, score, cubiertas, descubiertas, now())
  on conflict (revision_id, mentor_id) do update set
    porcentaje = excluded.porcentaje,
    coincidencias = excluded.coincidencias,
    faltantes = excluded.faltantes,
    calculado_at = excluded.calculado_at;
end;
$$;

create function austral_recalcular_revision() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare m record;
begin
  for m in select mentor_id from austral_contactos_mentores loop
    perform austral_calcular_compatibilidad(new.id, m.mentor_id);
  end loop;
  return new;
end;
$$;
create trigger recalcular_revision after insert on austral_necesidades_revision
  for each row execute function austral_recalcular_revision();

create function austral_recalcular_mentor() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  for r in
    select distinct on (proyecto_id) id from austral_necesidades_revision
    order by proyecto_id, created_at desc, id desc
  loop
    perform austral_calcular_compatibilidad(r.id, new.mentor_id);
  end loop;
  return new;
end;
$$;
create trigger recalcular_al_cambiar_mentor
  after insert or update of industria, especialidades on austral_contactos_mentores
  for each row execute function austral_recalcular_mentor();

revoke all on function austral_calcular_compatibilidad(uuid, uuid) from public;
revoke all on function austral_recalcular_revision() from public;
revoke all on function austral_recalcular_mentor() from public;
