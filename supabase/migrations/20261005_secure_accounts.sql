-- Comptes élèves liés à Supabase Auth. À exécuter dans le SQL Editor Supabase.
alter table public.eleves add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create table if not exists public.enseignants (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  nom text not null
);

alter table public.enseignants enable row level security;
drop policy if exists "enseignant_read_self" on public.enseignants;
create policy "enseignant_read_self" on public.enseignants
  for select to authenticated using (auth_user_id = auth.uid());

-- Conserve les sessions déjà liées à l'ancienne classe 3PM2026.
update public.classes
set code = '3PM', nom = '3ème PM'
where code = '3PM2026'
  and not exists (select 1 from public.classes where code = '3PM');

insert into public.classes (code, nom) values
  ('3PM', '3ème PM'),
  ('2TNE1', '2TNE1'),
  ('2TNE2', '2TNE2'),
  ('2TNE3', '2TNE3'),
  ('2REMI1', '2REMI1'),
  ('2REMI2', '2REMI2'),
  ('1CAP', '1CAP')
on conflict (code) do update set nom = excluded.nom;

create or replace function public.est_enseignant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.enseignants where auth_user_id = auth.uid());
$$;

grant execute on function public.est_enseignant() to authenticated;

alter table public.classes enable row level security;
alter table public.eleves enable row level security;
alter table public.sessions enable row level security;
alter table public.reponses enable row level security;

drop policy if exists "authenticated_read_classes" on public.classes;
create policy "authenticated_read_classes" on public.classes
  for select to authenticated using (true);

drop policy if exists "eleve_read_self_or_teacher" on public.eleves;
create policy "eleve_read_self_or_teacher" on public.eleves
  for select to authenticated using (auth_user_id = auth.uid() or public.est_enseignant());

drop policy if exists "eleve_update_self_or_teacher" on public.eleves;
drop policy if exists "teacher_update_eleves" on public.eleves;
create policy "teacher_update_eleves" on public.eleves
  for update to authenticated using (public.est_enseignant())
  with check (public.est_enseignant());

drop policy if exists "session_read_owner_or_teacher" on public.sessions;
create policy "session_read_owner_or_teacher" on public.sessions
  for select to authenticated using (
    public.est_enseignant() or exists (
      select 1 from public.eleves where eleves.id = sessions.eleve_id and eleves.auth_user_id = auth.uid()
    )
  );

drop policy if exists "session_insert_owner" on public.sessions;
create policy "session_insert_owner" on public.sessions
  for insert to authenticated with check (
    exists (
      select 1 from public.eleves where eleves.id = sessions.eleve_id and eleves.auth_user_id = auth.uid()
    )
  );

drop policy if exists "reponse_read_owner_or_teacher" on public.reponses;
create policy "reponse_read_owner_or_teacher" on public.reponses
  for select to authenticated using (
    public.est_enseignant() or exists (
      select 1 from public.sessions join public.eleves on eleves.id = sessions.eleve_id
      where sessions.id = reponses.session_id and eleves.auth_user_id = auth.uid()
    )
  );

drop policy if exists "reponse_insert_owner" on public.reponses;
create policy "reponse_insert_owner" on public.reponses
  for insert to authenticated with check (
    exists (
      select 1 from public.sessions join public.eleves on eleves.id = sessions.eleve_id
      where sessions.id = reponses.session_id and eleves.auth_user_id = auth.uid()
    )
  );
