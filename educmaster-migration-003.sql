-- =========================================================
-- Migration 003 — Autorise la suppression de classes/élèves
-- par la clé qui les possède.
-- =========================================================

-- Suppression d'une classe : seulement si la clé y est liée.
create policy "suppression_classe_par_cle" on classes
  for delete using (
    exists (
      select 1 from enseignants_classes ec
      where ec.classe_id = classes.id
        and ec.cle_acces_id = (auth.jwt() ->> 'cle_acces_id')::uuid
    )
  );

-- Suppression du lien enseignant/classe (nécessaire pour libérer le quota
-- si jamais on supprime le lien sans supprimer la classe elle-même).
create policy "suppression_liaison_par_cle" on enseignants_classes
  for delete using (
    cle_acces_id = (auth.jwt() ->> 'cle_acces_id')::uuid
  );

-- Suppression d'un élève : seulement dans une classe qui appartient à la clé.
create policy "suppression_eleve_par_cle" on eleves
  for delete using (
    exists (
      select 1 from enseignants_classes ec
      where ec.classe_id = eleves.classe_id
        and ec.cle_acces_id = (auth.jwt() ->> 'cle_acces_id')::uuid
    )
  );
