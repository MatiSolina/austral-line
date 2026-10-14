-- Solo corre en local. Un login de prueba por rol, todos con contraseña austral123:
-- admin@austral.edu.ar · ana@alumnos.austral.edu.ar · marta@empresa.com · julio@empresa.com
create function pg_temp.crear_login(mail text) returns void language sql as $$
  with u as (
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      mail, crypt('austral123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
    returning id, email
  )
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  select gen_random_uuid(), id, id, jsonb_build_object('sub', id, 'email', email), 'email', now(), now() from u;
$$;

insert into personas (nombre, email, rol) values
  ('Admin Austral', 'admin@austral.edu.ar', 'admin'),
  ('Ana Alumna', 'ana@alumnos.austral.edu.ar', 'alumno'),
  ('Bruno Alumno', 'bruno@alumnos.austral.edu.ar', 'alumno'),
  ('Marta Mentora', 'marta@empresa.com', 'mentor'),
  ('Julio Jurado', 'julio@empresa.com', 'jurado');

insert into proyectos (nombre, descripcion, estado) values
  ('AgroSense', 'Sensores para riego inteligente', 'publicado'),
  ('Tutorly', 'Marketplace de tutorías', 'borrador');

insert into proyecto_integrantes
  select p.id, pe.id from proyectos p, personas pe
  where (p.nombre, pe.email) in (('AgroSense', 'ana@alumnos.austral.edu.ar'), ('Tutorly', 'bruno@alumnos.austral.edu.ar'));

insert into eventos (nombre, tipo, inicio, lugar) values
  ('Kickoff', 'presentacion', now() + interval '7 days', 'Aula Magna'),
  ('Demo Day', 'final', now() + interval '60 days', 'Auditorio');

select pg_temp.crear_login(email) from personas
  where email in ('admin@austral.edu.ar', 'ana@alumnos.austral.edu.ar', 'marta@empresa.com', 'julio@empresa.com');

-- GRUPO JURADO: un proyecto finalista más para probar la planilla de evaluación.
insert into proyectos (nombre, descripcion, estado) values
  ('Reciclá', 'App que premia a los vecinos por separar residuos', 'finalista');

-- GRUPO JURADO: una segunda jurado con evaluaciones cargadas, para ver el tablero de deliberación.
insert into personas (nombre, email, rol) values ('Lucía Inversora', 'lucia@fondo.com', 'jurado');
select pg_temp.crear_login('lucia@fondo.com');

with ev as (
  insert into jurado_evaluaciones (proyecto_id, jurado_id, propuesta_valor, comentarios)
  select p.id, pe.id, v.propuesta, v.comentario
  from (values
    ('AgroSense', 'Ahorro de agua para productores medianos con sensores baratos', 'Equipo sólido. Falta mostrar tracción con clientes reales.'),
    ('Reciclá', 'Premios por reciclar para que los vecinos separen en origen', 'Buena idea, el modelo de ingresos no queda claro.')
  ) as v(proyecto, propuesta, comentario)
  join proyectos p on p.nombre = v.proyecto
  join personas pe on pe.email = 'lucia@fondo.com'
  returning id, proyecto_id
)
insert into jurado_puntajes (evaluacion_id, criterio_id, puntaje)
select ev.id, c.id,
  case when p.nombre = 'AgroSense' then 9 - c.orden + 1 else 4 + c.orden end
from ev join proyectos p on p.id = ev.proyecto_id cross join jurado_criterios c;

-- GRUPO JURADO: ficha de ejemplo para AgroSense (Reciclá queda sin ficha para ver ese caso).
insert into jurado_fichas (proyecto_id, problema, solucion, propuesta_valor, mercado, modelo_negocio, etapa, traccion, link_presentacion)
select id,
  'Los productores medianos riegan "a ojo" y desperdician hasta 40% del agua.',
  'Sensores de humedad de bajo costo conectados a una app que indica cuándo y cuánto regar.',
  'Ahorro de agua y energía para productores medianos, con un equipo que se paga en una temporada.',
  'Productores frutihortícolas de 10 a 200 hectáreas en Mendoza y San Juan.',
  'Venta del kit de sensores + suscripción mensual por hectárea.',
  'prototipo',
  '3 pilotos en fincas de Maipú; 2 cartas de intención.',
  'https://www.notion.so/agrosense'
from proyectos where nombre = 'AgroSense';

-- GRUPO JURADO: una integrante para Reciclá, así el mail post-evento tiene contactos de todos los equipos.
insert into personas (nombre, email, rol) values ('Carla Alumna', 'carla@alumnos.austral.edu.ar', 'alumno');
insert into proyecto_integrantes
  select p.id, pe.id from proyectos p, personas pe
  where p.nombre = 'Reciclá' and pe.email = 'carla@alumnos.austral.edu.ar';

-- GRUPO ALUMNOS: alumnos de prueba con perfil, para probar "Compañeros afines".
-- Logins con contraseña austral123: carla@, diego@ y elena@alumnos.austral.edu.ar. Ana arranca sin perfil.
-- Carla ya la suma el bloque de Jurado (integrante de Reciclá); acá solo se agrega si falta.
insert into personas (nombre, email, rol) values
  ('Carla Alumna', 'carla@alumnos.austral.edu.ar', 'alumno'),
  ('Diego Alumno', 'diego@alumnos.austral.edu.ar', 'alumno'),
  ('Elena Alumna', 'elena@alumnos.austral.edu.ar', 'alumno')
on conflict (email) do nothing;

select pg_temp.crear_login(email) from personas
  where email in ('carla@alumnos.austral.edu.ar', 'diego@alumnos.austral.edu.ar', 'elena@alumnos.austral.edu.ar');

insert into alumnos_perfiles (persona_id, sobre_mi, busca_equipo)
select pe.id, v.sobre_mi, v.busca_equipo
from personas pe join (values
  ('carla@alumnos.austral.edu.ar', 'Me interesa mejorar el acceso a la salud en el interior.', true),
  ('diego@alumnos.austral.edu.ar', 'Vengo de una familia de productores, me gustaría algo de agro.', true),
  ('elena@alumnos.austral.edu.ar', null, true),
  ('bruno@alumnos.austral.edu.ar', 'Ya estoy en Tutorly.', false)
) as v(email, sobre_mi, busca_equipo) on v.email = pe.email;

insert into alumnos_carreras (persona_id, carrera_id)
select pe.id, m.id
from (values
  ('carla@alumnos.austral.edu.ar', 'Marketing'),
  ('diego@alumnos.austral.edu.ar', 'Agronegocios'),
  ('elena@alumnos.austral.edu.ar', 'Administración de Empresas'),
  ('bruno@alumnos.austral.edu.ar', 'Negocios Digitales')
) as v(email, carrera)
join personas pe on pe.email = v.email
join alumnos_carreras_maestro m on m.nombre = v.carrera;

-- Cuánto le interesa a cada uno cada tema (1 a 5 estrellas).
insert into alumnos_intereses (persona_id, interes_id, estrellas)
select pe.id, m.id, v.estrellas
from (values
  ('carla@alumnos.austral.edu.ar', 'Salud', 5), ('carla@alumnos.austral.edu.ar', 'Impacto social', 4),
  ('carla@alumnos.austral.edu.ar', 'Finanzas y fintech', 1), ('carla@alumnos.austral.edu.ar', 'Agro y alimentos', 2),
  ('diego@alumnos.austral.edu.ar', 'Agro y alimentos', 5), ('diego@alumnos.austral.edu.ar', 'Sustentabilidad y ambiente', 4),
  ('diego@alumnos.austral.edu.ar', 'Moda y diseño', 1), ('diego@alumnos.austral.edu.ar', 'Educación', 3),
  ('elena@alumnos.austral.edu.ar', 'Agro y alimentos', 4), ('elena@alumnos.austral.edu.ar', 'Finanzas y fintech', 5),
  ('elena@alumnos.austral.edu.ar', 'Salud', 1), ('elena@alumnos.austral.edu.ar', 'Consumo y retail', 3),
  ('bruno@alumnos.austral.edu.ar', 'Educación', 5), ('bruno@alumnos.austral.edu.ar', 'Tecnología y software', 5),
  ('bruno@alumnos.austral.edu.ar', 'Agro y alimentos', 2), ('bruno@alumnos.austral.edu.ar', 'Salud', 3)
) as v(email, interes, estrellas)
join personas pe on pe.email = v.email
join alumnos_intereses_maestro m on m.nombre = v.interes;
