# Mise en place de l'authentification

## 1. Appliquer la migration

Dans le SQL Editor du projet Supabase, exécuter `supabase/migrations/20261005_secure_accounts.sql`.

La migration ajoute les classes `3PM`, `2TNE1`, `2TNE2`, `2TNE3`, `2REMI1`, `2REMI2` et `1CAP`, lie chaque élève à un compte Supabase Auth et active les règles d'accès par élève.

Les anciennes règles RLS éventuellement présentes doivent être revues et retirées si elles autorisent encore le rôle `anon` à lire ou modifier les tables `eleves`, `sessions` ou `reponses`.

## 2. Déployer la fonction Edge

Installer la CLI Supabase, se connecter, puis lancer depuis ce dépôt :

```bash
supabase link --project-ref hxfdlujpedxuumqfewvn
supabase functions deploy student-auth
```

La fonction utilise les secrets standard fournis par Supabase : `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. Ne jamais mettre la clé `service_role` dans ce dépôt ou dans une page HTML.

## 3. Créer le compte professeur

1. Dans Supabase, ouvrir **Authentication > Users** et créer le compte e-mail/mot de passe du professeur.
2. Copier son UUID.
3. Exécuter dans le SQL Editor :

```sql
insert into public.enseignants (auth_user_id, nom)
values ('UUID_DU_PROFESSEUR', 'Nom du professeur');
```

Le professeur se connecte ensuite au dashboard avec cet e-mail et ce mot de passe. Il peut réinitialiser le mot de passe d'un élève depuis sa fiche.

## 4. Déployer le site

Pousser les fichiers sur la branche publiée par GitHub Pages. Le bouton bleu **Connexion** de l'accueil permet aux élèves de créer leur compte avec un pseudo, une classe et un mot de passe d'au moins huit caractères.
