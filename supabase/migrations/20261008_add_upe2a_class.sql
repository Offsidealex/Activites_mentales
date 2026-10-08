-- Ajouter la classe UPE2A sans modifier les classes ni les comptes existants.
insert into public.classes (code, nom)
values ('UPE2A', 'UPE2A')
on conflict (code) do update set nom = excluded.nom;
