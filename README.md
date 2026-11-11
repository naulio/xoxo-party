# 💋 XOXO PARTY — Projet XX

Application de bar temps réel pour soirée privée : carte en direct, **commandes uniquement via l'app** (borne iPad + téléphone), file d'attente équitable avec **estimation live**, priorité contre pourboire, tableau d'honneur des donateurs, notifications « c'est prêt », interfaces barman et admin, liste de courses chiffrée.

**100 % gratuit** : le site est hébergé sur **GitHub Pages** (lien fixe), le serveur tourne sur ton PC (données, temps réel, notifications) derrière un tunnel Cloudflare gratuit.

🔗 **Lien fixe de la soirée : https://naulio.github.io/xoxo-party/**

---

## ⚡ Le jour J — en 3 gestes

1. **Allume le PC du bar** (connecté à Internet), désactive sa mise en veille.
2. Double-clique **`start-en-ligne.bat`**. Attends `✅ LIEN FIXE PRÊT` (1 à 2 min : le serveur publie sa nouvelle adresse sur GitHub tout seul).
3. Ouvre les écrans :

| Appareil | Adresse | Rôle |
|---|---|---|
| iPad **borne invités** (fixe au bar) | `…/xoxo-party/#/borne` | QR de commande, progression de toutes les commandes, appels « c'est prêt » |
| iPad **barmans** | `…/xoxo-party/#/bar` | File d'attente, service, stocks, invités, carte, édition |
| **Écran donateurs** (TV, vieille tablette) | `…/xoxo-party/#/ecran` | Tableau d'honneur plein écran, rien d'autre |
| **Téléphones des invités** | `https://naulio.github.io/xoxo-party/` | Carte, commande, suivi, notifications |

Les QR imprimés à l'avance restent valables : le lien ne change jamais. Si le PC est éteint, les invités voient « Le bar se prépare… » et la page se connecte toute seule dès que le serveur démarre.

> Première installation sur un autre PC : `npm install`, puis `gh auth login` une fois (compte GitHub), puis `publier-github.bat`.

**Mode sans Internet** : `start.bat` (Wi-Fi local uniquement, sans lien fixe ni notifications).

---

## 📱 Parcours invité — on ne commande pas au comptoir

1. L'invité scanne le **QR de la borne** (il change chaque minute — preuve qu'on est au bar ; le site étant public, personne ne peut commander de chez soi). Pas d'appareil photo ? Le **code à 4 chiffres** affiché sous le QR marche aussi.
2. Il choisit son cocktail, tape son **prénom**, voit **avant de valider** : « prête vers 23:42 · 4 commandes avant toi ».
3. Page de suivi : compte à rebours, position dans la file, notification push quand c'est prêt (et son prénom s'affiche en grand sur la borne).
4. Il peut aussi choisir directement sur la borne (« Choisir sur la borne ») puis valider en scannant.

Règles affichées partout : **une commande en cours par téléphone**, 2 boissons max par commande, premier arrivé premier servi.

**iPhone** : les notifications web exigent d'ajouter le site à l'écran d'accueil (la pop-up l'explique). L'app installée a un stockage séparé de Safari : elle s'ouvre sur la commande en cours et les deux identités sont fusionnées automatiquement (sinon : *Mes commandes* → code de liaison à 4 chiffres). Dans l'app installée, le bouton « Scanner » ouvre un scanner intégré.

---

## ⏱ File d'attente & estimation live

- Ordre **strict d'arrivée**. Seule exception : **💎 priorité contre 2 €** (boîte à tips ou PayPal), **validée par un barman** après vérification.
- Estimation = travail en file ÷ barmans en service, sur un rythme par boisson qui **apprend des vraies durées** (« En préparation » → « Prête »), + marge de confort réglable.
- Onglet **Service** (iPad barman) : nombre de barmans, rythme, marge, **pause express** (5/10/15/30 min, heure de reprise affichée aux invités), file maximale, commandes par téléphone, scan obligatoire, messages sur la borne, dons.
- Les 2 premières cartes de la file (selon le nombre de barmans) sont en surbrillance : « à préparer maintenant ».

## 💎 Dons & tableau d'honneur

L'invité déclare son don depuis sa page de suivi (boîte à tips ou PayPal, anonyme possible) → le barman voit « Don déclaré — vérifié ? » sur la carte de commande → **Reçu** = commande prioritaire + entrée au tableau d'honneur. Un tip sans commande s'ajoute depuis l'onglet Service. L'écran `#/ecran` célèbre chaque nouveau don en plein écran.

## 🖥 Borne iPad invités

Ouvre `#/borne` connecté en barman, puis verrouille l'iPad avec **Accès guidé** (Réglages → Accessibilité → Accès guidé, puis triple-clic sur le bouton latéral) pour que les invités ne quittent pas la page. Sortie du mode borne : appui long (2 s) sur le titre + PIN staff.
Depuis l'iPad barman : messages sur la borne, QR d'une commande manuelle (« Afficher sur la borne »), appel d'un invité (📣), classement des donateurs pendant 20 s.

## 🛒 Liste de courses (admin uniquement)

**Admin → Courses** : liste générée depuis la carte active, pondérée par les ventes réelles des soirées précédentes, arrondie aux **formats vendus en magasin** (combinaison la moins chère), **prix estimés** en marques distributeur. **Total** fixe, **reste à acheter** qui diminue à chaque article coché (synchronisé entre téléphones). Réglages : invités, boissons par invité, marge, déduction du stock restant. Pistes d'économie chiffrées (ex. « retirer tel cocktail = −23 € »). Imprimable.

---

## 🔑 Comptes staff

PIN gérés dans **Admin → Utilisateurs** (bouton 🔑). Sur une base neuve (première installation ou suppression de `data/db.json`), codes d'usine : Admin **000000** · Barman **0000** — à changer aussitôt.

## 💾 Données

- `data/db.json` : toute la soirée (carte, stocks, commandes, invités, dons, réglages). `uploads/` : photos.
- `data/archives/` : soirées passées (la soirée 1 y est archivée intacte ; ses ventes servent à la liste de courses).
- Ces dossiers ne partent **jamais** sur GitHub (seul le code est public).
- Cocktails retirés de la carte : **archivés** (Édition → Archivés → Réactiver), recettes conservées.

## 🛠 Mettre à jour le site

Après une modification du code : `npm run deploy` (reconstruit et republie GitHub Pages en conservant l'adresse du serveur), puis `git push`.

```bash
npm run dev          # développement local (rechargement à chaud)
npm run deploy       # publie le site sur GitHub Pages
npm run online       # serveur + tunnel + lien fixe   → start-en-ligne.bat
npm start            # serveur Wi-Fi local seulement   → start.bat
```

## 🚑 Dépannage

| Problème | Solution |
|---|---|
| Les invités voient « Le bar se prépare… » | Le serveur n'est pas lancé ou vient de démarrer : attends `✅ LIEN FIXE PRÊT` dans la fenêtre noire |
| `Lien fixe non mis à jour` | `gh auth login` (session GitHub expirée), puis relance `start-en-ligne.bat`. En attendant, l'adresse du tunnel affichée marche |
| « Scanne le QR de la borne » alors qu'on est au bar | QR expiré (il change chaque minute) : rescanner, ou taper le code à 4 chiffres. En dépannage : Service → décocher « Scan de la borne obligatoire » |
| Pas de notification | iPhone : ajouter à l'écran d'accueil et ouvrir depuis l'icône. Tester avec « 🔔 Tester la notification » sur la page de suivi |
| « Le port 8787 est déjà utilisé » | Relance simplement `start-en-ligne.bat` (il ferme les anciennes instances) |
| PIN oublié | Un autre admin le change (Utilisateurs → 🔑) |

## ⚙️ Stack

Node.js + Express + Socket.IO · React + Vite + Framer Motion · stockage JSON local · Web Push (VAPID) + Service Worker · tunnel Cloudflare · GitHub Pages (site statique, routage par ancre) avec pointeur `api.json` mis à jour par le serveur · jsQR (scanner intégré).
