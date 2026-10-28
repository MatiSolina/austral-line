-- GRUPO MENTORES: reuniones de mentoría + agente de resumen pre-reunión.
-- El mentor (o el coordinador) carga la reunión; el agente arma solo un resumen y se lo manda
-- al mentor por mail 24 h antes. Lo único que escribe el agente es mentores_resumenes.

-- Reuniones entre un mentor y un proyecto. Las notas se completan después de cada reunión
-- y son lo que el agente lee como "reuniones anteriores" y "avances".
create table mentores_reuniones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  mentor_id uuid not null references personas(id) on delete cascade,
  inicio timestamptz not null,
  lugar text,          -- sala o link de la videollamada
  notas text,          -- qué se habló (se completa después de la reunión)
  proximos_pasos text, -- qué quedó pendiente para la próxima
  cancelada boolean not null default false,
  cargada_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on mentores_reuniones (mentor_id, inicio);
create index on mentores_reuniones (proyecto_id, inicio);

-- Cada resumen que arma el agente, con el mail tal cual se mandó. Si algo cambia antes del envío,
-- el agente arma uno nuevo y el anterior queda "reemplazado". También alimenta las métricas.
create table mentores_resumenes (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references mentores_reuniones(id) on delete cascade,
  email text not null,         -- el mentor
  asunto text not null,
  html text not null,
  con_ia boolean not null,     -- false = armado solo con los datos cargados, sin la síntesis de la IA
  aviso text,                  -- falta info importante, proyecto trabado o conflicto: lo mira el coordinador
  aviso_util boolean,          -- el coordinador marca si el aviso le sirvió
  programado_para timestamptz, -- 24 h antes de la reunión; null = salió en el momento
  estado text not null check (estado in ('programado', 'simulado', 'enviado', 'reemplazado', 'cancelado', 'error')),
  resend_id text,              -- id del mail en Resend, para poder cancelarlo
  error text,
  leido_at timestamptz,        -- primera vez que el mentor lo abrió en la app
  created_at timestamptz not null default now()
);

create index on mentores_resumenes (reunion_id, created_at);

-- Reuniones: el admin (coordinador) ve y carga todas; cada mentor, solo las suyas.
alter table mentores_reuniones enable row level security;
create policy "admin todo" on mentores_reuniones for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "mentor lo suyo" on mentores_reuniones for all to authenticated
  using (mi_rol() = 'mentor' and mentor_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')))
  with check (mi_rol() = 'mentor' and mentor_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));

-- Resúmenes: el admin ve todos; cada mentor, los de sus reuniones (el agente corre con su sesión).
alter table mentores_resumenes enable row level security;
create policy "admin todo" on mentores_resumenes for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "mentor lo suyo" on mentores_resumenes for all to authenticated
  using (mi_rol() = 'mentor' and exists (
    select 1 from mentores_reuniones r
    where r.id = reunion_id
      and r.mentor_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))))
  with check (mi_rol() = 'mentor' and exists (
    select 1 from mentores_reuniones r
    where r.id = reunion_id
      and r.mentor_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))));
