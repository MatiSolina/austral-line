-- GRUPO AUSTRAL: distingue las asignaciones que propuso el motor de las que el admin hizo a mano
-- ("Ubicar" desde Alumnos sin grupo), para que las manuales no inflen las métricas del agente.
alter table austral_recomendaciones add column origen text not null default 'motor' check (origen in ('motor', 'manual'));
update austral_recomendaciones set origen = 'manual' where observaciones like 'Ubicado a mano%';
