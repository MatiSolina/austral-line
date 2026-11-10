-- GRUPO AUSTRAL — restricciones para armar los grupos en el matching de alumnos sin proyecto.
-- Las define el admin en Matching → Ponderación y el agente las respeta al recomendar y al ubicar.
alter table austral_matching_config
  add column integrantes_min int not null default 3 check (integrantes_min between 1 and 12),
  add column integrantes_max int not null default 6 check (integrantes_max between 1 and 12),
  add column carreras_min int not null default 2 check (carreras_min between 1 and 6),
  add constraint austral_matching_config_integrantes_rango check (integrantes_min <= integrantes_max),
  add constraint austral_matching_config_carreras_rango check (carreras_min <= integrantes_max);
