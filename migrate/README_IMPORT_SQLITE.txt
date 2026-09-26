IMPORTER LES ANCIENNES DONNEES DANS POS MODERN
================================================

Le nouveau script est : migrate/import-to-sqlite.js

Il importe :
- categories.txt  -> categories
- clients.txt     -> customers
- suppliers.txt   -> suppliers
- products.txt    -> products, unites et codes-barres (stock initialise a 0)

PRECAUTIONS
-----------
1. Lancez POS Modern au moins une fois afin que sa base, un utilisateur et un
   entrepot existent.
2. Fermez completement POS Modern avant l'import reel.
3. Faites d'abord une simulation.
4. L'import reel cree automatiquement une copie dans le dossier "backups" situe
   a cote de la base cible.

SIMULATION (aucune modification)
--------------------------------
Depuis le dossier principal du projet :

node migrate/import-to-sqlite.js --db "C:\CHEMIN\VERS\pos-modern.sqlite" --warehouse 1

Emplacements habituels :
- version installee : %APPDATA%\POS Modern\pos-modern.db
- version developpement : server\config\pos-modern.db

Le nom exact du dossier de la version installee peut dependre du nom utilise lors
du build. Recherchez "pos-modern.db" dans %APPDATA% si necessaire.

IMPORT REEL
-----------
node migrate/import-to-sqlite.js --db "C:\CHEMIN\VERS\pos-modern.sqlite" --warehouse 1 --apply

L'entrepot peut etre indique par son identifiant ou son nom :

node migrate/import-to-sqlite.js --db "C:\CHEMIN\VERS\pos-modern.sqlite" --warehouse "Magasin principal" --apply

IMPORT PARTIEL
--------------
Exemple sans produits ni stock :

node migrate/import-to-sqlite.js --db "C:\CHEMIN\VERS\pos-modern.sqlite" --only categories,customers,suppliers --apply

MISE A JOUR ET RELANCE
----------------------
Le script enregistre chaque correspondance ancien ID -> nouvel ID dans la table
legacy_import_map. Une deuxieme execution n'ajoute donc pas une seconde copie.

Pour actualiser les champs des fiches deja importees : ajoutez --update.
Le stock des produits importes est toujours initialise a 0. Les anciennes
quantites sont volontairement ignorees et aucun mouvement de stock initial
n'est cree. Le stock reel doit ensuite etre saisi dans POS Modern.

NOTES
-----
- Toutes les anciennes quantites, positives comme negatives, sont ignorees.
- Les soldes d'ouverture clients et fournisseurs sont conserves.
- Les apostrophes, virgules, retours a la ligne et echappements SQL sont analyses
  par un parseur adapte; l'ancien decoupage par expression reguliere n'est plus utilise.
- Aucune vente, facture, transaction ou historique ancien n'est present dans ces
  quatre fichiers et ne peut donc etre reconstruit par ce script.
- Pour connaitre toutes les options :

node migrate/import-to-sqlite.js --help
