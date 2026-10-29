-- GRUPO MENTORES: agente de coordinación + feedback post reunión (opción B del relevamiento).
-- Cuando termina una reunión de mentores_reuniones, el agente le pide feedback corto al mentor y a cada alumno del
-- equipo, recuerda una sola vez a quien no contesta y avisa al coordinador si siguen sin contestar o si alguien
-- cuenta algo grave. Con las respuestas arma un resumen anónimo que ve solo el coordinador (admin).
-- Nadie ve lo que contestó el otro: cada persona solo ve su propia encuesta.

-- Cuándo el agente pidió el feedback de la reunión. Marcarlo primero evita pedirlo dos veces
-- (el mentor no puede ver si ya existen las encuestas de los alumnos).
alter table mentores_reuniones add column feedback_pedido_at timestamptz;

-- Una encuesta por persona y reunión. Lleva copiados los datos de la reunión que necesita quien contesta,
-- para que el alumno no tenga que leer mentores_reuniones (ahí están las notas privadas del mentor).
create table mentores_encuestas (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references mentores_reuniones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  papel text not null check (papel in ('mentor', 'alumno')),
  proyecto_nombre text not null,
  reunion_inicio timestamptz not null,
  con_quien text not null,          -- "Marta Mentora" para el alumno; "el equipo" para el mentor
  estado text not null default 'pendiente' check (estado in ('pendiente', 'respondida', 'sin_respuesta')),
  mail_estado text check (mail_estado in ('simulado', 'enviado', 'error')),
  mail_error text,
  recordatorio_at timestamptz,      -- el único recordatorio que se manda (no insistir de más)
  -- Respuestas
  puntaje smallint check (puntaje between 1 and 5), -- qué tan útil fue la reunión
  sirvio text,                      -- qué le sirvió
  mejorar text,                     -- qué mejoraría
  urgente text,                     -- algo que el coordinador tenga que saber ya
  grave boolean,                    -- lo marca el agente al leer la respuesta
  grave_motivo text,
  escalada_at timestamptz,          -- cuándo se le avisó al coordinador por algo grave
  respondida_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reunion_id, persona_id)
);

create index on mentores_encuestas (persona_id, estado);

-- El resumen que arma el agente con las respuestas de una reunión (uno por reunión). Anónimo: no dice quién dijo qué.
create table mentores_feedback_resumenes (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null unique references mentores_reuniones(id) on delete cascade,
  resumen text not null,
  respuestas smallint not null,     -- cuántas encuestas contestadas usó
  pedidas smallint not null,        -- cuántas se pidieron
  con_ia boolean not null,          -- false = armado solo con los números, sin la síntesis de la IA
  aviso text,                       -- algo que el coordinador tiene que mirar
  util boolean,                     -- el coordinador marca si el resumen le sirvió (calidad del resumen)
  created_at timestamptz not null default now()
);

-- Encuestas: el admin ve todo. Cada persona ve y contesta solo la suya.
-- El mentor (o el coordinador) crea las de sus reuniones cuando terminan, pero no puede leer las de los alumnos.
alter table mentores_encuestas enable row level security;
create policy "admin todo" on mentores_encuestas for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "cada uno lee la suya" on mentores_encuestas for select to authenticated
  using (persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
create policy "cada uno contesta la suya" on mentores_encuestas for update to authenticated
  using (persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')))
  with check (persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
create policy "mentor pide en sus reuniones" on mentores_encuestas for insert to authenticated
  with check (mi_rol() = 'mentor' and exists (
    select 1 from mentores_reuniones r
    where r.id = reunion_id
      and r.mentor_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))));

-- Resúmenes de feedback: solo el coordinador.
alter table mentores_feedback_resumenes enable row level security;
create policy "admin todo" on mentores_feedback_resumenes for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
