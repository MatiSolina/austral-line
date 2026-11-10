-- GRUPO JURADO: mails del resumen del pitch (agente de IA Lab).
-- · entrega: a cada jurado de un salón, el día anterior al evento a las 18:00, con el link a sus resúmenes.
-- · alerta: a los admins, en el momento en que el agente frena (falta material, archivo dañado, material de otro equipo).
-- Tabla aparte de jurado_envios para no cambiar los tipos que ya acepta aquella (solo cambios que suman).
create table jurado_resumen_envios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  tipo text not null check (tipo in ('entrega', 'alerta')),
  proyecto_id uuid references proyectos(id) on delete set null, -- en las alertas: el equipo con problemas
  persona_id uuid references personas(id) on delete set null,
  email text not null,
  asunto text not null,
  programado_para timestamptz, -- null = se mandó en el momento
  estado text not null check (estado in ('programado', 'enviado', 'simulado', 'cancelado', 'error')),
  resend_id text, -- id del mail en Resend, para poder cancelarlo
  error text,
  reporte text, -- en las alertas: el reporte del agente, para no mandar dos veces la misma alerta
  created_at timestamptz not null default now()
);
create index jurado_resumen_envios_evento on jurado_resumen_envios (evento_id, tipo);

-- Solo el admin manda estos mails y ve el historial.
alter table jurado_resumen_envios enable row level security;
create policy "admin todo" on jurado_resumen_envios for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
