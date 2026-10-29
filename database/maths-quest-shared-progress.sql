-- Shared progress: additive schema, existing AM clients keep working.
alter table public.sessions add column if not exists source text not null default 'activites_mentales';
alter table public.sessions add column if not exists module_key text;
alter table public.sessions add constraint sessions_source_check check (source in ('activites_mentales','maths_quest'));
create or replace view public.vue_dashboard with (security_invoker=true) as
select e.prenom,c.nom as classe,s.exercice,s.score,s.nb_questions,
 round(s.score::numeric/nullif(s.nb_questions,0)::numeric*100) as pourcentage,
 s.duree_totale_ms,s.played_at,s.source,s.module_key
from public.sessions s join public.eleves e on s.eleve_id=e.id join public.classes c on e.classe_id=c.id
order by s.played_at desc;
revoke all on public.vue_dashboard from anon;
grant select on public.vue_dashboard to authenticated;
create or replace function public.save_maths_quest_session(
 p_id uuid,p_module text,p_score integer,p_duration integer,p_answers jsonb,p_played_at timestamptz
) returns uuid language plpgsql security invoker set search_path='' as $fn$
declare pupil uuid; title text; previous public.sessions%rowtype; n integer;
begin
 if auth.uid() is null then raise exception 'Connexion requise' using errcode='42501'; end if;
 select id into pupil from public.eleves where auth_user_id=auth.uid();
 if pupil is null then raise exception 'Compte élève requis' using errcode='42501'; end if;
 title := '{"mult": "Tables de multiplication", "add_rel": "Addition de relatifs", "frac_equiv": "Fractions équivalentes", "conv_long": "Conversions de longueurs", "tableau_prop1": "Tableaux — Niveau 1", "etendue": "Étendue d''une série", "probas_simples": "Probabilités — Niveau 1", "expressions": "Calcul d''expressions", "eq_niv1": "Équations — Niveau 1", "mult10": "Multiplier par 10, 100, 1 000", "mult_rel": "Multiplication de relatifs", "arrondir": "Arrondir au dixième", "carre": "Calculer un carré", "moyenne": "Calcul de moyenne", "conversions2": "Conversions masses, volumes, aires", "angles": "Angles dans un triangle", "tableau_prop2": "Tableaux — Niveau 2", "pct_variation": "Augmentation / diminution en %", "probas_des": "Probabilités — Niveau 2", "reductions": "Réductions d''expressions", "eq_niv2": "Équations — Niveau 2", "eq_niv7": "Équations — Niveau 7"}'::jsonb ->> p_module;
 if p_id is null or title is null or p_score is null or p_score not between 0 and 10 or p_duration is null or p_duration not between 0 and 500000 or p_played_at is null or p_played_at<'2026-10-19T00:00:00Z' or p_played_at>now()+interval '5 minutes' then raise exception 'Série invalide' using errcode='22023'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'Réponses invalides' using errcode='22023'; end if;
 if jsonb_array_length(p_answers)<>10 then raise exception 'Dix réponses requises' using errcode='22023'; end if;
 select count(*) into n from jsonb_array_elements(p_answers) a where a->>'correct'='true';
 if n<>p_score or exists(select 1 from jsonb_array_elements(p_answers) with ordinality as a(v,i) where
   (v->>'numero_question')::integer is distinct from i or jsonb_typeof(v->'correct') is distinct from 'boolean' or
   (v->>'temps_ms')::integer is null or (v->>'temps_ms')::integer not between 0 and 50000 or
   length(v->>'enonce')>3000 or length(v->>'reponse_eleve')>1000) then raise exception 'Réponses incohérentes' using errcode='22023'; end if;
 if (select sum((v->>'temps_ms')::integer) from jsonb_array_elements(p_answers) v)<>p_duration then raise exception 'Durée incohérente' using errcode='22023'; end if;
 insert into public.sessions(id,eleve_id,exercice,score,nb_questions,duree_totale_ms,played_at,source,module_key)
 values(p_id,pupil,title,p_score,10,p_duration,p_played_at,'maths_quest',p_module) on conflict(id) do nothing;
 if not found then
   select * into previous from public.sessions where id=p_id and eleve_id=pupil;
   if previous.id is null or previous.source<>'maths_quest' or previous.module_key is distinct from p_module or previous.score<>p_score or previous.duree_totale_ms<>p_duration or previous.played_at<>p_played_at then raise exception 'Identifiant de série déjà utilisé' using errcode='22023'; end if;
   return p_id;
 end if;
 insert into public.reponses(session_id,numero_question,enonce,reponse_eleve,correct,temps_ms)
 select p_id,(v->>'numero_question')::integer,v->>'enonce',v->>'reponse_eleve',(v->>'correct')::boolean,(v->>'temps_ms')::integer from jsonb_array_elements(p_answers) v;
 return p_id;
end $fn$;
revoke all on function public.save_maths_quest_session(uuid,text,integer,integer,jsonb,timestamptz) from public,anon;
grant execute on function public.save_maths_quest_session(uuid,text,integer,integer,jsonb,timestamptz) to authenticated;
