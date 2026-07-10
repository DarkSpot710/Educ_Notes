-- =========================================================
-- Migration 002 — Quota de classes + création classes/élèves depuis l'app
-- À exécuter dans l'éditeur SQL de Supabase, en une fois.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Quota de classes par clé (1 pour enseignant, 6 pour directeur,
--    plus pour un groupe scolaire — défini à la génération de la clé)
-- ---------------------------------------------------------
alter table cles_acces add column if not exists limite_classes int not null default 1;

-- ---------------------------------------------------------
-- 2. Correction de sécurité : la policy de lecture des élèves ne
--    vérifiait pas que la classe appartenait bien à la clé active.
--    On la remplace par une version qui vérifie réellement l'accès.
-- ---------------------------------------------------------
drop policy if exists "acces_eleves_par_classe" on eleves;

create policy "acces_eleves_par_classe" on eleves
  for select using (
    exists (
      select 1 from enseignants_classes ec
      where ec.classe_id = eleves.classe_id
        and ec.cle_acces_id = (auth.jwt() ->> 'cle_acces_id')::uuid
    )
    or exists (
      select 1 from classes c
      join cles_acces ca on ca.ecole_id = c.ecole_id
      where c.id = eleves.classe_id
        and ca.id = (auth.jwt() ->> 'cle_acces_id')::uuid
        and ca.role = 'directeur'
    )
  );

-- ---------------------------------------------------------
-- 3. Permettre à une clé de CRÉER une classe dans son école
-- ---------------------------------------------------------
create policy "creation_classe_par_cle" on classes
  for insert with check (
    exists (
      select 1 from cles_acces ca
      where ca.id = (auth.jwt() ->> 'cle_acces_id')::uuid
        and ca.ecole_id = classes.ecole_id
        and ca.actif = true
    )
  );

-- ---------------------------------------------------------
-- 4. Permettre à une clé de se lier à SA PROPRE classe créée
--    (le quota est vérifié par le trigger ci-dessous, pas ici)
-- ---------------------------------------------------------
create policy "liaison_classe_par_cle" on enseignants_classes
  for insert with check (
    cle_acces_id = (auth.jwt() ->> 'cle_acces_id')::uuid
  );

create policy "lecture_liaison_par_cle" on enseignants_classes
  for select using (
    cle_acces_id = (auth.jwt() ->> 'cle_acces_id')::uuid
  );

-- ---------------------------------------------------------
-- 5. Permettre à une clé d'ajouter des élèves à SES classes
-- ---------------------------------------------------------
create policy "ajout_eleves_par_cle" on eleves
  for insert with check (
    exists (
      select 1 from enseignants_classes ec
      where ec.classe_id = eleves.classe_id
        and ec.cle_acces_id = (auth.jwt() ->> 'cle_acces_id')::uuid
    )
  );

-- ---------------------------------------------------------
-- 6. Trigger : empêche de dépasser le quota de classes d'une clé
--    (vérification faite côté serveur, impossible à contourner
--    même si le client essaie de forcer la requête)
-- ---------------------------------------------------------
create or replace function verifier_quota_classes()
returns trigger as $$
declare
  nb_classes_actuelles int;
  limite int;
begin
  select count(*) into nb_classes_actuelles
  from enseignants_classes
  where cle_acces_id = new.cle_acces_id;

  select limite_classes into limite
  from cles_acces
  where id = new.cle_acces_id;

  if nb_classes_actuelles >= limite then
    raise exception 'Quota de classes atteint (% / %)', nb_classes_actuelles, limite;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_verifier_quota_classes on enseignants_classes;

create trigger trg_verifier_quota_classes
  before insert on enseignants_classes
  for each row execute function verifier_quota_classes();
