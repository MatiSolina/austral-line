-- Alumnos: los links del análisis de competencia tienen que ser http(s).
-- alumnos_completar_analisis la llama el servidor con la sesión del alumno, así que un integrante también
-- la puede llamar a mano: la base rechaza links que no sean http(s) (por ejemplo "javascript:").
-- not valid: aplica a filas nuevas y cambios; la pantalla igual filtra los links de filas viejas.
alter table alumnos_competencia_analisis add constraint alumnos_competencia_links_http check (
  resultado is null or not jsonb_path_exists(
    resultado,
    '$ ? (exists(@.competidores[*] ? (!(@.fuente like_regex "^https?://" flag "i"))) || exists(@.fuentes[*] ? (!(@.url like_regex "^https?://" flag "i"))))'
  )
) not valid;
