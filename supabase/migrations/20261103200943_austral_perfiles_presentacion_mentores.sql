-- GRUPO AUSTRAL: presentación profesional y audio que cada mentor entrega para revisión.
create table austral_perfiles_mentores (
  mentor_id uuid primary key references personas(id) on delete cascade,
  trayectoria text not null default '',
  intereses text not null default '',
  cv_url text not null default '',
  linkedin_url text not null default '',
  resumen text not null default '',
  audio_path text,
  audio_mime text,
  autoriza_audio boolean not null default false,
  estado text not null default 'revision' check (estado in ('revision', 'publicado')),
  actualizado_at timestamptz not null default now(),
  publicado_at timestamptz,
  check (audio_path is null or audio_path like mentor_id::text || '/%'),
  check (audio_mime is null or audio_mime in ('audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm')),
  check (estado <> 'publicado' or length(trim(resumen)) > 0)
);

-- Un mentor nunca puede aprobar su propia presentación, ni mantenerla publicada al editarla.
create function austral_resguardar_publicacion_perfil() returns trigger
language plpgsql set search_path = public as $$
begin
  if mi_rol() = 'mentor' then
    new.estado := 'revision';
    new.publicado_at := null;
  end if;
  return new;
end;
$$;
create trigger resguardar_publicacion_perfil before insert or update on austral_perfiles_mentores
  for each row execute function austral_resguardar_publicacion_perfil();

alter table austral_perfiles_mentores enable row level security;
create policy "admin gestiona perfiles" on austral_perfiles_mentores for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "mentor gestiona su presentacion" on austral_perfiles_mentores for all to authenticated
  using (mi_rol() = 'mentor' and mentor_id = austral_yo())
  with check (mi_rol() = 'mentor' and mentor_id = austral_yo());
create policy "alumno ve presentaciones autorizadas" on austral_perfiles_mentores for select to authenticated
  using (mi_rol() = 'alumno' and estado = 'publicado' and mentor_id in (
    select mentor_id from austral_contactos_mentores where publicado
  ));

create table austral_perfiles_escuchas (
  id bigint generated always as identity primary key,
  mentor_id uuid not null references austral_perfiles_mentores(mentor_id) on delete cascade,
  alumno_id uuid not null references personas(id) on delete cascade,
  escuchado_at timestamptz not null default now()
);
create index austral_perfiles_escuchas_mentor on austral_perfiles_escuchas(mentor_id);
alter table austral_perfiles_escuchas enable row level security;
create policy "admin lee escuchas" on austral_perfiles_escuchas for select to authenticated
  using (mi_rol() = 'admin');
create policy "alumno registra escucha" on austral_perfiles_escuchas for insert to authenticated
  with check (mi_rol() = 'alumno' and alumno_id = austral_yo() and mentor_id in (
    select mentor_id from austral_perfiles_mentores
    where estado = 'publicado' and autoriza_audio and audio_path is not null
  ));

create table austral_perfiles_valoraciones (
  mentor_id uuid not null references austral_perfiles_mentores(mentor_id) on delete cascade,
  alumno_id uuid not null references personas(id) on delete cascade,
  puntaje smallint not null check (puntaje between 1 and 5),
  actualizado_at timestamptz not null default now(),
  primary key (mentor_id, alumno_id)
);
alter table austral_perfiles_valoraciones enable row level security;
create policy "admin lee valoraciones" on austral_perfiles_valoraciones for select to authenticated
  using (mi_rol() = 'admin');
create policy "alumno ve su valoracion" on austral_perfiles_valoraciones for select to authenticated
  using (mi_rol() = 'alumno' and alumno_id = austral_yo());
create policy "alumno valora perfil visible" on austral_perfiles_valoraciones for insert to authenticated
  with check (mi_rol() = 'alumno' and alumno_id = austral_yo() and mentor_id in (
    select mentor_id from austral_perfiles_mentores where estado = 'publicado'
  ));
create policy "alumno actualiza su valoracion" on austral_perfiles_valoraciones for update to authenticated
  using (mi_rol() = 'alumno' and alumno_id = austral_yo())
  with check (mi_rol() = 'alumno' and alumno_id = austral_yo() and mentor_id in (
    select mentor_id from austral_perfiles_mentores where estado = 'publicado'
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('austral-audios-mentores', 'austral-audios-mentores', false, 10485760,
  array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'])
on conflict (id) do nothing;
create policy "mentor sube su audio" on storage.objects for insert to authenticated
  with check (bucket_id = 'austral-audios-mentores' and mi_rol() = 'mentor'
    and (storage.foldername(name))[1] = austral_yo()::text);
create policy "mentor ve su audio" on storage.objects for select to authenticated
  using (bucket_id = 'austral-audios-mentores' and mi_rol() = 'mentor'
    and (storage.foldername(name))[1] = austral_yo()::text);
create policy "mentor borra su audio" on storage.objects for delete to authenticated
  using (bucket_id = 'austral-audios-mentores' and mi_rol() = 'mentor'
    and (storage.foldername(name))[1] = austral_yo()::text);
create policy "admin gestiona audios" on storage.objects for all to authenticated
  using (bucket_id = 'austral-audios-mentores' and mi_rol() = 'admin')
  with check (bucket_id = 'austral-audios-mentores' and mi_rol() = 'admin');
create policy "alumno escucha audio autorizado" on storage.objects for select to authenticated
  using (bucket_id = 'austral-audios-mentores' and mi_rol() = 'alumno' and name in (
    select audio_path from austral_perfiles_mentores
    where estado = 'publicado' and autoriza_audio and audio_path is not null
  ));
