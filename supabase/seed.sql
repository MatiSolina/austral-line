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

-- MENTORES: dos mentores más (sin login) y perfiles para probar el match.
insert into personas (nombre, email, rol) values
  ('Diego Mentor', 'diego@empresa.com', 'mentor'),
  ('Lucía Mentora', 'lucia@empresa.com', 'mentor');

insert into mentores_perfiles (persona_id, especialidades, industrias, experiencia, cupo_proyectos)
select id, v.especialidades, v.industrias, v.experiencia, v.cupo from personas
join (values
  ('marta@empresa.com', 'Producto, hardware, operaciones', 'Agro, IoT', '12 años liderando producto en una agtech; armó la red de distribuidores en el interior.', 3),
  ('diego@empresa.com', 'Finanzas, levantamiento de capital', 'Fintech, SaaS', 'Ex VC. Ayudó a 20 startups a cerrar su primera ronda.', 2),
  ('lucia@empresa.com', 'Marketing digital, growth', 'Educación, marketplaces', 'Fundó una plataforma de cursos online con 50 mil alumnos.', null)
) as v(email, especialidades, industrias, experiencia, cupo) using (email);
