# 💋 XOXO PARTY — Projet XX

Application de gestion de bar temps réel pour soirée privée : carte publique élégante pour les invités, interface tactile iPad pour les barmans, administration complète, suivi de commande par QR code et **notifications push** quand le cocktail est prêt.

**100 % gratuit** : serveur local (Node.js), données en JSON sur ton PC, accès Internet via tunnel Cloudflare gratuit. Aucun compte à créer, aucun abonnement.

---

## ⚡ Démarrage rapide

Prérequis : [Node.js](https://nodejs.org) (version 18 ou +) installé une seule fois.

| Tu veux… | Double-clique sur… |
|---|---|
| Tester / soirée 100 % Wi-Fi local | `start.bat` |
| **La vraie soirée** : accès 4G/5G + notifications push | `start-en-ligne.bat` |

Le premier lancement installe tout automatiquement (2-3 min), les suivants sont instantanés.

**Comptes staff** : les PIN sont définis par l'organisateur dans *Admin → Utilisateurs* (bouton 🔑).
Sur une base **neuve** (première installation ou suppression de `data/db.json`), les codes d'usine sont :
Admin **000000** (6 chiffres) · Barman **0000** (4 chiffres) — à changer aussitôt.

---

## 🌐 TUTO — Rendre le site accessible sans ton Wi-Fi (4G/5G)

Objectif : n'importe quel invité ouvre l'app depuis son téléphone, **sans être sur ton réseau**, et reçoit les notifications push. Durée : ~2 minutes.

### Étape 1 — Lance le mode en ligne
Double-clique sur **`start-en-ligne.bat`** (ou en ligne de commande : `npm run party:online`).

### Étape 2 — Attends l'adresse publique
Dans la fenêtre noire, après quelques secondes :

```
✅ EN LIGNE — accessible partout (4G/5G) :

   https://exemple-mots-aleatoires.trycloudflare.com
```

C'est un tunnel HTTPS **gratuit et sans compte** (Cloudflare) qui pointe vers ton PC. Un QR code s'affiche aussi dans la console.

### Étape 3 — Vérifie depuis un téléphone en 4G
Coupe le Wi-Fi d'un téléphone, scanne le QR (ou tape l'adresse) → la carte des cocktails s'affiche. ✅

### Étape 4 — Diffuse le lien aux invités
- Ouvre **Admin → Réglages** : la carte « Accès des appareils » affiche le badge vert **En ligne** avec le QR de la soirée → imprime-le et pose-le sur le bar.
- Tous les **QR de commande** générés par les barmans utilisent automatiquement cette adresse — rien d'autre à faire.

### Étape 5 — Le soir J, c'est tout
Tant que la fenêtre noire reste ouverte et que ton PC a Internet, tout le monde accède à l'app. Les notifications push partent automatiquement dès qu'un barman passe une commande en **Prête**.

> ⚠️ **À savoir**
> - L'adresse `trycloudflare.com` **change à chaque redémarrage** du serveur → imprime le QR le jour J, après le lancement (Réglages → QR), pas la veille.
> - Ne ferme pas la fenêtre noire pendant la soirée ; désactive la mise en veille du PC (Paramètres Windows → Alimentation).
> - Premier lancement : si le pare-feu Windows demande, clique **Autoriser** (réseaux privés).
> - Pas d'Internet dans la salle ? `start.bat` suffit : tout fonctionne en Wi-Fi local (partage de connexion possible), seules les notifications push sont indisponibles — la page de suivi se met quand même à jour en direct.

---

## 📲 Le parcours invité (commande + notification)

1. L'invité commande au bar : *« Un Cuba Libre s'il te plaît, je m'appelle Lucas »*.
2. Le barman crée la commande (**+ Nouvelle commande**) avec le **prénom (obligatoire)** → un **QR unique** s'affiche instantanément.
3. Lucas scanne → une page web s'ouvre, **rien à installer, rien à saisir** : son téléphone reçoit un **ID unique persistant** qui relie la commande — et sa **fiche invité** est créée/liée automatiquement côté bar.
4. La page est personnalisée (*« Salut Lucas, ta boisson est bientôt prête ! »*) : statut en temps réel (En attente → En préparation → Prête) et file d'attente.
5. Il appuie une fois sur **« Me prévenir quand c'est prêt »** et accepte les notifications. Au premier scan, une invitation « Ajouter à l'écran d'accueil » s'affiche automatiquement : guide pas-à-pas sur iPhone (où c'est indispensable pour le push), installation native en un tap sur Android quand Chrome le propose. Prévisualisable via `/c/<token>?a2hs=ios` ou `?a2hs=android`.
6. Quand le barman glisse la commande en **Prête** : 🔔 *« Salut Lucas, viens le récupérer au bar »* — même téléphone verrouillé, même navigateur fermé.
7. À **Servie**, les points alcool s'ajoutent automatiquement à la fiche de Lucas. Sur la fiche, l'ID du téléphone apparaît en petit (`📱 #a1b2c3d4`) : deux invités portant le même prénom restent bien distincts, et la consommation est contrôlée par personne réelle.
8. Le QR reste accessible sur la carte de commande (icône QR) si l'invité veut re-scanner.

**Cas particulier iPhone** : Apple n'autorise le push web que si la page est ajoutée à l'écran d'accueil (iOS 16.4+). La page l'explique automatiquement aux invités concernés ; sinon la page ouverte se met à jour en direct (avec vibration) — ça marche très bien aussi.

**Android / Chrome** : notification native immédiate, aucune manipulation.

---

## 🖥️ Les interfaces

| URL | Qui | Quoi |
|---|---|---|
| `/` | Invités (public) | Carte des cocktails disponibles, temps d'attente en direct, points alcool, recherche & filtres. 🏆 Easter egg : le bouton discret « Futur champion » tout en bas révèle le(s) cocktail(s) marqués « secret » (ex. Le 2-0) |
| `/c/<token>` | Invité ayant scanné | Suivi de sa commande + notification push |
| `/login` | Staff | Connexion par code PIN (bouton discret « Staff » sur la carte) |
| `/bar` | Barmans (iPad) | **Commandes** (kanban tactile + QR), **Stocks** (temps réel), **Invités** (pense-bête points alcool), **Carte** (masquer des cocktails), **Édition** (créer/modifier cocktails & ingrédients — la suppression reste admin), temps d'attente |
| `/admin` | Administrateur | Tableau de bord & stats, CRUD cocktails/recettes/ingrédients, utilisateurs, réglages, QR d'accès, sauvegarde, réinitialisation |

Tout est synchronisé en temps réel entre tous les appareils (WebSockets). Un cocktail dont un ingrédient s'épuise disparaît automatiquement de la carte publique, avec notification au staff.

---

## 🍸 Points alcool (consommation responsable)

- Chaque cocktail vaut 0 (sans alcool), 1 (léger), 2 (moyen) ou 3 (fort) points.
- 🟢 jusqu'à 3 pts · 🟠 jusqu'à 5 pts · 🔴 6 pts et plus.
- Le pense-bête barman cumule les points par invité (tap sur « Servir »), avec ajustement manuel possible. Purement indicatif : ne bloque jamais une commande.
- **Garde-fou au scan** : quand un invité scanne son QR et que sa fiche est reconnue (ID téléphone), le staff reçoit un avertissement s'il est 🟠 proche de la limite (4-5 pts) ou 🔴 au-dessus (6 pts et +), avec la projection après cette commande. La décision de servir reste au barman.
- Astuce : si une commande porte le prénom d'une fiche invité, ses points s'ajoutent tout seuls quand elle est servie (désactivable dans Réglages).

---

## 💾 Données & sauvegarde

- Tout vit dans `data/db.json` (créé au premier lancement) et les photos dans `uploads/`. Copier ces deux dossiers = sauvegarde complète.
- **Admin → Réglages** : export JSON en un clic, rechargement des stocks, et « Réinitialiser la soirée » (efface commandes + fiches invités de démo, garde cocktails/ingrédients).
- Des données de démonstration (commandes, fiches Léa/Max/Jules) sont incluses pour tester — réinitialise avant le grand soir.

## 🛠️ Scripts npm

```bash
npm run dev          # développement (rechargement à chaud)
npm run dev:online   # développement + tunnel Internet
npm run build        # construit l'interface (dist/)
npm start            # production locale (Wi-Fi)          → start.bat
npm run online       # production + tunnel Internet
npm run party        # build + start
npm run party:online # build + start + tunnel             → start-en-ligne.bat
```

Port : `8787` (modifiable : `set PORT=8788 && npm start`).

## 🚑 Dépannage

| Problème | Solution |
|---|---|
| Les autres appareils ne voient pas le site (Wi-Fi) | Même réseau ? Pare-feu Windows → autoriser Node.js (réseaux privés) |
| « Le port 8787 est déjà utilisé » | Une autre fenêtre du serveur tourne déjà — ferme-la, ou relance simplement `start-en-ligne.bat` (il nettoie les anciennes instances) |
| **Erreur Cloudflare 1033** sur l'adresse publique | Tu utilises une **ancienne URL** : elle change à chaque redémarrage du serveur. Relance `start-en-ligne.bat` et utilise la nouvelle adresse « ✅ EN LIGNE — vérifié » (visible aussi dans *Admin → Réglages*). Le serveur relance le tunnel tout seul s'il tombe, avec une nouvelle URL diffusée en direct |
| « Adresse introuvable » juste après le lancement | Propagation DNS : la nouvelle URL peut mettre 1-2 min à être connue de tous les opérateurs. Réessaie, ou sur ce PC : `ipconfig /flushdns`. Le serveur n'affiche « ✅ EN LIGNE — vérifié » qu'après avoir testé l'adresse lui-même |
| Le tunnel ne démarre pas | Vérifie ta connexion Internet ; relance `start-en-ligne.bat` ; en dernier recours `winget install Cloudflare.cloudflared` |
| Pas de notification reçue | L'invité doit avoir scanné **le lien en ligne** (pas le lien Wi-Fi local) et accepté les notifications ; sur iPhone : ajouter à l'écran d'accueil |
| PIN oublié | Un autre admin peut le changer (Utilisateurs → 🔑). Plus aucun admin ? Supprime `data/db.json` (⚠ remet tout à zéro) |
| Tout remettre à zéro | Arrête le serveur puis supprime `data/db.json` |

## 🏗️ Hébergement alternatif (sans ton PC)

Le tunnel garde tes données chez toi et reste 100 % gratuit — c'est la solution recommandée. Si un jour tu veux un hébergement permanent sans PC allumé : un service Node type Render.com (offre gratuite) fonctionne, mais l'offre gratuite s'endort après 15 min d'inactivité et **perd le fichier `data/db.json` à chaque redémarrage** — il faudrait alors migrer le stockage vers une base externe. Pour une soirée, le tunnel est plus simple et plus sûr.

## ⚙️ Stack technique

Node.js + Express + Socket.IO (temps réel) · React + Vite + Framer Motion · stockage JSON local · uploads d'images (multer) · Web Push (VAPID) + Service Worker · tunnel Cloudflare intégré · QR codes générés côté client et console.
