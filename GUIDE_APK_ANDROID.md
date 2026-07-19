# ERP ATLAS — Application Android (APK)

Le client React est empaqueté avec **Capacitor** dans une application Android.
L'interface n'a pas été réécrite : l'APK embarque le build React et appelle le
même serveur Vercel. Le site web continue de fonctionner à l'identique.

```
Tablette : APK (React embarqué)  ─┐
                                  ├─→  https://erp-canape-client.vercel.app/api  →  Supabase
Bureau   : navigateur (site web) ─┘
```

---

## 1. Ce qu'il faut déployer sur Vercel AVANT de tester la tablette

Deux fichiers serveur ont changé. **Tant qu'ils ne sont pas en ligne, l'app se
connectera puis se déconnectera en boucle.**

| Fichier | Modification |
|---|---|
| `server/routes/auth.js` | `/login` renvoie le `refreshToken` dans le corps si l'appelant envoie `X-Client: capacitor` ; `/refresh` et `/logout` acceptent le token via cookie **ou** en-tête `X-Refresh-Token` |
| `server/index.js` | CORS : autorise les origines `https://localhost` et `capacitor://localhost` avec credentials, et les en-têtes `X-Client` / `X-Refresh-Token` |

Le comportement navigateur est inchangé : sans l'en-tête `X-Client`, le serveur
répond exactement comme avant (cookie HTTP-only, aucun token dans le corps).

Déploiement :

```bash
git add server/routes/auth.js server/index.js
git commit -m "Auth: support des clients natifs Capacitor"
git push        # Vercel redéploie automatiquement
```

---

## 2. Pourquoi cette modification était indispensable

Sur le web, le refresh token est un **cookie HTTP-only** posé par le serveur.

Dans l'APK, la page est servie depuis l'origine `https://localhost` alors que
l'API est sur `erp-canape-client.vercel.app` : le cookie devient un **cookie
tiers**, qu'Android bloque par défaut. Résultat sans correctif : l'utilisateur
se connecte, puis est éjecté dès que le token d'accès expire (15 min).

L'app native stocke donc elle-même le refresh token dans
**`@capacitor/preferences`** (SharedPreferences Android : privé à l'app, survit
au redémarrage) et le renvoie dans l'en-tête `X-Refresh-Token`.

Fichiers concernés côté client :

- `client/src/native.js` — détection Capacitor + lecture/écriture/effacement du token
- `client/src/api.js` — URL absolue en natif, en-têtes natifs, capture du token
- `client/src/context/AuthContext.jsx` — restauration de session au démarrage, effacement à la déconnexion

La rotation du token est conservée : chaque `/refresh` invalide l'ancien token et
l'app enregistre le nouveau.

---

## 3. Régénérer l'APK après une modification du code

```bash
cd client
npm run sync:android     # build React (mode capacitor) + copie vers Android
cd android
./gradlew assembleDebug
```

APK produit : `client/android/app/build/outputs/apk/debug/app-debug.apk`

> **Important** : utiliser `npm run build:apk` (ou `sync:android`), **jamais**
> `npm run build` seul pour l'APK. Le mode `capacitor` charge
> `client/.env.capacitor`, qui fixe l'URL absolue de l'API. Un build web classique
> laisse `/api` en relatif : l'app chercherait le serveur à l'intérieur du
> téléphone et n'afficherait aucune donnée.

### Via Android Studio (interface graphique)

```bash
cd client
npm run open:android
```

1. Laisser la synchronisation Gradle se terminer (barre de progression en bas).
2. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. Cliquer sur **locate** dans la notification pour ouvrir le dossier de l'APK.

---

## 4. Installer sur la tablette

### Méthode A — Câble USB (recommandée pour tester/itérer)

Sur la tablette : **Paramètres → À propos → appuyer 7 fois sur « Numéro de
build »** pour activer le mode développeur, puis **Options pour les développeurs
→ Débogage USB : activé**.

Brancher la tablette, accepter la demande d'autorisation qui s'affiche dessus, puis :

```bash
cd client/android
"$LOCALAPPDATA/Android/Sdk/platform-tools/adb" devices          # doit lister la tablette
"$LOCALAPPDATA/Android/Sdk/platform-tools/adb" install -r app/build/outputs/apk/debug/app-debug.apk
```

`-r` réinstalle par-dessus la version existante **en conservant la session**.

### Méthode B — Transfert du fichier (aucun câble)

1. Copier `app-debug.apk` sur la tablette (clé USB, Google Drive, WhatsApp, e-mail).
2. Ouvrir le fichier depuis l'application **Fichiers** de la tablette.
3. Android affiche « Installation d'applications inconnues bloquée » →
   **Paramètres** → activer **Autoriser depuis cette source** pour l'app qui
   ouvre le fichier (Fichiers, Chrome, Drive…).
4. Revenir en arrière et confirmer **Installer**.

> Play Protect peut afficher « Application non reconnue » : c'est normal pour un
> APK signé avec la clé de debug. Choisir **Installer quand même**.

---

## 5. Vérifications à faire sur la tablette

| # | Test | Résultat attendu |
|---|---|---|
| 1 | Ouvrir l'app | Écran de connexion ERP ATLAS, icône « A » bleue au lancement |
| 2 | Se connecter avec un compte existant | Accès au tableau de bord |
| 3 | Parcourir Catalogue, Stock, Commandes, Production | Données chargées depuis Vercel |
| 4 | Fermer complètement l'app puis la rouvrir | **Toujours connecté**, pas de retour au login |
| 5 | Laisser l'app ouverte > 15 min puis naviguer | Reste connecté (refresh silencieux) |
| 6 | Se déconnecter, fermer, rouvrir | Écran de connexion (le token a bien été effacé) |
| 7 | Ouvrir le site sur un PC | Fonctionne comme avant, sessions indépendantes |

Le test 4 est le plus important : c'est celui qui échouait sans le correctif
d'authentification.

### Si un écran reste vide

Brancher la tablette en USB et inspecter la WebView depuis le PC : ouvrir Chrome
sur `chrome://inspect`, la tablette apparaît, cliquer **inspect**. La console
affiche les erreurs réseau exactement comme sur le site.

---

## 6. Points à connaître

- **Connexion internet obligatoire.** Les données vivent sur Supabase, rien n'est
  stocké hors ligne. Sans réseau, l'app affiche des écrans vides.
- **APK debug uniquement.** Pour une diffusion large ou le Play Store, il faudra
  un APK signé (`assembleRelease` + keystore). Le keystore doit être conservé : il
  est impossible de mettre à jour une app publiée sans lui.
- **Limite de requêtes.** Le serveur limite à 100 requêtes / 15 min par IP. Si
  plusieurs tablettes partagent le Wi-Fi de l'atelier, elles partagent aussi cette
  IP : la limite peut être atteinte. À surveiller si des erreurs `429` apparaissent
  (`server/middleware/rateLimiter.js`).
- **Permission caméra** déjà déclarée dans le manifeste, prête pour le scan de
  codes QR des étiquettes de production. Il restera à installer un plugin de scan
  et à demander la permission à l'exécution.
- **Icônes** : générées à partir du logo officiel `client/src/assets/logo-atlas.png`
  (celui de l'écran de connexion). Le symbole est isolé automatiquement, sans le
  texte « ERP ATLAS » qui serait illisible à 48 px. Pour les régénérer après un
  changement de logo :

  ```bash
  cd client
  node assets/build-assets.mjs
  npx @capacitor/assets generate --android --iconBackgroundColor "#ffffff" \
      --iconBackgroundColorDark "#ffffff" --splashBackgroundColor "#ffffff" \
      --splashBackgroundColorDark "#ffffff"
  ```
