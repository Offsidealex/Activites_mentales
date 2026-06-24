# 🧮 Activités Mentales — Lycée Denis Diderot

Application web d'entraînement aux mathématiques pour les élèves du **Lycée Denis Diderot — Belfort** (Académie de Besançon).

🔗 **[Lancer l'application](https://offsidealex.github.io/Activites_mentales/)**
📝 **[Parcours DNB Pro — 50 questions](https://offsidealex.github.io/Activites_mentales/dnb.html)**
📊 **[Dashboard professeur](https://offsidealex.github.io/Activites_mentales/dashboard_prof.html)**

---

## ✨ Fonctionnalités

- **35+ modules** répartis en 11 thèmes, de la table de multiplication au développement double
- **Chronomètre** par question (10 à 50 secondes selon la difficulté)
- **Correction immédiate** avec affichage de la bonne réponse
- **Récapitulatif final** avec score, pourcentage et liste des questions
- **Plusieurs types de réponses** : entiers, décimaux, fractions, expressions algébriques, oui/non
- **Responsive** — fonctionne sur téléphone, tablette et ordinateur
- **Suivi Supabase** — sessions et scores enregistrés par élève
- **Parcours DNB Pro** — 50 automatismes sans chrono, avec corrections détaillées

---

## 📚 Modules disponibles

### Calcul de base
- ✖️ Tables de multiplication (× 2 à × 9)
- × Multiplier par 10, 100, 1 000
- ÷ Diviser par 10, 100, 1 000
- ×10 Notation scientifique
- ?÷ Critères de divisibilité

### Nombres relatifs
- ➕ Addition de relatifs
- ✖️ Multiplication de relatifs

### Fractions
- 🔢 Fractions équivalentes
- 🎯 Arrondir au dixième
- ➕ Addition de fractions
- ✖️ Multiplication de fractions
- ½× Fraction d'un nombre

### Statistiques
- 📊 Calcul de moyenne
- 📐 Étendue d'une série
- M Médiane d'une série

### Mesures & conversions
- 📏 Conversions de longueurs
- ⇄ Conversions masses, volumes, aires
- □ Aires de figures

### Proportionnalité & %
- % Pourcentages (proportion)
- % Pourcentages simples (50 %, 25 %, 10 %, 1 %)
- % Calculer un pourcentage (arrondi)
- ↑% Augmentation / diminution en %
- ⚖️ Produit en croix (3 niveaux)

### Probabilités
- 🎲 Probabilités — Dés (1 ou 2 dés)
- 🃏 Probabilités — 32 cartes

### Algèbre
- 🔣 Calcul d'expressions
- ✏️ Réductions d'expressions
- 📐 Développement simple
- 📐 Développement double

### Équations
- ✔️ Vérification d'équation (oui/non)
- 🔢 Résolution d'équations

### Pythagore & racines
- x² Calculer un carré
- √ Racine carrée
- 📐 Vérifier Pythagore (oui/non)
- 📐 Calculer l'hypoténuse

### Géométrie
- ∠ Angles dans un triangle

---

## 📝 Parcours DNB Pro

Fichier `dnb.html` — 50 questions d'automatismes dans le style de l'épreuve officielle DNB série professionnelle (session 2026), inspiré des sujets zéro publiés par le ministère.

- **Sans chronomètre** — focus sur la compréhension
- **Correction détaillée** après chaque question
- **Bilan par thème** en fin de parcours
- **Login partagé** avec l'application principale via `backend.js`
- 3 formats : QCM, réponse libre, Vrai/Faux
- 9 thèmes couverts : Fractions, Proportionnalité, Pourcentages, Statistiques, Probabilités, Géométrie, Algèbre, Fonctions, Trigonométrie, Conversions, Algorithmique

---

## 🛠️ Stack technique

| Composant | Technologie |
|---|---|
| Frontend | HTML / CSS / JavaScript vanilla |
| Polices | Google Fonts — Bebas Neue + Open Sans |
| Base de données | Supabase (PostgreSQL) |
| Hébergement | GitHub Pages |
| Backend API | `backend.js` — client Supabase léger |

Aucune dépendance npm, aucun bundler — un seul fichier HTML par page.

---

## 🚀 Déploiement

1. Cloner le repo
2. Pousser sur la branche `main`
3. Activer **Settings → Pages → Source : `main` / `root`**
4. L'app est accessible à `https://offsidealex.github.io/Activites_mentales/`

Variables Supabase à configurer dans `backend.js` :
```
SUPABASE_URL      = 'https://xxxx.supabase.co'
SUPABASE_ANON_KEY = 'eyJ...'
```

---

## 📁 Structure des fichiers

```
Activites_mentales/
├── index.html          — Application principale (35+ modules)
├── dnb.html            — Parcours DNB Pro (50 questions)
├── dashboard_prof.html — Dashboard enseignant (Supabase)
├── backend.js          — Client Supabase + gestion sessions
└── README.md
```

---

## 👨‍🏫 Auteur

**Alexis RUIZ** — Professeur de mathématiques, physique-chimie et informatique
🏫 Lycée Denis Diderot, Belfort — Académie de Besançon

---

## 📄 Licence

Libre d'usage pédagogique. Réutilisation et adaptation encouragées dans un cadre scolaire.
[![License: CC BY-NC-ND 4.0](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr)
