# Audit et stabilisation — MODERN POS

État au 22 septembre 2026. Ce document décrit les changements présents dans le workspace et les vérifications réellement effectuées. L'application utilise **SQLite (`better-sqlite3`)**, et non SQL Server comme le suggérait la demande initiale.

## Constats et corrections

- Les anciens parcours achats/TVA coexistaient avec les modèles actifs. Les migrations de compatibilité retirent les structures clairement obsolètes ; les parcours courants ventes, factures, achats, paiements, stock, retours et caisse restent séparés selon leur rôle. Une facture client ne recrée pas les paiements de ses ventes sources. Un paiement en espèces crée une transaction et un mouvement de caisse ; les autres moyens restent des transactions sans mouvement physique.
- Le démarrage réinitialisait des séquences de documents et un profil d'impression. Leur conservation au redémarrage est désormais couverte par un test.
- Les indicateurs « reste à encaisser » ignoraient les modifications de facture (TVA, timbre, prix). Les rapports utilisent maintenant les factures émises à la place de leurs ventes sources pour le solde ouvert, en comptant paiements des ventes, paiements de facture et avoirs sans doublon. Le tableau par client est rapproché avec ce même calcul.
- La restauration d'une sauvegarde pouvait commencer à remplacer le fichier SQLite alors qu'un autre processus détenait encore son WAL. La libération du journal précède désormais la copie et une erreur explicite est renvoyée si la base est occupée. Une restauration nécessite l'arrêt des autres instances et le redémarrage de l'application.
- Les cartes du Dashboard, les activités récentes et les alertes sont alimentées par les données réelles de l'entrepôt sélectionné. Les alertes couvrent le stock faible/épuisé, les lots proches de la péremption et les soldes clients/fournisseurs ouverts. Les clics transmettent des filtres aux modules concernés.

## Fonctionnalités livrées

- **Paramètres** : Général avec sauvegarde automatique, préférences globales réellement utilisées, activation facultative des images produit ; entrées d'interface *Entreprise* et *Numérotation* retirées sans supprimer la génération interne des numéros. Paramètres de paiement, facturation, caisse, impression et alertes conservent leur propriété respective.
- **Import/Export** : infrastructure CSV commune, modèles et prévisualisation/validation avant import pour produits, clients, fournisseurs et inventaire initial ; export filtré des documents commerciaux, transactions, paiements, mouvements et rapports. L'inventaire initial passe par les services de stock, pas par l'import direct de mouvements bruts.
- **Sauvegardes** : sauvegarde SQLite cohérente, vérification d'intégrité et de compatibilité, téléchargement, import, restauration confirmée avec sauvegarde de sécurité et suppression contrôlée ; accès administrateur.
- **Jeu de démonstration** : `server/database/reset-and-seed.js` reconstruit une base fictive cohérente via les services métier : 2 entrepôts, 3 caisses, produits suivis par série et lot, ventes payées/partielles/impayées, devis, facture client, retours/remboursements, commandes fournisseurs avec réceptions partielles, règlements directs des réceptions, mouvements de stock et de caisse. L'ancien fichier est sauvegardé avant remplacement. Commande : `npm run db:reset-seed` depuis `server` **avec Node 26 et toutes les instances fermées**. Identifiants fictifs de démonstration affichés par le script ; ne pas réutiliser en production.
- **Dashboard/Rapports** : calculs agrégés côté serveur avec filtres de période/entrepôt, analyses ventes/achats/clients/fournisseurs/stock/finance, sections graphiques légères et export CSV des mêmes données filtrées. Les factures clients ne sont pas additionnées aux ventes dans le chiffre d'affaires ; les achats sont calculés à partir des réceptions, sans ajouter les commandes. Les libellés ajoutés sont disponibles en français, anglais et arabe.
- **Réutilisation UI** : boutons d'export, filtres de documents, badges et composants existants repris lorsque possible ; pas de refonte générale.

## Vérification

- `29/29` tests d'intégration serveur réussis avec Node `v26.7.0`, dont ventes/paiements/stock/factures/retours, achats sans facture fournisseur, impression des réceptions, import-export, sauvegarde-restauration, redémarrage des migrations, seed et réconciliation des rapports.
- `npm run build` réussi ; `npm run lint` réussi (dans ce projet, cette commande vérifie la syntaxe JavaScript serveur, ce n'est pas un ESLint complet).
- SQLite : `integrity_check = ok`, `foreign_key_check = 0` après le reset et les tests.
- API locale : connexion, Dashboard, rapport clients et déconnexion vérifiés. Pour l'entrepôt de démonstration, chiffre d'affaires du jour `111900`, créances clients toutes dates `26280`, et alertes attendues présentes.
- `git diff --check` ne signale pas d'erreur de whitespace ; seulement des avertissements de conversion LF/CRLF.

## Limites et décisions restantes

- Aucune session de navigateur n'était disponible pour un parcours visuel de bout en bout. Les impressions physiques, la navigation manuelle de chaque écran et le rendu responsive restent à vérifier sur la machine cible. Le build ne remplace pas ces essais.
- Les montants SQLite sont encore stockés en `REAL`. Les services appliquent des arrondis monétaires, mais une conversion globale en unités monétaires mineures demanderait une migration et une décision métier distinctes.
- L'export est **CSV**, pas XLSX/Word. Les rapports ne publient pas de marge/bénéfice : le modèle ne garantit pas un coût historique suffisamment fiable. La valeur de stock issue des prix d'achat actuels ne doit pas être présentée comme une valorisation comptable définitive.
- Le bundle frontend reste volumineux (avertissement Vite >500 kB) ; le découpage en chunks peut être traité séparément. Un avertissement de type de module `postcss.config.js` subsiste, sans échec du build.
- Le `better-sqlite3` installé localement est compilé pour Node 26. Le `node` par défaut de cet environnement est Node 20 : pour lancer serveur/tests ici, utiliser Node 26 ou reconstruire les dépendances natives pour la version choisie.
- La revue n'est pas une preuve d'absence de toute chaîne non traduite ou de tout défaut latent dans chaque écran. Les parcours financiers couverts par les tests sont vérifiés ; les autres parcours nécessitent une recette utilisateur.

Les sauvegardes de sécurité dans `server/backups/` et la base de démonstration actuelle n'ont pas été supprimées après les tests.
