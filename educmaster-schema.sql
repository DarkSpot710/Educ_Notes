-- =========================================================
-- EducMaster — Schéma de base de données (Supabase / Postgres)
-- =========================================================

-- Extension pour générer des UUID
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- 1. Écoles
-- ---------------------------------------------------------
create table ecoles (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  ville text,
  code_ministere text unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. Clés d'accès (remplace l'auth classique email/mdp)
-- ---------------------------------------------------------
create table cles_acces (
  id uuid primary key default gen_random_uuid(),
  cle_hash text unique not null,          -- sha-256 de la clé en clair, jamais stockée telle quelle
  cle_visible text,                       -- ex: 'EM7K-92LD', gardée uniquement pour affichage admin lors de la génération
  role text not null check (role in ('enseignant', 'directeur')),
  ecole_id uuid not null references ecoles(id) on delete cascade,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_cles_acces_hash on cles_acces(cle_hash);

-- ---------------------------------------------------------
-- 3. Niveaux (CI, CP, CE1, CE2, CM1, CM2)
-- ---------------------------------------------------------
create table niveaux (
  id uuid primary key default gen_random_uuid(),
  nom text unique not null,
  ordre int not null
);

insert into niveaux (nom, ordre) values
  ('CI', 1), ('CP', 2), ('CE1', 3), ('CE2', 4), ('CM1', 5), ('CM2', 6);

-- ---------------------------------------------------------
-- 4. Classes
-- ---------------------------------------------------------
create table classes (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ecoles(id) on delete cascade,
  niveau_id uuid not null references niveaux(id),
  nom text not null,                       -- ex: 'CM2 A'
  annee_scolaire text not null,            -- ex: '2025-2026'
  created_at timestamptz not null default now()
);

create index idx_classes_ecole on classes(ecole_id);

-- ---------------------------------------------------------
-- 5. Liaison enseignant (clé) <-> classes
-- ---------------------------------------------------------
create table enseignants_classes (
  cle_acces_id uuid not null references cles_acces(id) on delete cascade,
  classe_id uuid not null references classes(id) on delete cascade,
  primary key (cle_acces_id, classe_id)
);

-- ---------------------------------------------------------
-- 6. Matières
-- ---------------------------------------------------------
create table matieres (
  id uuid primary key default gen_random_uuid(),
  nom text unique not null,
  bareme_max numeric not null default 20
);

insert into matieres (nom) values
  ('Dictée'), ('Math'), ('Expression écrite'), ('Compréhension de l''écrit'),
  ('EST'), ('ES'), ('EA (Oral)'), ('EA (Dessin/Couture)'), ('EPS');

-- ---------------------------------------------------------
-- 7. Types d'évaluation
-- ---------------------------------------------------------
create table types_evaluation (
  id uuid primary key default gen_random_uuid(),
  nom text unique not null,
  ordre int not null
);

insert into types_evaluation (nom, ordre) values
  ('Évaluation formative 1', 1),
  ('Évaluation formative 2', 2),
  ('Évaluation sommative 1', 3),
  ('Évaluation sommative 2', 4),
  ('Évaluation sommative 3', 5);

-- ---------------------------------------------------------
-- 8. Évaluations autorisées par niveau (gère l'exception du CI)
-- ---------------------------------------------------------
create table niveaux_evaluations (
  niveau_id uuid not null references niveaux(id) on delete cascade,
  type_evaluation_id uuid not null references types_evaluation(id) on delete cascade,
  actif boolean not null default true,
  primary key (niveau_id, type_evaluation_id)
);

-- Toutes les combinaisons niveau x évaluation sont actives par défaut...
insert into niveaux_evaluations (niveau_id, type_evaluation_id, actif)
select n.id, t.id, true
from niveaux n cross join types_evaluation t;

-- ...sauf le CI qui ne fait pas d'évaluations formatives
update niveaux_evaluations
set actif = false
where niveau_id = (select id from niveaux where nom = 'CI')
  and type_evaluation_id in (
    select id from types_evaluation where nom in ('Évaluation formative 1', 'Évaluation formative 2')
  );

-- ---------------------------------------------------------
-- 9. Élèves
-- ---------------------------------------------------------
create table eleves (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references classes(id) on delete cascade,
  matricule text not null,                 -- garder en text pour préserver les zéros initiaux
  nom text not null,
  prenoms text not null,
  created_at timestamptz not null default now(),
  unique (classe_id, matricule)
);

create index idx_eleves_classe on eleves(classe_id);

-- ---------------------------------------------------------
-- 10. Notes
-- ---------------------------------------------------------
create table notes (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references eleves(id) on delete cascade,
  type_evaluation_id uuid not null references types_evaluation(id),
  matiere_id uuid not null references matieres(id),
  note_obtenue numeric,
  cle_acces_id uuid references cles_acces(id),
  updated_at timestamptz not null default now(),
  unique (eleve_id, type_evaluation_id, matiere_id)
);

create index idx_notes_eleve on notes(eleve_id);
create index idx_notes_eval on notes(type_evaluation_id);

-- Empêche une note hors barème (ex: > 20)
alter table notes add constraint chk_note_bornes
  check (note_obtenue is null or (note_obtenue >= 0));

-- ---------------------------------------------------------
-- 11. Row Level Security
-- ---------------------------------------------------------
alter table classes enable row level security;
alter table eleves enable row level security;
alter table notes enable row level security;
alter table enseignants_classes enable row level security;

-- Un enseignant ne voit/modifie que les classes qui lui sont assignées.
-- Un directeur voit toutes les classes de son école.
-- NB: ces policies supposent que la clé active est passée via un claim JWT
-- personnalisé (cle_acces_id) injecté par la fonction Edge de vérification
-- de clé — à adapter selon l'implémentation d'auth retenue.

create policy "acces_classes_par_cle" on classes
  for select using (
    exists (
      select 1 from enseignants_classes ec
      where ec.classe_id = classes.id
        and ec.cle_acces_id = (auth.jwt() ->> 'cle_acces_id')::uuid
    )
    or exists (
      select 1 from cles_acces ca
      where ca.id = (auth.jwt() ->> 'cle_acces_id')::uuid
        and ca.role = 'directeur'
        and ca.ecole_id = classes.ecole_id
    )
  );

create policy "acces_eleves_par_classe" on eleves
  for select using (
    exists (select 1 from classes c where c.id = eleves.classe_id)
  );

create policy "ecriture_notes_par_cle" on notes
  for all using (
    exists (
      select 1 from eleves e
      join enseignants_classes ec on ec.classe_id = e.classe_id
      where e.id = notes.eleve_id
        and ec.cle_acces_id = (auth.jwt() ->> 'cle_acces_id')::uuid
    )
  );
