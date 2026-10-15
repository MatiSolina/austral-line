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

-- GRUPO JURADO: el Kickoff organizado en dos salones (el Demo Day queda sin organizar para ver ese caso).
insert into jurado_salones (evento_id, nombre, orden)
select e.id, s.nombre, s.orden from eventos e, (values ('Salón A', 1), ('Salón B', 2)) as s(nombre, orden)
where e.nombre = 'Kickoff';

insert into jurado_salon_proyectos (evento_id, salon_id, proyecto_id)
select s.evento_id, s.id, p.id from jurado_salones s
join (values ('Salón A', 'AgroSense'), ('Salón B', 'Reciclá')) as a(salon, proyecto) on a.salon = s.nombre
join proyectos p on p.nombre = a.proyecto;

insert into jurado_salon_jurados (evento_id, salon_id, jurado_id)
select s.evento_id, s.id, pe.id from jurado_salones s
join (values ('Salón A', 'julio@empresa.com'), ('Salón B', 'lucia@fondo.com')) as a(salon, email) on a.salon = s.nombre
join personas pe on pe.email = a.email;
