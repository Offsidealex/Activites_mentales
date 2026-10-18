# 🧮 Activités mentales

### Des mathématiques pour s'entraîner, progresser et gagner en autonomie

Application pédagogique gratuite et accessible depuis un navigateur, développée pour les élèves du **lycée Denis Diderot de Belfort** (académie de Besançon). Elle propose des exercices courts, des parcours adaptés et un suivi des résultats pour accompagner les apprentissages.

[![Application](https://img.shields.io/badge/Ouvrir-l'application-2563eb?style=for-the-badge)](https://offsidealex.github.io/Activites_mentales/)
[![Parcours UPE2A](https://img.shields.io/badge/Parcours-UPE2A-16a34a?style=for-the-badge)](https://offsidealex.github.io/Activites_mentales/upe2a.html)
[![DNB Pro](https://img.shields.io/badge/R%C3%A9viser-le_DNB_Pro-ea580c?style=for-the-badge)](https://offsidealex.github.io/Activites_mentales/dnb.html)

---

## 🎯 Objectifs pédagogiques

- **S'entraîner régulièrement** grâce à des séries courtes de questions.
- **Différencier les apprentissages** avec plusieurs niveaux de difficulté.
- **Favoriser l'autonomie** par des consignes claires et une correction immédiate.
- **Visualiser les progrès** à travers les scores et l'historique des séances.
- **Accompagner les enseignants** avec un tableau de bord de suivi.

L'application fonctionne sur **ordinateur, tablette et smartphone**, sans installation.

## 📚 Les activités proposées

| Domaine | Exemples d'activités |
|---|---|
| Calcul de base | Tables de multiplication, puissances de 10, divisibilité, notation scientifique |
| Nombres relatifs | Additions, multiplications et exercices progressifs |
| Fractions | Fractions équivalentes, opérations, fraction d'une quantité |
| Statistiques | Moyenne, médiane, étendue |
| Mesures et conversions | Longueurs, masses, volumes, aires |
| Proportionnalité et pourcentages | Pourcentages, évolutions, produit en croix |
| Probabilités | Dés, cartes et situations variées |
| Algèbre | Expressions littérales, réduction, développement |
| Équations | Résolution progressive d'équations |
| Géométrie | Angles, périmètres, aires, échelles |
| Pythagore et racines | Carrés, racines, théorème de Pythagore |

Les activités comprennent notamment des **questions générées aléatoirement** et des niveaux de difficulté croissante. Selon l'exercice, la réponse peut être un nombre entier, un décimal, une fraction, une expression ou un choix.

## 👩‍🎓 Côté élève

- Séries courtes, généralement de **10 questions**.
- Chronomètre adapté à la difficulté selon les exercices.
- Correction et résultat en fin de série.
- Historique des séances et affichage des **cinq meilleurs scores**.
- Enregistrement des résultats pour les élèves connectés.
- **Mode clair / mode sombre** avec mémorisation du choix.

### 📘 Parcours UPE2A — Mathématiques

[Accéder au parcours UPE2A](https://offsidealex.github.io/Activites_mentales/upe2a.html)

Un parcours spécifique pour travailler progressivement les bases : nombres en français, calculs, tables, monnaie, lecture de l'heure, géométrie, mesures et carrés magiques.

### 📝 Parcours DNB série professionnelle

[Accéder aux 50 automatismes DNB Pro](https://offsidealex.github.io/Activites_mentales/dnb.html)

Un entraînement de **50 questions**, sans chronomètre, avec corrections détaillées et bilan final. Il s'inspire des automatismes attendus au DNB série professionnelle ; il ne constitue pas un sujet officiel.

## 👨‍🏫 Côté enseignant

[Ouvrir le tableau de bord professeur](https://offsidealex.github.io/Activites_mentales/dashboard_prof.html)

L'espace professeur permet de :

- Consulter les résultats et les séances enregistrées.
- Filtrer les données par classe, élève et exercice.
- Visualiser les performances et les classements.
- Gérer les classes et les comptes élèves selon les autorisations disponibles.
- Utiliser une interface en mode clair ou sombre.

Les données des comptes connectés sont gérées avec **Supabase**. L'accès aux opérations réservées aux enseignants est contrôlé côté serveur.

## 🧪 Évolutions en cours

Ces fonctionnalités sont **en préparation et ne sont pas encore déployées** :

- Suppression des doublons dans les équations, avec une progression sur **10 niveaux**.
- Accès au parcours UPE2A sans connexion, en mode invité.
- Déblocage du niveau suivant après **80 % de réussite** au niveau précédent dans les activités UPE2A concernées.
- Réglage du seuil de réussite depuis l'interface professeur, à terme par classe ou par parcours.

Ces évolutions sont suivies dans les Pull Requests du dépôt ; leur comportement sera confirmé après tests et fusion.

## 🛠️ Technologies

| Élément | Technologie |
|---|---|
| Interface | HTML, CSS, JavaScript |
| Base de données et authentification | Supabase / PostgreSQL |
| Hébergement | GitHub Pages |
| Gestion du code | GitHub |
| Revue automatisée | CodeRabbit (sur certaines Pull Requests) |

L'application est construite sans framework JavaScript lourd ni étape de compilation obligatoire.

## 🚀 Installation et contribution

Le projet est consultable et modifiable depuis ce dépôt. Pour proposer une amélioration :

1. Créer une branche à partir de `main`.
2. Modifier les fichiers concernés.
3. Ouvrir une Pull Request.
4. Vérifier les changements et les tester avant fusion.

Le déploiement public s'effectue via GitHub Pages. Les clés publiques Supabase ne doivent jamais être confondues avec les clés de service secrètes : **aucune clé `service_role` ne doit être publiée dans le dépôt**.

## 📁 Fichiers principaux

```text
Activites_mentales/
├── index.html            # Activités mentales
├── upe2a.html            # Parcours UPE2A
├── dnb.html              # Automatismes DNB Pro
├── dashboard_prof.html   # Interface professeur
├── prof-classes.js       # Gestion des classes
├── backend.js            # Connexion et suivi Supabase
└── README.md             # Présentation du projet
```

## ✍️ Auteur

**Alexis RUIZ**  
Enseignant en mathématiques et sciences physiques  
**Lycée Denis Diderot — Bavilliers**  
Académie de Besançon

Projet conçu dans un objectif pédagogique, avec une attention particulière à l'entraînement régulier, à la différenciation et à l'autonomie des élèves.

## 📄 Licence

Le dépôt présente une licence [Creative Commons BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr). Consulter les conditions de la licence avant toute réutilisation ou modification diffusée.
