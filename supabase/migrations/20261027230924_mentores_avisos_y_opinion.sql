-- GRUPO MENTORES: el asistente le manda los avisos al coordinador por mail, y el mentor opina sobre el resumen
-- (¿le sirvió? ¿cuánto tiempo de preparación le ahorró?). Son las métricas de satisfacción y tiempo ahorrado.
alter table mentores_resumenes
  add column aviso_mail_at timestamptz,  -- cuándo se le mandó el aviso por mail al coordinador
  add column le_sirvio boolean,          -- opinión del mentor sobre el resumen
  add column minutos_ahorrados int check (minutos_ahorrados >= 0); -- tiempo de preparación que le ahorró, según el mentor
