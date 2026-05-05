# 🧮 Activités Mentales

Application web d'entraînement aux mathématiques pour les élèves du **Lycée Denis Diderot — Belfort**.
26 modules d'activités mentales chronométrées, de la table de multiplication au développement de polynômes, en passant par Pythagore, les fractions et les probabilités.

🔗 **[Lancer l'application](https://offsidealex.github.io/activites-mentales/)** *(remplace par ton URL GitHub Pages)*

---

## ✨ Fonctionnalités

- **26 modules** couvrant les programmes de la 3ème à la Terminale
- **Chronomètre** par question (10 à 50 secondes selon la difficulté)
- **Correction immédiate** avec affichage de la bonne réponse
- **Récapitulatif final** avec score, pourcentage et liste des questions
- **Plusieurs types de réponses** : entiers, décimaux, fractions, expressions algébriques, oui/non
- **Responsive** — fonctionne sur téléphone, tablette et ordinateur
- **Aucune dépendance** — un seul fichier HTML, pas de serveur

---

## 📚 Modules disponibles

### Calcul de base
- ✖️ Tables de multiplication (× 2 à × 9)
- × Multiplier par 10, 100, 1 000

### Nombres relatifs
- ➕ Addition de relatifs
- ✖️ Multiplication de relatifs

### Fractions
- 🔢 Fractions équivalentes
- 🎯 Arrondir au dixième
- ➕ Addition de fractions
- ✖️ Multiplication de fractions

### Stats & mesures
- 📊 Calcul de moyenne
- 📐 Étendue d'une série
- 📏 Conversions de longueurs

### Proportionnalité & pourcentages
- % Pourcentages (proportion)
- % Calculer un pourcentage (arrondi)
- ⚖️ Produit en croix (3 niveaux)

### Probabilités
- 🃏 Probabilités sur un jeu de 32 cartes

### Algèbre
- 🔣 Calcul d'expressions
- ✏️ Réductions d'expressions
- 📐 Développement simple
- 📐 Développement double

### Équations
- ✔️ Vérification d'équation (oui / non)
- 🔢 Résolution d'équations

### Pythagore & racines
- √ Racine carrée
- 📐 Vérifier Pythagore
- 📐 Calculer l'hypoténuse

---

## 🚀 Mise en ligne (GitHub Pages)

1. **Renomme** le fichier en `index.html`
2. **Pousse** sur ton dépôt GitHub
3. Va dans **Settings → Pages**
4. Source : branche `main`, dossier `/ (root)`
5. **Save** — l'URL apparaît en haut de la page après 1–2 minutes

L'application sera accessible à : `https://<ton-pseudo>.github.io/<nom-du-repo>/`

---

## 💻 Utilisation locale

Aucune installation, aucun serveur : double-clique sur `index.html` pour l'ouvrir dans ton navigateur.

---

## 🛠️ Stack technique

- **HTML / CSS / JavaScript** vanilla — aucune librairie
- Polices Google Fonts : `Bebas Neue` (titres) et `Open Sans` (corps)
- Système de design **Lycée Denis Diderot** (`blue-700` primaire, palette Tailwind)
- Compatibilité : tous les navigateurs modernes (Chrome, Firefox, Safari, Edge)

---

## 📝 Personnalisation

Tous les modules sont définis dans l'objet `MODULES` du fichier HTML. Pour ajouter un nouvel exercice :

```js
mon_module:{
  color:'#1d4ed8',                 // couleur d'accent
  icon:'🧮',                       // emoji
  title:'Mon exercice',
  desc:'Description courte',
  tags:['catégorie','⏱ 20s'],
  time:20,                         // temps par question (s)
  ansType:'int',                   // 'int' | 'decimal' | 'fraction' | 'text' | 'yesno'
  gen(){
    const p=[
      {html:'2 + 3', ans:5},
      // …au moins 10 questions
    ];
    shuffle(p);
    return p.slice(0,10);
  }
},
```

---

## 👨‍🏫 Auteur

**Alexis RUIZ** — Professeur de mathématiques, physique-chimie et informatique
🏫 Lycée Denis Diderot, Belfort

---

## 📄 Licence

Libre d'usage pédagogique. Réutilisation et adaptation encouragées dans un cadre scolaire.
