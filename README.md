# EducMaster — Prototype de test

## 1. Mise en route de Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) (gratuit).
2. Dans l'éditeur SQL du dashboard, exécute le contenu de `educmaster-schema.sql`
   (fourni séparément) pour créer toutes les tables et les policies RLS.
3. Récupère dans **Project Settings > API** :
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`
   - `JWT Secret` (dans la même page, section JWT Settings) → nécessaire pour la fonction Edge

## 2. Déployer la fonction Edge `verify-cle`

```bash
npm install -g supabase
supabase login
supabase link --project-ref <ton-project-ref>

# Copie le dossier verify-cle/ (fourni séparément) dans supabase/functions/verify-cle/
supabase functions deploy verify-cle

# Configure les secrets nécessaires à la fonction
supabase secrets set SUPABASE_URL=https://xxxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxxx
supabase secrets set SUPABASE_JWT_SECRET=xxxx
```

Note l'URL de la fonction déployée, format :
`https://xxxx.supabase.co/functions/v1/verify-cle` → `VITE_VERIFY_CLE_URL`

## 3. Créer une école de test et une clé

Dans l'éditeur SQL Supabase, crée d'abord une école :

```sql
insert into ecoles (nom, ville) values ('EPP Test', 'Cotonou');
```

Crée une classe :

```sql
insert into classes (ecole_id, niveau_id, nom, annee_scolaire)
select e.id, n.id, 'CM2', '2025-2026'
from ecoles e, niveaux n
where e.nom = 'EPP Test' and n.nom = 'CM2';
```

Ajoute quelques élèves de test :

```sql
insert into eleves (classe_id, matricule, nom, prenoms)
select c.id, '0231', 'Adjovi', 'Falonne' from classes c where c.nom = 'CM2';
```

Puis lance le script `generate-cle.js` (fourni séparément) avec les variables
`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` dans ton environnement :

```bash
node generate-cle.js --role=enseignant --ecole="EPP Test" --classes="CM2"
```

Note la clé affichée (format `XXXX-XXXX`) — c'est celle que tu utiliseras pour te connecter dans l'app.

## 4. Lancer l'app

```bash
cd educmaster-app
cp .env.example .env
# remplis .env avec tes vraies valeurs (URL, anon key, verify-cle URL)
npm install
npm run dev
```

Ouvre l'URL affichée (généralement `http://localhost:5173`), entre la clé générée, et teste :
1. La liste de classes doit apparaître.
2. Ouvre "CM2", sélectionne une évaluation/matière, saisis une note.
3. Couple ton PC en mode avion → la note doit rester affichée avec l'indicateur "en attente".
4. Reconnecte le réseau → elle doit se synchroniser automatiquement (vérifiable dans la table `notes` sur Supabase).
5. Va sur "Voir l'export" → "Télécharger le fichier Excel" → vérifie que le fichier `.xlsx` téléchargé a bien le format ministère (matricule en texte, colonnes Note obtenue/perfectionnement).

## Limites connues de ce prototype (à améliorer ensuite)

- Pas encore d'écran pour le rôle **directeur** (vue multi-classes) — seul le flux enseignant est câblé pour l'instant.
- Pas de calcul automatique de moyenne/rang encore affiché dans l'app (le fichier exporté reste brut, comme le veut le format ministère).
- Pas encore packagé en APK Android (Capacitor) — pour l'instant c'est une PWA testable dans un navigateur mobile.
- La détection réseau (`navigator.onLine`) n'est pas 100% fiable sur tous les appareils Android — à surveiller lors des tests réels.
