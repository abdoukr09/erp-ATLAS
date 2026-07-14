# 📘 Guide Complet — ERP ATLAS (LE CANAPÉ)

> Manuel de référence complet : à quoi sert l'ERP, comment fonctionne l'usine, et tout ce qu'il faut savoir pour l'utiliser et le comprendre.
>
> **Type d'activité** : Usine de fabrication de canapés / meubles rembourrés (Algérie 🇩🇿)
> **Monnaie** : DA (Dinar Algérien)
> **Nom technique** : `erp-canape` — Nom affiché : **ERP ATLAS**

---

## Table des matières

1. [Qu'est-ce que cet ERP ?](#1-quest-ce-que-cet-erp-)
2. [Vue d'ensemble : comment marche l'usine](#2-vue-densemble--comment-marche-lusine)
3. [Stack technique](#3-stack-technique)
4. [Les rôles et permissions](#4-les-rôles-et-permissions)
5. [Les 15 modules de l'application](#5-les-15-modules-de-lapplication)
6. [Le cycle de vie complet d'une commande (le cœur du système)](#6-le-cycle-de-vie-complet-dune-commande)
7. [Détail de chaque module](#7-détail-de-chaque-module)
8. [Concepts clés à maîtriser](#8-concepts-clés-à-maîtriser)
9. [Les statuts (cycle de vie)](#9-les-statuts--cycle-de-vie)
10. [La logique financière et la paie](#10-la-logique-financière-et-la-paie)
11. [Sécurité](#11-sécurité)
12. [Installation et démarrage](#12-installation-et-démarrage)
13. [Structure des fichiers du projet](#13-structure-des-fichiers-du-projet)
14. [Points d'attention et particularités](#14-points-dattention-et-particularités)

---

## 1. Qu'est-ce que cet ERP ?

**ERP ATLAS** est un logiciel de gestion complet (ERP = *Enterprise Resource Planning*) conçu sur mesure pour **une usine de fabrication de canapés**. Il pilote toute la chaîne de valeur de l'entreprise, du **client** jusqu'à la **livraison** et la **paie des ouvriers**.

Il couvre **6 grands domaines** :

| Domaine | Ce qu'il gère |
|---|---|
| 🛒 **Commercial** | Clients, commandes, catalogue de modèles, paiements |
| 🏭 **Production** | Fabrication des canapés, assignation des ouvriers, suivi des tâches |
| 📦 **Stock** | Matières premières (bois, mousse, tissu…) + produits finis + multi-emplacements |
| 🚚 **Logistique** | Livraisons clients, transferts internes entre dépôts/showrooms |
| 💰 **Finances** | Encaissements, dépenses, calcul du profit réel |
| 👷 **RH / Paie** | Personnel, commissions, primes, salaires |

**L'idée centrale** : chaque canapé vendu déclenche automatiquement une chaîne d'événements — réservation des matières, fabrication, déduction du stock, livraison, encaissement et calcul des commissions — le tout tracé et synchronisé.

---

## 2. Vue d'ensemble : comment marche l'usine

Voici le **parcours physique et informatique** d'un canapé, de la vente à la livraison :

```
   CLIENT                                                          
     │                                                            
     ▼                                                            
┌─────────────┐   Le vendeur enregistre une COMMANDE             
│  COMMANDE   │   (1 ou plusieurs articles / modèles de canapé)  
└─────┬───────┘   → Avance encaissée (optionnel)                 
      │           → Matières RÉSERVÉES automatiquement (selon la nomenclature)
      │                                                          
      ├──── Option A : le modèle est DÉJÀ en stock fini ────► on prend du stock
      │                                                          
      ▼ Option B : il faut le fabriquer                          
┌─────────────┐   L'atelier lance une FICHE DE FABRICATION       
│ FABRICATION │   (1 fiche = 1 unité de canapé)                  
└─────┬───────┘   → Ouvriers assignés PAR TYPE DE TÂCHE          
      │             (menuiserie, couture, tapisserie…)           
      │           → Au démarrage : matières DÉDUITES du stock    
      │           → À la fin : article "PRÊT"                    
      ▼                                                          
┌─────────────┐   Le produit fini rejoint le STOCK              
│    STOCK    │   → Usine (central) ou un EMPLACEMENT (showroom/dépôt)
└─────┬───────┘                                                  
      │                                                          
      ▼                                                          
┌─────────────┐   Le chauffeur planifie une LIVRAISON            
│  LIVRAISON  │   (peut regrouper plusieurs commandes)           
└─────┬───────┘   → À la confirmation : stock déduit,            
      │             PAIEMENT FINAL encaissé automatiquement,     
      │             commande "LIVRÉE"                            
      ▼                                                          
   ENCAISSEMENT + COMMISSIONS (vendeur, ouvriers, chauffeur)     
```

**Deux flux de stock coexistent** :
- **Matières premières** (bois, mousse, tissu, pieds, vis…) → consommées par la fabrication.
- **Produits finis** (canapés terminés) → répartis entre l'**Usine** et les **emplacements** (showrooms, dépôts).

---

## 3. Stack technique

### Backend (serveur — dossier `server/`)
- **Node.js + Express** — serveur d'API REST
- **Sequelize (ORM)** — accès à la base de données
- **PostgreSQL** — base de données (hébergée sur **Supabase** en production)
- **JWT** — authentification (token d'accès 15 min + refresh token 7 jours en cookie HTTP-only)
- **bcryptjs** — chiffrement des mots de passe
- **Helmet, CORS, Rate Limiting** — sécurité
- **Journal d'audit automatique** (AuditLog) — trace les modifications

### Frontend (client — dossier `client/`)
- **React 18 + Vite** — interface utilisateur
- **React Router** — navigation (chargement paresseux / *lazy loading* des pages)
- **Axios** — appels API (avec rafraîchissement automatique du token)
- **lucide-react** — icônes
- **Thème clair / sombre** — basculable, sauvegardé dans le navigateur
- Interface **100 % en français**

### Déploiement
- **Vercel** (serverless) pour l'hébergement + **Supabase** (Postgres) pour la base.
- Fonctionne aussi en **local** (PostgreSQL sur la machine).

---

## 4. Les rôles et permissions

Il existe **5 rôles**. Le système utilise une **hiérarchie** : un rôle supérieur hérite automatiquement des droits des rôles inférieurs.

```
admin  ►  gérant  ►  { sales, production, delivery }
```

| Rôle | Nom FR | Ce qu'il peut faire |
|---|---|---|
| **admin** | Administrateur | **Accès total** (« god mode ») : tout, y compris utilisateurs, tarifs, rapports, primes |
| **gerant** | Gérant | Presque tout (commercial + production + livraison), **sauf** les réglages réservés admin |
| **sales** | Vendeur / Commercial | Clients, commandes, finances, catalogue, stock fini |
| **production** | Production / Atelier | Fabrication, matières premières, catalogue, commandes (lecture), personnel |
| **delivery** | Livreur / Chauffeur | Livraisons, stock produits finis |

### Qui voit quel menu ?

| Module | admin | gérant | sales | production | delivery |
|---|:---:|:---:|:---:|:---:|:---:|
| Tableau de bord | ✅ | ✅ | ✅ | | |
| Catalogue | ✅ | ✅ | ✅ | ✅ | |
| Clients | ✅ | ✅ | ✅ | | |
| Commandes | ✅ | ✅ | ✅ | ✅ | |
| Finances | ✅ | ✅ | ✅ | | |
| Matières Premières | ✅ | ✅ | | ✅ | |
| Stock Produits Finis | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fabrication | ✅ | ✅ | | ✅ | |
| Livraisons | ✅ | ✅ | | | ✅ |
| Personnel & Paie | ✅ | ✅ | | ✅* | |
| Types d'Ouvriers | ✅ | | | | |
| Rapport Journalier | ✅ | | | | |
| Tarifs & Coûts | ✅ | | | | |
| Primes de Livraison | ✅ | | | | |
| Utilisateurs | ✅ | | | | |

> \* Le rôle *production* peut accéder au personnel via l'API, mais le menu ne l'affiche que pour admin/gérant.

**Filtrage des données sensibles** : un *vendeur* voit les commandes mais **pas** le chiffre d'affaires global ni les alertes de stock (les montants financiers globaux sont masqués côté serveur). Le rôle *production* voit les commandes **sans les prix**.

---

## 5. Les 15 modules de l'application

| # | Module (menu) | Route | Rôle du module |
|---|---|---|---|
| 1 | **Tableau de bord** | `/` | Vue d'ensemble : KPIs, revenus, commandes récentes, alertes |
| 2 | **Catalogue** | `/catalog` | Modèles de canapés, nomenclatures (BOM), packs |
| 3 | **Clients** | `/customers` | Fiches clients |
| 4 | **Commandes** | `/orders` | Prise et suivi des commandes |
| 5 | **Finances** | `/finance` | Paiements et encaissements |
| 6 | **Matières Premières** | `/inventory` | Stock des matières (bois, mousse…) |
| 7 | **Stock (Produits Finis)** | `/finished-products` | Canapés finis + emplacements + transferts |
| 8 | **Fabrication** | `/production` | Fiches de production, ouvriers |
| 9 | **Livraisons** | `/deliveries` | Bons de livraison + transferts internes |
| 10 | **Personnel & Paie** | `/employees` | Employés, performance, versements |
| 11 | **Types d'Ouvriers** | `/worker-types` | Métiers + tarifs par modèle |
| 12 | **Rapport Journalier** | `/reports` | Activité complète d'une journée |
| 13 | **Tarifs & Coûts** | `/tariffs` | Dépenses + calcul du profit réel |
| 14 | **Primes de Livraison** | `/delivery-primes` | Prime par trajet (chauffeurs) |
| 15 | **Utilisateurs** | `/users` | Comptes de connexion |

---

## 6. Le cycle de vie complet d'une commande

C'est **le cœur du système**. Voici chaque étape en détail.

### Étape 1 — Création de la commande (module Commandes)
Le vendeur sélectionne un **client** (ou en crée un à la volée) et ajoute un ou plusieurs **articles**. Chaque article comporte :
- **Modèle** de canapé (issu du catalogue)
- **Quantité**, **prix unitaire**, **remise %**
- **Tissu** et **couleur**

Il peut aussi renseigner : adresse et **wilaya** de livraison, remise globale, **prix total personnalisé** (override manuel), **avance** encaissée, méthode de paiement, et **un ou plusieurs vendeurs** avec un pourcentage de partage de commission.

**Ce que le système fait automatiquement à la création** :
1. Calcule le **prix total** (somme des articles − remises), ou applique le prix personnalisé.
2. Calcule l'**avance** et le **restant à payer** ; définit le statut de paiement (`unpaid` / `advance_paid` / `fully_paid`).
3. **Deux cas par article** :
   - **Si « Utiliser le stock » est coché ET que le modèle a assez de stock fini** → le stock est décrémenté, l'article passe directement à **`ready`** (prêt), et une fiche de production « fictive » (déjà terminée) est créée pour la traçabilité.
   - **Sinon** → le système lit la **nomenclature (BOM)** du modèle et crée des **réservations de matières** (statut `reserved`). ⚠️ Les matières ne sont **pas encore déduites** — elles sont juste réservées. Un **avertissement** s'affiche si le stock disponible est insuffisant.
4. Enregistre l'**avance** comme un paiement (type `advance`).
5. Statut de la commande : **`pending`** (en attente).

### Étape 2 — Lancement de la fabrication (module Fabrication)
Pour un article `pending`, l'atelier crée une **fiche de fabrication**.
- **1 fiche = 1 unité** de canapé. Si l'article a une quantité de 3, le système crée 3 fiches.
- On assigne les **ouvriers par type de tâche** (ex. Menuiserie, Couture, Tapisserie). Pour un **pack**, on peut assigner des ouvriers **par composant** du pack.
- Le tarif de commission de chaque ouvrier est **récupéré automatiquement** depuis les *Types d'Ouvriers* (tarif défini pour ce métier × ce modèle).
- L'article passe à **`in_production`**, la commande passe à **`in_production`**.

**Déduction des matières** : dès que la fiche passe à **`in_progress`** ou **`completed`**, les matières premières sont **réellement déduites** du stock (le champ `materialsDeducted` passe à vrai) et les réservations passent de `reserved` à `deducted`.
> 💡 Le stock des matières **peut devenir négatif** — c'est voulu, pour ne jamais bloquer la production dans un contexte d'usine réel.

**Fin de fabrication** : quand la fiche passe à **`completed`**, le système enregistre l'heure de fin. Quand **toutes** les fiches d'un article sont terminées → l'article devient **`ready`**. Quand **tous** les articles d'une commande sont prêts → la commande devient **`ready`**.

**Fabrication pour stock** (sans commande) : on peut aussi fabriquer un modèle « pour le stock », en choisissant une **destination** (Usine ou un emplacement précis). À la fin, le stock du modèle augmente (+1) et le stock de l'emplacement aussi.

### Étape 3 — Le produit fini entre en stock (module Stock Produits Finis)
Le canapé terminé est disponible :
- soit à l'**Usine** (stock central),
- soit dans un **emplacement** (showroom, dépôt) si la fabrication y était destinée.

On peut faire des **déplacements rapides** entre emplacements (voir §8).

### Étape 4 — La livraison (module Livraisons)
Un chauffeur crée une **livraison** :
- **Type `order`** (livraison client) : peut **regrouper plusieurs commandes** en un seul trajet, avec un chauffeur et une source (emplacement d'où part la marchandise).
- **Type `transfer`** (transfert interne) : déplace des produits d'un emplacement à un autre.

**Confirmation de livraison** — l'opération clé. Le chauffeur confirme le résultat **unité par unité** :
- **Livré** → le stock du produit est déduit, un **paiement final automatique** est créé (le restant dû), la commande passe **`delivered`** + **`fully_paid`**.
- **Problème** (refus/défaut) → une **nouvelle fiche de production** (`pending`) est créée automatiquement (retour SAV / réparation), l'article passe en **`problem`**.
- **Annulé** → l'article est annulé.
- Si les résultats sont **mixtes** (ex. 2 livrés + 1 problème), l'article est automatiquement **scindé** en plusieurs lignes avec les bons statuts. La commande peut alors devenir `partially_delivered`.

Le trajet est toujours marqué `delivered` à la fin pour que le chauffeur **touche sa prime**.

### Étape 5 — Encaissement et commissions
- **Le paiement final** est généré automatiquement à la livraison (voir §10).
- **Les commissions** (vendeur, ouvriers, chauffeur) sont calculées et versées mensuellement via le module Personnel & Paie.

---

## 7. Détail de chaque module

### 7.1 — Tableau de bord (`/`)
Vue de synthèse pour la direction et les vendeurs. Affiche :
- **Compteurs de commandes** par statut (en attente, en production, prêtes, livrées).
- **Revenus** : total, avances, paiements finaux, revenu du jour *(masqués pour les vendeurs)*.
- **Matières en rupture** (stock ≤ seuil minimum).
- **Productions actives** (en cours), **livraisons en attente**.
- **Commandes récentes**, **revenu mensuel** (6 derniers mois), répartition des statuts.

### 7.2 — Catalogue (`/catalog`)
Gère les **modèles de produits** (`ProductModel`). Chaque modèle a : nom (unique), catégorie (défaut « Sofa »), description, **prix de base**, indicateur **pack**, et stock fini.

Trois choses fondamentales s'y définissent :
1. **La nomenclature (BOM)** : la liste des matières + quantités nécessaires pour fabriquer 1 unité (ex. 2 planches de bois + 3 m² tissu + 1 kg mousse).
2. **Les packs** : un modèle « pack » est un **ensemble** de plusieurs produits (ex. « Salon 3+2+1 »). Le BOM du pack est **recalculé automatiquement** = somme des BOM de ses composants × quantités.
3. **La capacité de production** (`maxProducible`) : le système calcule combien d'unités on peut fabriquer avec le stock de matières actuel (le composant le plus limitant fixe le maximum).

### 7.3 — Clients (`/customers`)
Fiches clients : nom, téléphone, email, adresse, ville, notes. Suppression logique (`isDeleted`). Un client peut avoir plusieurs commandes. On peut créer un client **rapidement** depuis l'écran de commande.

### 7.4 — Commandes (`/orders`)
Prise de commande multi-articles (voir §6, Étape 1). Fonctions clés :
- Plusieurs articles par commande, chacun avec modèle/qté/prix/remise/tissu/couleur.
- **Plusieurs vendeurs** avec partage de commission (%).
- **Prix total personnalisé** (override).
- **Avance** à la commande.
- Choix de la **wilaya** (les 58 wilayas d'Algérie sont intégrées).
- Option **« utiliser le stock »** pour puiser dans les produits finis.
- La modification et la suppression **réajustent automatiquement** le stock, les matières, les paiements et les productions liées (avec restitution du stock si annulation).

### 7.5 — Finances (`/finance`)
Liste et gestion des **paiements**. On peut ajouter des paiements de type **`advance`** (avance) ou **`other`** (autre).
> ⚠️ Le type **`final`** est **réservé au système** — il est créé automatiquement à la livraison et ne peut pas être saisi manuellement.

Chaque paiement re-synchronise le statut de paiement de la commande. Méthodes : espèces, virement, chèque, carte. Le chiffre d'affaires total n'est visible que par l'admin.

### 7.6 — Matières Premières (`/inventory`)
Stock des matières (`Material`). Catégories : **wood** (bois), **foam** (mousse), **fabric** (tissu), **legs** (pieds), **screws** (vis), **leather** (cuir), **sponge** (éponge), **other**. Chaque matière : stock, unité, **seuil minimum** (déclenche l'alerte de rupture), prix unitaire, fournisseur. Le prix sert au calcul du coût de revient.

### 7.7 — Stock (Produits Finis) (`/finished-products`)
Trois onglets :
1. **Vue Générale & Catalogue** : commandes prêtes à livrer + stock de chaque modèle (total entreprise / dont à l'Usine / capacité de production).
2. **Par Emplacement** : répartition du stock entre l'Usine et chaque emplacement (showroom/dépôt), avec **déplacement rapide** entre emplacements.
3. **Gestion des Emplacements** : créer/modifier/supprimer des emplacements (nom + couleur d'identification).

> Le **stock Usine** = stock global du modèle − somme des stocks dans les emplacements.

### 7.8 — Fabrication (`/production`)
Le pilotage de l'atelier (voir §6, Étape 2). Chaque fiche affiche : cible (commande ou stock), client, modèle, **horaires** (début/fin auto-horodatés), **ouvriers regroupés par type de tâche**, statut. On peut lancer une fabrication **liée à une commande** ou **pour le stock**.

### 7.9 — Livraisons (`/deliveries`)
Bons de livraison + transferts internes (voir §6, Étape 4). Gère les livraisons multi-commandes, l'affectation du chauffeur, la source, et la **confirmation détaillée** unité par unité (livré / problème / annulé).

### 7.10 — Personnel & Paie (`/employees`)
Gestion des employés (`Employee`) : nom, **catégorie** (Ouvrier, Vendeur, Chauffeur…), salaire de base, coût d'assurance, taux de commission (vendeurs).

Pour chaque employé, un panneau de **performance mensuelle** affiche :
- **Ouvriers** : les productions terminées + commission calculée selon les tarifs.
- **Vendeurs** : les ventes + commission (% sur le volume, ajusté au partage).
- **Chauffeurs** : les livraisons + primes par trajet.

Puis on **verse la paie** : Salaire de base + Prime (calculée automatiquement, modifiable manuellement) = Total à verser. Chaque versement est historisé (`EmployeePayment`).

### 7.11 — Types d'Ouvriers (`/worker-types`) *(admin)*
Définit les **métiers de l'atelier** (`WorkerType`, ex. Menuiserie, Couture, Tapisserie) et surtout les **tarifs** : pour chaque couple **(métier × modèle)**, un montant **fixe** (DA/unité) ou un **pourcentage**. C'est la base du calcul automatique des commissions ouvriers en fabrication.

### 7.12 — Rapport Journalier (`/reports`) *(admin)*
Photo complète d'une journée donnée : productions créées/terminées, paies versées, commandes créées/modifiées, paiements clients reçus, livraisons, et le **journal d'audit** (qui a modifié quoi). Idéal pour le contrôle quotidien.

### 7.13 — Tarifs & Coûts (`/tariffs`) *(admin)*
Deux fonctions :
1. **Dépenses** (`Expense`) : charges de l'entreprise (loyer, électricité…) avec fréquence (quotidienne/mensuelle/annuelle).
2. **Calcul du profit réel** :
   ```
   Profit Net = Revenus encaissés
              − Coût des matières (des commandes livrées)
              − Dépenses
              − Salaires/primes réellement versés
   ```

### 7.14 — Primes de Livraison (`/delivery-primes`) *(admin)*
Définit la **prime du chauffeur par trajet** (`DeliveryRoutePrime`) : de la source (Usine ou emplacement) vers une **wilaya** (livraison client) ou un autre **emplacement** (transfert). Ces primes alimentent automatiquement le calcul de paie des chauffeurs.

### 7.15 — Utilisateurs (`/users`) *(admin)*
Gestion des **comptes de connexion** (`User`) : nom d'utilisateur, mot de passe (chiffré), nom complet, **rôle**, actif/inactif. À distinguer des **Employés** (voir §14).

---

## 8. Concepts clés à maîtriser

### 🧾 La nomenclature (BOM — *Bill of Materials*)
La « recette » d'un modèle : quelles matières et en quelles quantités pour fabriquer 1 unité. Table `ModelMaterial` (modèle ↔ matière ↔ quantité). C'est ce qui permet de **réserver** puis **déduire** les matières automatiquement.

### 📦 Les packs
Un modèle peut être un **pack** = plusieurs produits vendus ensemble (ex. « Salon 3+2+1 »). Son BOM est la **somme** des BOM de ses composants. En fabrication, un pack se **décompose** en ses composants, et on peut assigner des ouvriers à chaque composant.

### 🔒 Réservation vs déduction des matières
- **Réservation** (à la commande) : les matières sont *bloquées* (statut `reserved`) mais restent physiquement en stock. Le « disponible réel » = stock − réservations.
- **Déduction** (au lancement de fabrication) : les matières sont *réellement retirées* du stock (statut `deducted`).

Ce mécanisme évite de survendre les matières tout en gardant le stock physique juste jusqu'au dernier moment.

### 🏭 Stock multi-emplacements
- **Stock global** d'un modèle (`ProductModel.stock`) = total dans toute l'entreprise.
- **Stock par emplacement** (`LocationStock`) = ce qu'il y a dans un showroom/dépôt précis.
- **Stock Usine** = stock global − somme des emplacements.
- Un **transfert interne** déplace le stock entre emplacements **sans changer le stock global** (la marchandise reste dans l'entreprise). Il est tracé comme une « livraison » de type transfert.

### 💸 Trois systèmes de commission
| Bénéficiaire | Base de calcul | Où se règle |
|---|---|---|
| **Ouvrier** | Tarif (métier × modèle), fixe ou % | Types d'Ouvriers |
| **Vendeur** | % (taux de l'employé) sur le volume de ses ventes, ajusté au partage | Fiche employé |
| **Chauffeur** | Prime par trajet (source → destination) | Primes de Livraison |

### 📝 Journal d'audit automatique
Toute modification ou suppression sur 9 entités sensibles (Commande, Paiement, Client, Modèle, Matière, Employé, Production, Livraison, Dépense) est **enregistrée automatiquement** (ancienne valeur → nouvelle valeur) dans `AuditLog`, sans intervention. Consultable dans le Rapport Journalier.

---

## 9. Les statuts — cycle de vie

### Commande (`Order.status`)
`pending` (en attente) → `in_production` (en fabrication) → `ready` (prête) → `delivered` (livrée)
États spéciaux : `cancelled` (annulée), `problem` (problème/retour), `partially_delivered` (partiellement livrée).

### Article de commande (`OrderItem.status`)
`pending` → `in_production` → `ready` → `delivered` — + `cancelled`, `problem`.

### Fabrication (`Production`)
- **Statut** : `pending` (en attente) → `in_progress` (en cours) → `completed` (terminé).
- **Étape** (`stage`) : `fabrication`, `cutting` (découpe), `foam` (mousse), `upholstery` (tapisserie), `assembly` (assemblage), `finishing` (finition), `quality_check` (contrôle qualité).

### Livraison (`Delivery`)
- **Statut** : `scheduled` (planifiée) → `in_transit` (en route) → `delivered` (livrée) — + `failed` (échouée), `cancelled` (annulée).
- **Type** : `order` (client) ou `transfer` (interne).

### Paiement (`Payment`)
- **Statut** : `pending`, `completed`, `refunded`.
- **Type** : `advance` (avance), `final` (final — automatique à la livraison), `other` (autre).
- **Méthode** : `cash` (espèces), `bank_transfer` (virement), `check` (chèque), `card` (carte).

### Statut de paiement d'une commande (`paymentStatus`)
`unpaid` (impayé) → `advance_paid` (avance versée) → `fully_paid` (soldé).

---

## 10. La logique financière et la paie

### Flux d'argent d'une commande
1. **À la commande** : une **avance** (`advance`) peut être encaissée.
2. **Pendant** : on peut ajouter des paiements `other` (acomptes supplémentaires).
3. **À la livraison** : le système calcule le **restant dû** = prix total − total déjà payé, et crée automatiquement un paiement **`final`**. La commande devient **`fully_paid`**.
4. Toute création/modification/suppression de paiement **re-synchronise** l'avance, le restant et le statut de la commande.

> ⚠️ Si une commande livrée est **annulée** ou repasse en arrière, le paiement `final` est automatiquement supprimé et le stock restitué.

### Calcul du profit réel (Tarifs & Coûts)
```
Profit Net = Σ paiements encaissés (completed)
           − Σ coût matières des commandes LIVRÉES (BOM × prix matière × quantité)
           − Σ dépenses
           − Σ salaires et primes RÉELLEMENT versés
```
> Les salaires de base « déclarés » ne sont comptés que lorsqu'ils sont **effectivement versés** (via un `EmployeePayment`).

### La paie mensuelle
Pour chaque employé, on choisit un **mois**, on visualise sa **performance** (production / ventes / livraisons + commission calculée), puis on **verse** : `Salaire de base + Prime`. Le montant de la prime est **pré-rempli automatiquement** mais reste modifiable.

---

## 11. Sécurité

- **Authentification JWT** : token d'accès court (15 min) + **refresh token** (7 jours) stocké en **cookie HTTP-only** (inaccessible au JavaScript), avec **rotation** à chaque rafraîchissement.
- **Mots de passe** chiffrés (bcrypt).
- **Protection anti-force brute** : blocage du compte 15 min après 10 tentatives échouées.
- **Rate limiting** : limites de requêtes par IP (global + limites strictes sur login, commandes, paiements, production).
- **RBAC hiérarchique** : contrôle des accès par rôle (voir §4).
- **Helmet** (en-têtes de sécurité), **CORS** restreint, **sanitization** des entrées (anti-injection), **cache désactivé** sur l'API (pas de fuite de prix/salaires dans le cache navigateur).
- **Journal d'audit** automatique.
- **Rafraîchissement transparent** du token côté client : si le token expire, l'app le renouvelle sans déconnecter l'utilisateur.

---

## 12. Installation et démarrage

### Prérequis
- Node.js
- PostgreSQL (local) **ou** un accès Supabase

### Configuration
Le serveur a besoin d'un fichier `server/.env` avec au minimum :
- `JWT_SECRET` — **obligatoire** (le serveur refuse de démarrer sans).
- La connexion base : `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` (local) ou `MY_SUPABASE_URL` / `DATABASE_URL` (remote).

### Commandes (à la racine `erp-ATLAS/`)
```bash
npm run install-all     # installe racine + client + serveur
npm run dev             # lance client + serveur ensemble (via run.js)

# séparément :
npm run dev:server      # API seule
npm run dev:client      # interface seule

# base de données (Supabase) :
npm run init-supabase   # initialise le schéma
npm run push-db         # pousse les données locales vers Supabase
npm run pull-db         # récupère les données de Supabase
```

### Compte par défaut
À la première initialisation, un administrateur est créé automatiquement :
- **Utilisateur** : `admin`
- **Mot de passe** : `admin123`

> 🔐 **Changez ce mot de passe immédiatement** en production.

### Ports
- Serveur (API) : **5001** en dev (variable `PORT`, défaut 5000).
- Client (Vite) : **5173**.

---

## 13. Structure des fichiers du projet

```
erp-ATLAS/
├── package.json          # scripts globaux (dev, install-all, db…)
├── run.js                # lance client + serveur ensemble
├── vercel.json           # config déploiement Vercel
│
├── server/               # BACKEND (Node/Express/Sequelize)
│   ├── index.js          # point d'entrée du serveur + config sécurité
│   ├── config/database.js# connexion PostgreSQL/Supabase
│   ├── models/           # 26 modèles de données (voir ci-dessous)
│   │   └── index.js      # relations entre modèles + audit auto
│   ├── routes/           # 16 fichiers de routes API (logique métier)
│   ├── middleware/       # auth, validation, sécurité, logs
│   └── seeders/seed.js   # création de l'admin par défaut
│
└── client/               # FRONTEND (React/Vite)
    └── src/
        ├── App.jsx       # routage + protection par rôle
        ├── api.js        # client HTTP (axios) + refresh token
        ├── context/      # AuthContext (gestion session)
        ├── components/   # Layout (menu), Modal, SmartSearch…
        └── pages/        # 16 pages (une par module)
```

### Les 26 modèles de données (tables)
| Modèle | Table | Rôle |
|---|---|---|
| `User` | users | Comptes de connexion |
| `Customer` | customers | Clients |
| `Employee` | employees | Personnel (ouvriers, vendeurs, chauffeurs) |
| `EmployeePayment` | employee_payments | Versements de paie |
| `ProductModel` | product_models | Modèles de canapés (catalogue) |
| `Material` | materials | Matières premières |
| `ModelMaterial` | model_materials | Nomenclature (BOM) : modèle ↔ matière |
| `PackItem` | pack_items | Composition des packs |
| `Order` | orders | Commandes |
| `OrderItem` | order_items | Articles d'une commande |
| `OrderSalesman` | order_salesmen | Vendeurs d'une commande (+ partage %) |
| `Production` | productions | Fiches de fabrication |
| `ProductionWorker` | production_workers | Ouvriers assignés à une fiche |
| `WorkerType` | worker_types | Métiers de l'atelier |
| `WorkerTypeTariff` | worker_type_tariffs | Tarifs (métier × modèle) |
| `MaterialReservation` | material_reservations | Réservations de matières |
| `Payment` | payments | Paiements clients |
| `Delivery` | deliveries | Livraisons et transferts |
| `DeliveryOrder` | delivery_orders | Livraison ↔ commandes (multi) |
| `TransferDeliveryItem` | — | Articles d'un transfert interne |
| `DeliveryRoutePrime` | delivery_route_primes | Primes chauffeur par trajet |
| `Location` | locations | Emplacements (showrooms, dépôts) |
| `LocationStock` | location_stocks | Stock par emplacement |
| `Expense` | expenses | Dépenses de l'entreprise |
| `AuditLog` | — | Journal d'audit automatique |
| `RefreshToken` | — | Jetons de rafraîchissement (sessions) |

---

## 14. Points d'attention et particularités

- **Employé ≠ Utilisateur** : un **Employé** (ouvrier, vendeur…) est une personne payée par l'usine ; un **Utilisateur** est un compte de connexion à l'ERP. Un ouvrier n'a pas forcément de compte, et inversement.

- **Le stock des matières peut être négatif** : c'est volontaire. En usine réelle, on ne bloque jamais une fabrication faute de stock informatique ; on ajuste le stock ensuite.

- **1 fiche de fabrication = 1 unité** : une commande de 3 canapés identiques génère 3 fiches, pour un suivi individuel (ouvriers, horaires, qualité).

- **Le paiement `final` est automatique** : on ne le saisit jamais à la main. Il naît à la confirmation de la livraison.

- **Réversibilité** : annuler une commande, supprimer une production ou revenir sur une livraison **restitue automatiquement** le stock (matières ou produits finis) et supprime les paiements finaux — la cohérence est maintenue par des **transactions** en base.

- **Les 58 wilayas** d'Algérie sont intégrées pour l'adresse de livraison.

- **Multi-vendeurs** : une commande peut être partagée entre plusieurs vendeurs avec des pourcentages, chacun touchant sa commission au prorata.

- **Retour de livraison = nouvelle production** : si un client refuse un article (« problème »), le système recrée automatiquement une fiche de fabrication pour le réparer/refaire, et l'article est tracé en statut `problem`.

- **Fichiers de scripts utilitaires** : le dossier `server/` contient de nombreux scripts de maintenance/diagnostic/tests (`fix_*.js`, `test_*.js`, `debug_*.js`, `migrate_*.js`, `sync_*.js`) — ce sont des outils ponctuels de développement, pas des composants de l'application en fonctionnement.

---

*Document généré par analyse du code source du projet `erp-ATLAS`. Pour toute évolution, se référer aux fichiers `server/routes/` (logique métier) et `server/models/` (structure des données).*
