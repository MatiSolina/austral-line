-- MENTORES: el coordinador puede asignar a mano un mentor que el agente no sugirió.
-- La asignación a mano se guarda igual que una sugerencia aceptada (así el mentor, los alumnos, las reuniones
-- y el feedback la ven sin cambios), colgada de un pedido marcado como manual: el agente no participó.
-- En esas filas, afinidad queda en 0 (no hubo evaluación del agente) y motivo es lo que escribió el coordinador.
-- Las métricas del agente (aceptación, tiempo ahorrado, pedidos) no las cuentan.
alter table mentores_match_pedidos add column manual boolean not null default false;
comment on column mentores_match_pedidos.manual is
  'true = asignación a mano del coordinador, sin sugerencia del agente. Su sugerencia no tiene afinidad real (0).';
